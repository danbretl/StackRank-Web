import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataSafetyStore, createSessionGuard, planReconciliation, compareAndSwapRow, nextRemoteVersion } from '../lib/data-safety.js';

const USER_A = 'user:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'user:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const initialVersion = '2026-10-07T01:00:00.000+00:00';
const clone = (x) => JSON.parse(JSON.stringify(x));
function fixture(seed = {}) {
  const values = new Map(Object.entries(seed));
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  let lockChain = Promise.resolve();
  const locks = { request(_name, _options, run) { const promise = lockChain.then(run); lockChain = promise.catch(() => {}); return promise; } };
  const make = (options = {}) => createDataSafetyStore({ storage, locks, key: 'safety', legacyKeys: ['old-ranking'], ...options });
  return { values, storage, locks, make };
}

test('legacy bytes stay unowned until explicit recovery; foreign recovery is invisible', async () => {
  const f = fixture({ 'old-ranking': '{"movies":["legacy"]}' });
  const store = f.make();
  assert.equal((await store.activate(USER_A)).ok, true);
  assert.equal(store.getItem('old-ranking'), null);
  const [legacy] = store.listRecoveries();
  assert.equal(legacy.owner, null);
  assert.equal('raw' in legacy, false);
  assert.equal((await store.recover(legacy.id, { mode: 'replace' })).ok, true);
  assert.equal(store.getItem('old-ranking'), '{"movies":["legacy"]}');
  await store.preserve('account-private');
  const privateId = store.listRecoveries().find((x) => x.reason === 'account-private').id;
  await store.activate(USER_B);
  assert.equal(store.getItem('old-ranking'), null);
  assert.equal(store.listRecoveries().some((x) => x.id === privateId), false);
  assert.throws(() => store.readRecovery(privateId), /not available/);
  assert.equal(f.storage.getItem('old-ranking'), '{"movies":["legacy"]}');
});

test('anonymous data is offered once per recipient and never automatically merged', async () => {
  const f = fixture(); const store = f.make();
  await store.activate('anonymous');
  store.setItem('old-ranking', '["anonymous"]'); await store.flush();
  await store.activate(USER_A);
  assert.equal(store.getItem('old-ranking'), null);
  const [choice] = store.listRecoveries(); assert.equal(choice.reason, 'anonymous-consent');
  await store.recover(choice.id, { mode: 'replace' });
  await store.activate(USER_A);
  assert.equal(store.listRecoveries().filter((x) => x.reason === 'anonymous-consent').length, 0);
});

test('stale simultaneous tab saves preserve both snapshots and block stale writes', async () => {
  const f = fixture(); const one = f.make(); const two = f.make();
  await one.activate('anonymous'); await two.activate('anonymous');
  one.setItem('r', '["one"]'); two.setItem('r', '["two"]');
  const results = await Promise.all([one.flush(), two.flush()]);
  assert.equal(results.filter((x) => x.ok).length, 1);
  assert.equal(results[1].status, 'conflict');
  const persisted = JSON.parse(f.storage.getItem('safety'));
  assert.equal(persisted.owners.anonymous.raw.r, '["one"]');
  assert.equal(persisted.recoveries[0].raw.r, '["two"]');
  assert.throws(() => two.setItem('r', '[]'), /out of date/);
});

test('queued repeated saves use the latest local revision without false conflict', async () => {
  const f = fixture(); const store = f.make(); await store.activate(USER_A);
  store.setItem('r', '[1]'); const first = store.flush();
  store.setItem('r', '[1,2]'); const second = store.flush();
  assert.equal((await first).ok, true); assert.equal((await second).ok, true);
  assert.equal(JSON.parse(f.storage.getItem('safety')).owners[USER_A].raw.r, '[1,2]');
});

test('payload and dirty metadata commit atomically; acknowledgement preserves later edits', async () => {
  const f = fixture(); const store = f.make(); await store.activate(USER_A);
  store.setItem('r', '[1]'); const sentRevision = store.markDirty('ranking'); await store.flush();
  store.setItem('r', '[1,2]'); store.markDirty('ranking');
  store.acknowledge('ranking', { revision: sentRevision, baseline: { known: true, exists: true, updatedAt: initialVersion } });
  await store.flush();
  const data = JSON.parse(f.storage.getItem('safety')).owners[USER_A];
  assert.equal(data.raw.r, '[1,2]'); assert.equal(data.remote.ranking.dirty, true);
  assert.equal(data.remote.ranking.updatedAt, initialVersion);
  store.acknowledge('ranking', { revision: data.remote.ranking.revision, baseline: { known: true, exists: true, updatedAt: initialVersion } });
  assert.equal(store.getRemote('ranking').dirty, false);
});

