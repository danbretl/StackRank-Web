import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { MockSupabase, deferred, cleanProfiles }=require('../scripts/testing/data-safety-browser.cjs');
const { USER_A, USER_B }=require('../scripts/testing/data-safety-fixtures.cjs');
const setup=()=>{const m=new MockSupabase();m.addUser(USER_A,'a@safety.test');m.addUser(USER_B,'b@safety.test');return m;};
const request=(method,path,session)=>({method,url:path,headers:{authorization:`Bearer ${session.access_token}`,prefer:'return=representation'}});
test('browser mock logout revokes refresh but leaves valid access JWT until expiry',async()=>{
  const m=setup(),s=m.issueSession(USER_A);m.revokeUserSessions(USER_A);
  assert.equal(m.roleFor(request('GET','/',s).headers).role,'authenticated');
  const refresh=await m.handle(request('POST','/auth/v1/token?grant_type=refresh_token',s),JSON.stringify({refresh_token:s.refresh_token}));
  assert.equal(refresh.status,400);
  assert.equal(m.roleFor(request('GET','/',m.issueSession(USER_A,{expiresIn:-3600})).headers).role,'expired');
});
test('browser mock conditional update uses Postgres timestamp equality and protects owner',async()=>{
  const m=setup(),s=m.issueSession(USER_A),b=m.issueSession(USER_B);
  m.db.rankings=[{list_id:`user:${USER_A}`,movies:[{tmdbId:1}],updated_at:'2026-10-01T00:00:00.000+00:00'}];
  const route=`/rest/v1/rankings?list_id=eq.user:${USER_A}&updated_at=eq.2026-10-01T00:00:00.000Z`;
  const changed=await m.handle(request('PATCH',route,s),JSON.stringify({movies:[],updated_at:'2026-10-02T00:00:00Z'}));
  assert.equal(changed.body.length,1);
  const stale=await m.handle(request('PATCH',route,s),JSON.stringify({movies:[{tmdbId:9}]}));
  assert.deepEqual(stale.body,[]);
  const denied=await m.handle(request('PATCH',`/rest/v1/rankings?list_id=eq.user:${USER_A}`,b),JSON.stringify({movies:[{tmdbId:9}]}));
  assert.deepEqual(denied.body,[]);assert.deepEqual(m.db.rankings[0].movies,[]);
});
test('browser mock barrier keeps competing write schedules deterministic',async()=>{
  const m=setup(),s=m.issueSession(USER_A),gate=deferred();
  m.rule({name:'held',method:'POST',table:'rankings',hold:gate});
  const call=m.handle(request('POST','/rest/v1/rankings',s),JSON.stringify({list_id:`user:${USER_A}`,movies:[]}));
  assert.equal(m.trace[0].held,true);assert.equal(m.db.rankings.length,0);
  gate.resolve();assert.equal((await call).status,201);assert.equal(m.db.rankings.length,1);
});
test.after(()=>cleanProfiles());