test('quota exhaustion never evicts recoveries or overwrites original document', async () => {
  const f = fixture(); const store = f.make({ maxRecoveryEntries: 1 }); await store.activate(USER_A);
  store.setItem('r', '[1]'); await store.flush(); await store.preserve('first');
  store.setItem('r', '[2]'); const original = f.storage.getItem('safety');
  assert.equal((await store.preserve('second')).status, 'recovery-full');
  assert.equal(f.storage.getItem('safety'), original);
  assert.equal(store.getItem('r'), '[2]');
});

test('unreadable aggregate and unavailable locks fail closed', async () => {
  const f = fixture({ safety: '{broken' }); const store = f.make();
  assert.equal((await store.activate(USER_A)).status, 'unreadable');
  assert.throws(() => store.setItem('r', '[]'));
  assert.equal(f.storage.getItem('safety'), '{broken');
  const g = fixture(); const noLocks = g.make({ locks: null });
  assert.equal((await noLocks.activate('anonymous')).status, 'locking-unavailable');
  assert.throws(() => noLocks.setItem('r', '[]'));
  assert.equal(g.storage.getItem('safety'), null);
});

test('owner transition preserves staged data in originating owner and invalidates callbacks', async () => {
  const f = fixture(); const store = f.make(); await store.activate(USER_A);
  const token = store.capture(); store.setItem('r', '["private"]');
  await store.activate(USER_B);
  assert.equal(store.isCurrent(token), false); assert.equal(store.getItem('r'), null);
  await store.activate(USER_A); assert.equal(store.getItem('r'), '["private"]');
  assert.equal(store.isCurrent(token), false);
});

test('quota failure during transition keeps an owner-filtered memory recovery', async () => {
  const f = fixture(); const store = f.make(); await store.activate(USER_A);
  store.setItem('r', '["unsaved"]');
  const normal = f.storage.setItem; f.storage.setItem = () => { throw new Error('quota'); };
  await store.activate(USER_B);
  assert.equal(store.listRecoveries().length, 0);
  f.storage.setItem = normal; await store.activate(USER_A);
  const entry = store.listRecoveries().find((x) => x.memoryOnly);
  assert.equal(store.readRecovery(entry.id).raw.r, '["unsaved"]');
});

test('session guard refuses undo across A -> signed out -> A', () => {
  const guard = createSessionGuard(USER_A); const token = guard.capture();
  guard.change(null); guard.change(USER_A); assert.equal(guard.isCurrent(token), false);
});

test('reconciliation respects deletion, dirty edits, unknown baselines and absent rows', () => {
  const baseline = { known: true, exists: true, updatedAt: initialVersion };
  const common = { baseline, localValue: [1,2], remoteValue: [], remoteExists: true, remoteVersion: '2026-10-08T00:00:00Z' };
  assert.equal(planReconciliation({ ...common, dirty: false }), 'adopt-remote');
  assert.equal(planReconciliation({ ...common, dirty: true }), 'conflict');
  assert.equal(planReconciliation({ ...common, dirty: true, remoteVersion: initialVersion }), 'write-local');
  assert.equal(planReconciliation({ ...common, dirty: true, baseline: { known: false } }), 'conflict');
  assert.equal(planReconciliation({ ...common, dirty: true, remoteExists: false }), 'conflict');
  assert.equal(planReconciliation({ baseline: { known: true, exists: false }, dirty: true, localValue:[1], remoteValue:[], remoteExists:false }), 'write-local');
});

function remoteFixture({ row = null, afterCommitFailure = false, forever = false, malformedSuccess = false } = {}) {
  let stored = row && clone(row); const calls = [];
  const client = { from(table) {
    const query = { table, kind: 'read', filters: [], value: null,
      update(value) { this.kind = 'update'; this.value = clone(value); return this; },
      insert(value) { this.kind = 'insert'; this.value = clone(value); return this; },
      select() { return this; }, eq(key, value) { this.filters.push([key, value]); return this; },
      maybeSingle() { return this; }, abortSignal(signal) { this.signal = signal; return this; },
      then(resolve, reject) {
        calls.push({ kind: this.kind, filters: clone(this.filters), value: this.value });
        if (this.kind === 'read') return Promise.resolve({ data: stored && clone(stored), error: null }).then(resolve, reject);
        if (forever) return new Promise(() => {});
        if (this.kind === 'insert' && stored) return Promise.resolve({ data: null, error: { code:'23505' } }).then(resolve, reject);
        if (this.kind === 'update' && (!stored || this.filters.some(([key, value]) => key === 'updated_at' ? Date.parse(stored[key]) !== Date.parse(value) : stored[key] !== value))) return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        stored = clone(this.value);
        if (afterCommitFailure) return Promise.reject(new Error('response lost')).then(resolve, reject);
        const data = malformedSuccess ? [{ list_id:'wrong', items:[] }] : [{ ...clone(stored), updated_at: stored.updated_at.replace('Z', '+00:00') }];
        return Promise.resolve({ data, error:null }).then(resolve, reject);
      },
    };
    return query;
  } };
  return { client, calls, get row() { return stored; } };
}

test('CAS exact update advances token and a second stale writer cannot overwrite', async () => {
  const f = remoteFixture({ row: { list_id: USER_A, items:[1,2], updated_at:initialVersion } });
  const base = { client:f.client, table:'ranking', identity:{list_id:USER_A}, baseline:{known:true,exists:true,updatedAt:initialVersion} };
  const first = await compareAndSwapRow({ ...base, values:{items:[1]} }); assert.equal(first.status,'synced');
  assert.equal((await compareAndSwapRow({ ...base, values:{items:[2]} })).status, 'conflict');
  assert.deepEqual(f.row.items,[1]); assert.notEqual(f.row.updated_at,initialVersion);
  assert.equal(f.calls[0].filters.some(([key]) => key === 'updated_at'),true);
});

test('absent baseline uses insert only, and collision never upserts', async () => {
  const f = remoteFixture(); const options = { client:f.client, table:'ranking', identity:{list_id:USER_A}, baseline:{known:true,exists:false}, values:{items:[1]} };
  assert.equal((await compareAndSwapRow(options)).status,'synced');
  assert.equal((await compareAndSwapRow({ ...options, values:{items:[2]} })).status,'conflict');
  assert.deepEqual(f.row.items,[1]); assert.equal(f.calls.some((x) => x.kind === 'update'),false);
});

test('response lost after commit is confirmed by matching readback', async () => {
  const f = remoteFixture({ afterCommitFailure:true });
  const result = await compareAndSwapRow({ client:f.client,table:'r',identity:{list_id:USER_A},baseline:{known:true,exists:false},values:{items:[{z:1,a:2}]} });
  assert.equal(result.status,'synced'); assert.equal(result.recoveredResponse,true);
});

test('hung request times out without writing over latest remote state', async () => {
  const f = remoteFixture({ row:{list_id:USER_A,items:[3],updated_at:'2026-10-08T00:00:00Z'},forever:true });
  const result = await compareAndSwapRow({ client:f.client,table:'r',identity:{list_id:USER_A},baseline:{known:true,exists:true,updatedAt:initialVersion},values:{items:[1]},timeoutMs:5 });
  assert.equal(result.status,'conflict'); assert.deepEqual(f.row.items,[3]);
});

test('invalid success response needs matching readback before acknowledgement', async () => {
  const f = remoteFixture({ malformedSuccess:true });
  const result = await compareAndSwapRow({client:f.client,table:'r',identity:{list_id:USER_A},baseline:{known:true,exists:false},values:{items:[1]}});
  assert.equal(result.status,'synced'); assert.equal(result.recoveredResponse,true);
});

test('unknown baseline cannot issue a write and next tokens never repeat', async () => {
  const f = remoteFixture();
  assert.equal((await compareAndSwapRow({client:f.client,table:'r',identity:{list_id:USER_A},baseline:{known:false},values:{items:[]}})).status,'conflict');
  assert.equal(f.calls.length,0);
  const prior='2026-10-07T00:00:00.123456Z'; assert.equal(nextRemoteVersion(prior,0),'2026-10-07T00:00:00.124Z');
});

test('known-owner legacy keys are quarantined under that owner and mapped to adapter raw keys', async () => {
  const f = fixture({ 'queues:user:a': '{"watch":["A"]}', 'queues:user:b': '{"watch":["B"]}' });
  const store = f.make({ legacyKeys: () => [
    { key:'queues:user:a',owner:USER_A,rawKey:'queues' },
    { key:'queues:user:b',owner:USER_B,rawKey:'queues' },
  ] });
  await store.activate(USER_A);
  const entries = store.listRecoveries(); assert.equal(entries.length,1); assert.equal(entries[0].owner,USER_A);
  assert.equal(store.getItem('queues'),null);
  assert.equal(store.readRecovery(entries[0].id).raw.queues,'{"watch":["A"]}');
  await store.recover(entries[0].id,{mode:'replace'});
  assert.equal(store.getRemote('previously-unknown-surface').dirty,true);
  await store.activate('anonymous'); assert.equal(store.listRecoveries().length,0);
});

test('changed legacy bytes are preserved as a new recovery without retiring original copies', async () => {
  const f=fixture({'old-ranking':'[1]'}); const store=f.make(); await store.activate(USER_A);
  f.storage.setItem('old-ranking','[2]'); await store.activate(USER_A);
  assert.equal(store.listRecoveries().length,2);
  assert.deepEqual(store.listRecoveries().map((r)=>store.readRecovery(r.id).raw['old-ranking']),['[1]','[2]']);
});

test('recovery listing on corrupt storage cannot recurse through error UI callbacks', async () => {
  const f=fixture({safety:'{bad'}); let calls=0; let store;
  store=f.make({onError(){calls+=1;store.listRecoveries();}});
  await store.activate(USER_A); assert.equal(calls,1);
});

test('explicit dismissal stays dismissed while original legacy bytes remain intact', async () => {
  const f=fixture({'old-ranking':'[1]'}); const store=f.make(); await store.activate(USER_A);
  await store.dismissRecovery(store.listRecoveries()[0].id); await store.activate(USER_A);
  assert.equal(store.listRecoveries().length,0); assert.equal(f.storage.getItem('old-ranking'),'[1]');
  f.storage.setItem('old-ranking','[2]'); await store.activate(USER_A);
  assert.equal(store.listRecoveries().length,1);
});

test('throwing localStorage getter is reported during activation instead of crashing construction', async () => {
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('storage denied');}});
  try {
    const f=fixture(); const store=createDataSafetyStore({key:'blocked',locks:f.locks});
    const result=await store.activate('anonymous'); assert.equal(result.ok,false);
    assert.equal(result.error.message,'storage denied');
  } finally { if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage; }
});

test('overlapping activations cannot let an older owner replace the newest owner', async () => {
  const f=fixture(); const store=f.make(); await store.activate(USER_A);
  store.setItem('r','["private A"]');
  const older=store.activate(USER_B); const newer=store.activate('anonymous');
  assert.equal((await older).status,'owner-changed'); assert.equal((await newer).ok,true);
  assert.equal(store.capture().owner,'anonymous'); assert.equal(store.getItem('r'),null);
  store.setItem('r','["anonymous"]'); await store.flush();
  const doc=JSON.parse(f.storage.getItem('safety'));
  assert.equal(doc.owners.anonymous.raw.r,'["anonymous"]');
  assert.equal(doc.owners[USER_A].raw.r,'["private A"]');
  assert.equal(doc.owners[USER_B],undefined);
});

test('zero-row response after implicit retry confirms the first committed attempt by readback', async () => {
  let committed;
  const client={from(){return {
    kind:'read', value:null,
    update(value){this.kind='update';this.value=value;return this;},eq(){return this;},select(){return this;},maybeSingle(){return this;},abortSignal(){return this;},
    then(resolve,reject){
      if(this.kind==='update'){committed=clone(this.value);return Promise.resolve({data:[],error:null}).then(resolve,reject);}
      return Promise.resolve({data:committed,error:null}).then(resolve,reject);
    },
  };}};
  const result=await compareAndSwapRow({client,table:'r',identity:{list_id:USER_A},baseline:{known:true,exists:true,updatedAt:initialVersion},values:{items:[1]}});
  assert.equal(result.status,'synced');assert.equal(result.recoveredResponse,true);assert.deepEqual(committed.items,[1]);
});

test('unchanged payloads and metadata do not make another tab stale', async () => {
  const f=fixture();const one=f.make();await one.activate(USER_A);
  one.setItem('r','[1]');one.setRemote('ranking',{known:true,exists:true,updatedAt:initialVersion,dirty:false});await one.flush();
  const two=f.make();await two.activate(USER_A);
  const before=f.storage.getItem('safety');
  one.setItem('r','[1]');one.removeItem('missing');
  one.setRemote('ranking',{dirty:false,updatedAt:initialVersion,exists:true,known:true});
  one.acknowledge('ranking',{revision:undefined,baseline:{known:true,exists:true,updatedAt:initialVersion}});
  assert.equal((await one.flush()).status,'unchanged');assert.equal(f.storage.getItem('safety'),before);
  two.setItem('r','[1,2]');assert.equal((await two.flush()).ok,true);
});

test('resolved recoveries stay downloadable and explicit dismissal reclaims bounded capacity', async () => {
  const f=fixture({'old-ranking':'[1]'});const store=f.make({maxRecoveryEntries:2});await store.activate(USER_A);
  const legacy=store.listRecoveries()[0];await store.recover(legacy.id,{mode:'replace'});
  assert.equal(store.listRecoveries().length,0);
  const resolved=store.listRecoveries({includeResolved:true})[0];assert.equal(resolved.resolved,true);
  assert.equal(store.readRecovery(resolved.id).raw['old-ranking'],'[1]');
  await store.preserve('another');
  assert.equal((await store.preserve('overflow')).status,'recovery-full');
  assert.equal((await store.dismissRecovery(resolved.id)).ok,true);
  assert.equal((await store.preserve('now-fits')).ok,true);
  await store.activate(USER_A);
  assert.equal(store.listRecoveries({includeResolved:true}).some((r)=>r.id===resolved.id),false);
});
