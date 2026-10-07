"use strict";
// Real browser regression journeys with a local synthetic Supabase. No customer
// data or service credentials. Run with DATA_SAFETY_ONLY=<substring> to focus.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const H = require('./testing/data-safety-browser.cjs');
const { USER_A, USER_B, MOVIES: M, queued, dog } = require('./testing/data-safety-fixtures.cjs');
const reportDir = path.resolve(process.env.DATA_SAFETY_REPORT_DIR || path.join(H.SOURCE_ROOT, 'reports/data-safety', new Date().toISOString().replace(/[:.]/g, '-')));
fs.mkdirSync(reportDir, { recursive: true });
const T = '2026-09-20T00:00:00.000Z';
const DOGS = [dog('VBO:0200162', 'Bichon Frise'), dog('VBO:0201396', 'Water Dog')];
const CHI = dog('VBO:0200329', 'Chi-Poo');
const APPS = {
  movies: { table: 'rankings', field: 'movies', key: 'stackrank:movies:v1', items: [M.m1, M.m2, M.m3], replacement: [M.m4], private: [M.b1, M.b2], auth: '#settings-auth-state', signout: '#settings-sign-out', clear: '#clear-list', input: '#backup-file-input', ui: `[...document.querySelectorAll('#ranking .ranking__item')].map(r=>Number(r.dataset.tmdbId || r.querySelector('[data-tmdb-id]')?.dataset.tmdbId))`, titles: `[...document.querySelectorAll('#ranking .ranking__title')].map(e=>e.textContent.trim())` },
  dogs: { table: 'category_rankings', field: 'items', key: 'stackrank:dogs:ranking:v1', items: DOGS, replacement: [CHI], private: [CHI], auth: '#dogs-account-state', signout: '#dogs-sign-out', clear: '#dogs-clear', input: '#dogs-restore-file', titles: `[...document.querySelectorAll('#dogs-ranking .ranking-row')].map(e=>e.dataset.key.split(':').slice(-2).join(':'))` },
};
const ids = (app, items) => items.map(i => app === 'movies' ? i.tmdbId : i.entityRef.id);
const labels = (app, items) => items.map(i => app === 'movies' ? i.title : i.entityRef.id);
const remote = (mock, app, user = USER_A) => mock.rows(APPS[app].table, `user:${user}`, app === 'dogs' ? { category: 'dogs' } : {})[0];
const magicHash = s => `#access_token=${s.access_token}&expires_at=${s.expires_at}&expires_in=${s.expires_in}&refresh_token=${s.refresh_token}&token_type=bearer&type=magiclink`;
function seedRemote(mock, app, user = USER_A, items = APPS[app].items) {
  mock.db[APPS[app].table].push({ list_id: `user:${user}`, ...(app === 'dogs' ? { category: 'dogs' } : {}), [APPS[app].field]: structuredClone(items), updated_at: T });
}
async function boot(page, web, app, email = 'a@safety.test') {
  await page.navigate(`${web.url}/${app}?debug=1`);
  if (app === 'dogs') await page.waitFor(`document.querySelector('#dogs-catalog-status')?.dataset.ready === 'true'`, 25000);
  await page.waitFor(`document.querySelector(${JSON.stringify(APPS[app].auth)})?.textContent.includes(${JSON.stringify(email)})`, 15000, `${app} auth ${email}`);
  await page.waitFor(`document.documentElement.dataset.${app}PersistenceReady === 'true'`,25000,`${app} initial persistence settled`);
}
async function expectList(page, app, items) {
  const expected = labels(app, items);
  await page.waitFor(`JSON.stringify(${APPS[app].titles}) === ${JSON.stringify(JSON.stringify(expected))}`, 12000, `${app} list ${JSON.stringify(expected)}`);
}
async function expectOwnerState(c,page,app,items,email,{reload=false}={}) {
  await page.waitFor(`document.querySelector(${JSON.stringify(APPS[app].auth)})?.textContent.includes(${JSON.stringify(email)})`);
  const expected=JSON.stringify(labels(app,items));
  const reloadButton=app==='movies'?'#movies-reload-tab':'#dogs-reload-saved';
  const guard=`(()=>{const b=document.querySelector(${JSON.stringify(reloadButton)});return b&&!b.hidden&&!b.disabled&&/another tab|out of date|newer copy|reload/i.test(document.querySelector('#${app}-data-safety-message')?.textContent||'')})()`;
  await page.waitFor(`JSON.stringify(${APPS[app].titles})===${JSON.stringify(expected)}||${guard}`,15000,'account data or explicit actionable stale-tab guard');
  const actual=await page.evaluate(APPS[app].titles);
  assert(actual.every(value=>labels(app,items).includes(value)),'old owner entries never appear in the current account view');
  if(JSON.stringify(actual)!==expected){
    (c.guardedTransitions||=[]).push({app,page:page.label,owner:email,action:reload?'user selected reload':'kept tab open to preserve RAM recovery'});
    if(reload){await page.evaluate(`document.querySelector(${JSON.stringify(reloadButton)}).click()`);await expectList(page,app,items);}
  }
}
async function remove(page, app, index = 0) {
  const expr = app === 'movies' ? `document.querySelectorAll('#ranking .ranking__item')[${index}]?.querySelector('.ranking__delete')` : `document.querySelectorAll('#dogs-ranking .ranking-row')[${index}]?.querySelector('[data-action="remove"]')`;
  assert(await page.evaluate(`(()=>{const b=${expr};if(!b)return false;b.click();return true})()`), `${app} remove button present`);
}
async function writeObserved(mock, app, items, user = USER_A) {
  await H.waitUntil(() => JSON.stringify(ids(app, remote(mock, app, user)?.[APPS[app].field] || [])) === JSON.stringify(ids(app, items)), `${app} account row ${JSON.stringify(ids(app, items))}`);
}
async function setFile(page, selector, file) {
  const { root } = await page.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await page.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  assert(nodeId, `File input ${selector}`);
  await page.send('DOM.setFileInputFiles', { nodeId, files: [file] });
}
async function captureRecoveryUi(page, app, kind='recovery') {
  await page.send('Page.bringToFront');
  for(const [name,width,height] of [['desktop',1280,900],['phone',390,844]]) {
    await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:name==='phone'});
    await page.evaluate(`document.querySelector('#${app}-data-safety').scrollIntoView({block:'center'})`);
    await page.evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    const layout=await page.evaluate(`(()=>{const p=document.querySelector('#${app}-data-safety'),r=document.querySelector('#dogs-view-rank');return {width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,panelBottom:p.getBoundingClientRect().bottom,rankTop:r&&!r.hidden?r.getBoundingClientRect().top:null}})()`);
    assert(layout.scrollWidth<=layout.width+1,`${app} ${name} recovery does not overflow horizontally`);
    if(app==='dogs'&&layout.rankTop!==null)assert(layout.panelBottom<=layout.rankTop+1,'Dogs recovery stays above rank content in normal flow');
    const shot=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.writeFileSync(path.join(reportDir,`${app}-${kind}-${name}.png`),Buffer.from(shot.data,'base64'));
  }
}
function backup(app, items) {
  return app === 'movies' ? { kind: 'stackrank-backup', version: 1, exportedAt: T, ranking: items, queues: { watch: [], notInterested: [] }, packProgress: {}, shareOptions: {} }
    : { kind: 'stackrank-dogs-backup', version: 1, category: 'dogs', exportedAt: T, ranking: items, lists: { curious: [], not_for_me: [] }, packProgress: {}, preferences: {} };
}
const tests = [];
function test(name, findings, run) { tests.push({ name, findings, run }); }
async function newDevice(c, app, name = app) {
  const browser = await H.launchBrowser({ name, mockUrl: c.mock.url, appUrl: c.web.url });
  c.browsers.push(browser);
  const page = await browser.firstPage();
  await H.seedStorage(page, c.web.url, { [H.AUTH_STORAGE_KEY]: c.mock.issueSession(USER_A) });
  await boot(page, c.web, app);
  return { page, browser };
}

// These use actual signOut + Supabase BroadcastChannel events, not fabricated
// callbacks, and same-context tabs for shared origin/storage semantics.
for (const signoutApp of ['movies', 'dogs']) test(`account isolation: sign out in ${signoutApp}, sibling and same-context tabs`, ['DS-001', 'DS-007'], async c => {
  for (const app of Object.keys(APPS)) { seedRemote(c.mock, app); seedRemote(c.mock, app, USER_B, APPS[app].private); }
  const { page, browser } = await newDevice(c, 'movies');
  await expectList(page, 'movies', APPS.movies.items);
  const sibling = await browser.newTab('dogs'); await boot(sibling, c.web, 'dogs'); await expectList(sibling, 'dogs', DOGS);
  const active = signoutApp === 'movies' ? page : sibling;
  // An undo callback exists at the time the owner's session ends.
  await remove(active, signoutApp, 0);
  await writeObserved(c.mock, signoutApp, APPS[signoutApp].items.slice(1));
  await active.evaluate(`document.querySelector(${JSON.stringify(APPS[signoutApp].signout)}).click()`);
  for (const [app, p] of [['movies', page], ['dogs', sibling]]) {
    await expectList(p, app, []);
    await p.evaluate(`for (const b of document.querySelectorAll('button')) if(b.textContent.trim()==='Undo') b.click()`);
    await expectList(p, app, []);
  }
  await page.navigate(`${c.web.url}/__audit_blank`);
  await page.navigate(`${c.web.url}/movies${magicHash(c.mock.issueSession(USER_B))}`);
  await page.waitFor(`document.querySelector('#settings-auth-state')?.textContent.includes('b@safety.test')`);
  await expectList(page, 'movies', APPS.movies.private);
  await boot(sibling, c.web, 'dogs', 'b@safety.test'); await expectList(sibling, 'dogs', APPS.dogs.private);
  for (const app of Object.keys(APPS)) assert.deepEqual(ids(app, remote(c.mock, app, USER_B)[APPS[app].field]), ids(app, APPS[app].private));
});

test('expired refresh at boot cannot adopt previous account mirrors', ['DS-001'], async c => {
  for (const app of Object.keys(APPS)) { seedRemote(c.mock, app); seedRemote(c.mock, app, USER_B, APPS[app].private); }
  const { page } = await newDevice(c, 'movies'); await expectList(page, 'movies', APPS.movies.items);
  await boot(page, c.web, 'dogs'); await expectList(page, 'dogs', DOGS);
  const expired = c.mock.issueSession(USER_A, { expiresIn: -3600 }); c.mock.revokeUserSessions(USER_A);
  await H.seedStorage(page, c.web.url, { [H.AUTH_STORAGE_KEY]: expired }, { clear: false });
  await page.navigate(`${c.web.url}/movies`);
  await page.waitFor(`!JSON.parse(localStorage.getItem(${JSON.stringify(H.AUTH_STORAGE_KEY)}) || 'null')`);
  await expectList(page, 'movies', []);
  await page.navigate(`${c.web.url}/__audit_blank`);
  await page.navigate(`${c.web.url}/movies${magicHash(c.mock.issueSession(USER_B))}`);
  await expectList(page, 'movies', APPS.movies.private);
  await boot(page, c.web, 'dogs', 'b@safety.test'); await expectList(page, 'dogs', APPS.dogs.private);
  for (const app of Object.keys(APPS)) assert.deepEqual(ids(app, remote(c.mock, app, USER_B)[APPS[app].field]), ids(app, APPS[app].private));
});

for (const operation of ['rerank', 'queue']) test(`Movies ${operation} interruption preserves durable origin`, ['DS-002'], async c => {
  seedRemote(c.mock, 'movies');
  const q = queued('Safety Queued', 2003, 900401);
  c.mock.db.movie_lists.push({ list_id: `user:${USER_A}`, list_type: 'watch', movies: [q], updated_at: T });
  const { page } = await newDevice(c, 'movies'); await expectList(page, 'movies', APPS.movies.items);
  if (operation === 'rerank') await page.evaluate(`document.querySelectorAll('#ranking .ranking__item')[1].querySelector('.ranking__restack').click()`);
  else {
    await page.waitFor(`document.querySelector('#watch-list')?.textContent.includes('Safety Queued')`);
    await page.evaluate(`(()=>{const li=[...document.querySelectorAll('#watch-list li')].find(r=>r.textContent.includes('Safety Queued'));[...li.querySelectorAll('button')].find(b=>b.textContent.trim()==='Rank').click()})()`);
  }
  await page.waitFor(`document.body.classList.contains('is-comparing')`);
  assert.deepEqual(ids('movies', remote(c.mock, 'movies').movies), ids('movies', APPS.movies.items));
  assert.deepEqual(c.mock.rows('movie_lists', `user:${USER_A}`, {list_type:'watch'})[0].movies.map(m=>m.tmdbId), [q.tmdbId]);
  await boot(page, c.web, 'movies'); await expectList(page, 'movies', APPS.movies.items);
  await page.waitFor(`document.querySelector('#watch-list')?.textContent.includes('Safety Queued')`);
});

for (const app of Object.keys(APPS)) for (const operation of ['clear', 'remove', 'restore']) test(`${app} independent devices retain ${operation} through stale reload`, ['DS-005'], async c => {
  seedRemote(c.mock, app);
  const d1 = await newDevice(c, app, 'device1'), d2 = await newDevice(c, app, 'device2');
  for (const d of [d1,d2]) await expectList(d.page, app, APPS[app].items);
  let expected;
  if (operation === 'clear') { expected=[]; await d1.page.evaluate(`document.querySelector(${JSON.stringify(APPS[app].clear)}).click()`); }
  else if(operation === 'remove') { expected=APPS[app].items.slice(1); await remove(d1.page, app); }
  else { expected=APPS[app].replacement; const file=path.join(reportDir,`${app}-restore.json`); fs.writeFileSync(file,JSON.stringify(backup(app,expected))); await setFile(d1.page,APPS[app].input,file); }
  await writeObserved(c.mock, app, expected);
  await boot(d2.page,c.web,app); await expectList(d2.page,app,expected);
  await boot(d1.page,c.web,app); await expectList(d1.page,app,expected);
  assert.deepEqual(ids(app,remote(c.mock,app)[APPS[app].field]),ids(app,expected));
});

for (const app of Object.keys(APPS)) test(`${app} same-context stale tab cannot overwrite a sibling edit`, ['DS-004'], async c => {
  seedRemote(c.mock,app);
  const {page: t1,browser}=await newDevice(c,app); await expectList(t1,app,APPS[app].items);
  const t2=await browser.newTab('sibling'); await boot(t2,c.web,app); await expectList(t2,app,APPS[app].items);
  await remove(t2,app,0); await writeObserved(c.mock,app,APPS[app].items.slice(1));
  // Force a stale DOM action without reloading: adapters may block it or have
  // already adopted sibling state; either must not resurrect removed identity.
  await t1.evaluate(app==='movies' ? `document.querySelector('#ranking .ranking__item .ranking__delete')?.click()` : `document.querySelector('#dogs-ranking .ranking-row [data-action="up"]')?.click()`);
  await boot(t1,c.web,app);
  await t1.waitFor(`!(${APPS[app].titles}).includes(${JSON.stringify(labels(app,APPS[app].items)[0])})`);
  assert(!ids(app,remote(c.mock,app)[APPS[app].field]).includes(ids(app,APPS[app].items)[0]),'stale tab did not resurrect removed row');
});

test('Dogs malformed remote row is preserved without repair write', ['DS-008'], async c => {
  const malformed=[...DOGS,{entityRef:{domain:'dogs',type:'breed',source:'vbo',id:'VBO:0200799'},snapshot:{secondaryText:'missing primaryText'}}];
  seedRemote(c.mock,'dogs',USER_A,malformed);
  const original=JSON.stringify(remote(c.mock,'dogs'));
  const {page}=await newDevice(c,'dogs');
  await page.waitFor(`/invalid|unsupported|could not|unable|unavailable|check|failed|malformed|problem|not.*sync/i.test(document.querySelector('#dogs-remote-gate-note')?.textContent || document.querySelector('#dogs-data-safety-message')?.textContent || '')`);
  assert.equal(JSON.stringify(remote(c.mock,'dogs')),original);
  assert.equal(c.mock.trace.filter(t=>t.table==='category_rankings'&&['POST','PATCH','DELETE'].includes(t.method)).length,0);
});

for (const app of Object.keys(APPS)) test(`${app} delayed account A read cannot replace account B`, ['DS-001'], async c => {
  seedRemote(c.mock, app); seedRemote(c.mock, app, USER_B, APPS[app].private);
  const gate=H.deferred();
  const rule=c.mock.rule({name:'old-owner-read',method:'GET',table:APPS[app].table,when:ctx=>ctx.role.sub===USER_A,hold:gate});
  const browser=await H.launchBrowser({name:'auth-race',mockUrl:c.mock.url,appUrl:c.web.url});c.browsers.push(browser);
  const p=await browser.firstPage(); await H.seedStorage(p,c.web.url,{[H.AUTH_STORAGE_KEY]:c.mock.issueSession(USER_A)});
  await p.navigate(`${c.web.url}/${app}`); await H.waitUntil(()=>rule.hits>=1,'old account request reached barrier');
  const switcher=await browser.newTab('switch-account'); await switcher.navigate(`${c.web.url}/${app}${magicHash(c.mock.issueSession(USER_B))}`);
  await expectOwnerState(c,switcher,app,APPS[app].private,'b@safety.test');
  gate.resolve(); await H.waitUntil(()=>c.mock.trace.some(t=>t.rule==='old-owner-read'&&t.completed),'old account response released');
  // Fresh reload is the durable assertion; the old response must never have
  // changed either B's scoped local copy or B's remote rows.
  await expectOwnerState(c,p,app,APPS[app].private,'b@safety.test',{reload:true});
  await boot(p,c.web,app,'b@safety.test'); await expectList(p,app,APPS[app].private);
  assert.deepEqual(ids(app,remote(c.mock,app,USER_B)[APPS[app].field]),ids(app,APPS[app].private));
});

for (const app of Object.keys(APPS)) test(`${app} rejected initial read prevents blind overwrite`, ['DS-003', 'DS-008'], async c => {
  seedRemote(c.mock,app);
  const {page}=await newDevice(c,app); await expectList(page,app,APPS[app].items);
  // Another device adds an entry the local mirror has never seen.
  remote(c.mock,app)[APPS[app].field].push(app==='movies'?M.r1:CHI);
  remote(c.mock,app).updated_at='2026-09-21T00:00:00.000Z';
  const preserved=JSON.stringify(remote(c.mock,app));
  const rule=c.mock.rule({name:'initial-read-rejected',method:'GET',table:APPS[app].table,mode:'http-error',status:400,times:100});
  await boot(page,c.web,app); await expectList(page,app,APPS[app].items);
  await H.waitUntil(()=>rule.hits>0,'non-retried initial read failure');
  await page.waitFor(`/sync|account|retry|unavailable|failed/i.test(document.body.innerText)`);
  await remove(page,app,0);
  // Wait for the owner-bound local edit to become observable, or a guarded UI.
  await page.waitFor(`!(${APPS[app].titles}).includes(${JSON.stringify(labels(app,APPS[app].items)[0])}) || /reload|conflict|retry|check/i.test(document.body.innerText)`);
  await page.evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  assert.equal(JSON.stringify(remote(c.mock,app)),preserved,'failed read left unknown remote state intact');
  const firstFail=c.mock.trace.findIndex(t=>t.rule==='initial-read-rejected');
  assert.equal(c.mock.trace.slice(firstFail).filter(t=>t.table===APPS[app].table&&['POST','PATCH','DELETE'].includes(t.method)).length,0,'no write until successful reconciliation');
});

for(const app of Object.keys(APPS)) test(`${app} unowned legacy copy requires recovery choice`, ['DS-001','DS-006','DS-012','DS-013'],async c=>{
  seedRemote(c.mock,app,USER_A,APPS[app].private);
  const browser=await H.launchBrowser({name:'legacy',mockUrl:c.mock.url,appUrl:c.web.url});c.browsers.push(browser);
  const page=await browser.firstPage();
  const legacy={ [APPS[app].field]:APPS[app].items,updated_at:T };
  await H.seedStorage(page,c.web.url,{[H.AUTH_STORAGE_KEY]:c.mock.issueSession(USER_A),[APPS[app].key]:legacy});
  await boot(page,c.web,app);await expectList(page,app,APPS[app].private);
  const saved=await page.evaluate(`JSON.parse(localStorage.getItem('stackrank:${app}:safety:v1')||'null')`);
  assert(saved?.recoveries?.some(r=>r.owner===null&&r.raw[APPS[app].key]===JSON.stringify(legacy)),'unowned bytes preserved in explicit recovery');
  assert.deepEqual(ids(app,remote(c.mock,app)[APPS[app].field]),ids(app,APPS[app].private),'legacy data never silently assigned to account');
  await page.waitFor(`(document.querySelector('#${app}-data-safety') && !document.querySelector('#${app}-data-safety').hidden) || /recover/i.test(document.querySelector('#${app}-data-safety-message')?.textContent||'')`);
  await captureRecoveryUi(page,app);
});

for(const app of Object.keys(APPS)) test(`${app} anonymous owned tabs preserve sibling change and stale edit recovery`, ['DS-004'],async c=>{
  const browser=await H.launchBrowser({name:'anonymous-tabs',mockUrl:c.mock.url,appUrl:c.web.url});c.browsers.push(browser);
  const t1=await browser.firstPage();
  await H.seedOwnedStorage(t1,c.web.url,{key:`stackrank:${app}:safety:v1`,owner:'anonymous',entries:{[APPS[app].key]:{[APPS[app].field]:APPS[app].items,updated_at:T}}});
  await t1.navigate(`${c.web.url}/${app}`);await expectList(t1,app,APPS[app].items);
  const t2=await browser.newTab('second');await t2.navigate(`${c.web.url}/${app}`);await expectList(t2,app,APPS[app].items);
  await remove(t2,app,0);
  await t2.waitFor(`(()=>{const d=JSON.parse(localStorage.getItem('stackrank:${app}:safety:v1'));const r=JSON.parse(d.owners.anonymous.raw[${JSON.stringify(APPS[app].key)}]);return r[${JSON.stringify(APPS[app].field)}].length===${APPS[app].items.length-1}})()`);
  // The stale DOM still has a different last-item remove available. The winning
  // sibling data must survive; if the stale edit is blocked, preserve recovery.
  const action=app==='movies'?`document.querySelectorAll('#ranking .ranking__item')[${APPS[app].items.length-1}]?.querySelector('.ranking__delete')`:`document.querySelectorAll('#dogs-ranking .ranking-row')[${APPS[app].items.length-1}]?.querySelector('[data-action="remove"]')`;
  const attempted=await t1.evaluate(`(()=>{const b=${action};if(!b)return false;b.click();return true})()`);
  if(attempted) await t1.waitFor(`/out of date|another tab|reload|conflict|saved copy/i.test(document.body.innerText)`);
  const saved=await t1.evaluate(`JSON.parse(localStorage.getItem('stackrank:${app}:safety:v1'))`);
  const current=JSON.parse(saved.owners.anonymous.raw[APPS[app].key]);
  assert(!ids(app,current[APPS[app].field]).includes(ids(app,APPS[app].items)[0]));
  if(attempted) assert(saved.recoveries.some(r=>r.owner==='anonymous'&&r.reason==='stale-tab'),'stale edit preserved for explicit recovery');
  await t1.navigate(`${c.web.url}/${app}`);await expectList(t1,app,APPS[app].items.slice(1));
});

for(const app of Object.keys(APPS)) for(const mode of ['http-error','network-after-commit']) test(`${app} ${mode} mutation stays recoverable through retry`, ['DS-009','DS-010','DS-011'],async c=>{
  seedRemote(c.mock,app);
  const {page}=await newDevice(c,app);await expectList(page,app,APPS[app].items);
  const rule=c.mock.rule({name:'write-failure',table:APPS[app].table,when:ctx=>['POST','PATCH'].includes(ctx.method),mode,status:500,times:mode==='http-error'?100:1});
  await remove(page,app,0);await H.waitUntil(()=>rule.hits>=1,'write fault reached');
  if(mode==='http-error') await page.waitFor(`/not.*sync|pending|retry|failed|could not|unable|not.*saved|check.*account/i.test(document.querySelector('#${app}-data-safety-message')?.textContent||document.querySelector('#api-status')?.textContent||document.querySelector('#dogs-remote-gate-note')?.textContent||'')`,15000,'truthful failed write state');
  else await H.waitUntil(()=>{const index=c.mock.trace.findIndex(t=>t.rule==='write-failure');return index>=0&&c.mock.trace.slice(index+1).some(t=>t.table===APPS[app].table&&t.method==='GET'&&t.completed)},'ambiguous write confirmed by readback');
  const saved=await page.evaluate(`JSON.parse(localStorage.getItem('stackrank:${app}:safety:v1'))`);
  const raw=saved.owners[`user:${USER_A}`].raw[APPS[app].key];
  assert.deepEqual(ids(app,JSON.parse(raw)[APPS[app].field]),ids(app,APPS[app].items.slice(1)),'local edit remains durable');
  if(mode==='http-error') {
    await page.waitFor(`(()=>{const b=document.querySelector('#${app}-sync-retry');return b&&!b.hidden&&!b.disabled})()`,15000,'failed write exposes retry after in-flight work settles');
    rule.times=rule.hits;
    const retried=await page.evaluate(`(()=>{const b=document.querySelector('#${app}-sync-retry');if(!b||b.hidden||b.disabled)return false;b.click();return true})()`);
    assert(retried,'explicit retry available after failed write');
  }
  await writeObserved(c.mock,app,APPS[app].items.slice(1));
  await boot(page,c.web,app);await expectList(page,app,APPS[app].items.slice(1));
});

for(const app of Object.keys(APPS)) test(`${app} hung write times out while later edit remains recoverable`, ['DS-010','DS-011'],async c=>{
  seedRemote(c.mock,app);
  const {page}=await newDevice(c,app);await expectList(page,app,APPS[app].items);
  const gate=H.deferred(),rule=c.mock.rule({name:'held-write',table:APPS[app].table,when:ctx=>['POST','PATCH'].includes(ctx.method),hold:gate});
  await remove(page,app,0);await H.waitUntil(()=>rule.hits>=1,'write started and remains held');
  // The later edit must reach durable local storage while the first remote
  // request is still held. It must not wait behind the network timeout.
  await remove(page,app,0);
  const wanted=ids(app,APPS[app].items.slice(2));
  const preservedExpression=`(()=>{const d=JSON.parse(localStorage.getItem('stackrank:${app}:safety:v1'));const entries=[d?.owners?.['user:${USER_A}'],...(d?.recoveries||[]).filter(r=>r.owner==='user:${USER_A}')];return entries.some(e=>{try {const items=JSON.parse(e.raw[${JSON.stringify(APPS[app].key)}])[${JSON.stringify(APPS[app].field)}];return JSON.stringify(items.map(i=>${app==='movies'?'i.tmdbId':'i.entityRef.id'}))===${JSON.stringify(JSON.stringify(wanted))}}catch(_){return false}})})()`;
  await page.waitFor(preservedExpression,2000,'second edit durable even behind hung write');
  // Exercise the real timeout without accelerated timers.
  await H.waitUntil(async()=>{
    const held=c.mock.trace.find(t=>t.rule==='held-write');
    if(Date.now()-held.t < 10000) return false;
    const completedLater=c.mock.trace.some(t=>t.id>held.id&&t.table===APPS[app].table&&['PATCH','POST'].includes(t.method)&&t.completed);
    return completedLater || await page.evaluate(`/timed out|retry|not.*sync|could not|unable/i.test(document.querySelector('#${app}-data-safety-message')?.textContent||document.querySelector('#dogs-remote-gate-note')?.textContent||document.querySelector('#api-status')?.textContent||'')`);
  },'hung write releases queue or reports bounded failure',18000);
  gate.resolve();await H.waitUntil(()=>c.mock.trace.some(t=>t.rule==='held-write'&&t.completed),'late request completes');
  await boot(page,c.web,app);
  await page.waitFor(preservedExpression,12000,'reload retains latest edit or explicit owner recovery');
  assert(!ids(app,remote(c.mock,app)[APPS[app].field]).includes(ids(app,APPS[app].items)[0]),'late write cannot resurrect first removed item');
});

for(const app of Object.keys(APPS)) test(`${app} partial restore reports pending and retries remaining surface`, ['DS-005','DS-009','DS-016'],async c=>{
  seedRemote(c.mock,app);
  const table=app==='movies'?'movie_lists':'category_lists';
  const type=app==='movies'?'watch':'curious';
  const field=APPS[app].field;
  c.mock.db[table].push({list_id:`user:${USER_A}`,...(app==='dogs'?{category:'dogs'}:{}),list_type:type,[field]:app==='movies'?[queued('Before Restore',2000,900901)]:[CHI],updated_at:T});
  const {page}=await newDevice(c,app);await expectList(page,app,APPS[app].items);
  const rule=c.mock.rule({name:'restore-one-surface-fails',table,when:ctx=>['PATCH','POST'].includes(ctx.method),mode:'http-error',status:500,times:100});
  const file=path.join(reportDir,`${app}-partial-restore.json`);fs.writeFileSync(file,JSON.stringify(backup(app,APPS[app].replacement)));
  await setFile(page,APPS[app].input,file);await H.waitUntil(()=>rule.hits>=1,'partial restore failure hit');
  await page.waitFor(`/pending|retry|could not|not.*sync|failed/i.test(document.querySelector('#${app}-data-safety-message')?.textContent||'')`,15000,'partial success exposed');
  assert.equal(c.mock.rows(table,`user:${USER_A}`,{list_type:type})[0][field].length,1,'failed surface still has prior remote contents');
  await page.waitFor(`(()=>{const b=document.querySelector('#${app}-sync-retry');return b&&!b.hidden&&!b.disabled})()`,15000,'partial restore exposes retry after in-flight work settles');
  rule.times=rule.hits;
  const retry=await page.evaluate(`(()=>{const b=document.querySelector('#${app}-sync-retry');if(!b||b.hidden)return false;b.click();return true})()`);assert(retry);
  await writeObserved(c.mock,app,APPS[app].replacement);
  await H.waitUntil(()=>c.mock.rows(table,`user:${USER_A}`,{list_type:type})[0][field].length===0,'remaining restore surface synchronized');
  await boot(page,c.web,app);await expectList(page,app,APPS[app].replacement);
  assert.equal(c.mock.rows(table,`user:${USER_A}`,{list_type:type})[0][field].length,0);
  assert.equal(c.mock.trace.filter(t=>t.method==='DELETE'&&t.table==='pack_progress').length,0,'restore does not delete-before-reinsert pack progress');
});

test('Movies explicit anonymous recovery keeps account order and does not resurrect removed Watch next', ['DS-006','DS-013'],async c=>{
  seedRemote(c.mock,'movies');
  const browser=await H.launchBrowser({name:'anonymous-consent',mockUrl:c.mock.url,appUrl:c.web.url});c.browsers.push(browser);
  const page=await browser.firstPage();
  await H.seedOwnedStorage(page,c.web.url,{key:'stackrank:movies:safety:v1',owner:'anonymous',entries:{
    'stackrank:movies:v1':{movies:[M.m4],updated_at:T},
    'stackrank:suggestion-queues:v1':{watchList:[queued('Anonymous Watch',2002,900888)],notInterestedList:[],updated_at:T},
  }});
  await H.seedStorage(page,c.web.url,{[H.AUTH_STORAGE_KEY]:c.mock.issueSession(USER_A)},{clear:false});
  await boot(page,c.web,'movies');await expectList(page,'movies',APPS.movies.items);
  await page.waitFor(`document.querySelector('#movies-recovery-choice')?.options.length>0`);
  assert.equal(await page.evaluate(`document.querySelector('#movies-recovery-add').disabled`),true,'review required before adding');
  await page.evaluate(`document.querySelector('#movies-recovery-preview-button').click()`);
  await page.waitFor(`!document.querySelector('#movies-recovery-add').disabled`);
  await page.evaluate(`document.querySelector('#movies-recovery-add').click()`);
  await writeObserved(c.mock,'movies',[...APPS.movies.items,M.m4]);await expectList(page,'movies',[...APPS.movies.items,M.m4]);
  await page.waitFor(`document.querySelector('#watch-list')?.textContent.includes('Anonymous Watch')`);
  await page.evaluate(`document.querySelector('#watch-list [data-action="remove"]').click()`);
  await H.waitUntil(()=>c.mock.rows('movie_lists',`user:${USER_A}`,{list_type:'watch'})[0]?.movies.length===0,'removed imported queue entry saved');
  await boot(page,c.web,'movies');await expectList(page,'movies',[...APPS.movies.items,M.m4]);
  assert.equal(await page.evaluate(`document.querySelector('#watch-list').textContent.includes('Anonymous Watch')`),false);
});

for(const app of Object.keys(APPS)) test(`${app} delayed sharing response is ignored after A to B to A`, ['DS-017'],async c=>{
  seedRemote(c.mock,app);seedRemote(c.mock,app,USER_B,APPS[app].private);
  const {page,browser}=await newDevice(c,app);await expectList(page,app,APPS[app].items);
  const table=app==='movies'?'shared_lists':'category_shared_lists';
  const gate=H.deferred(),rule=c.mock.rule({name:'held-publish',method:'POST',table,hold:gate});
  if(app==='movies') await page.evaluate(`document.querySelector('#share-list').click()`);
  const publish=app==='movies'?'#share-link-publish':'#dogs-share-publish';
  await page.waitFor(`(()=>{const b=document.querySelector(${JSON.stringify(publish)});return b&&!b.hidden&&!b.disabled})()`);
  await page.evaluate(`document.querySelector(${JSON.stringify(publish)}).click()`);await H.waitUntil(()=>rule.hits>=1,'A publish pending');
  const switcher=await browser.newTab('switch-B');await switcher.navigate(`${c.web.url}/${app}${magicHash(c.mock.issueSession(USER_B))}`);await expectOwnerState(c,switcher,app,APPS[app].private,'b@safety.test');
  await page.waitFor(`document.querySelector(${JSON.stringify(APPS[app].auth)})?.textContent.includes('b@safety.test')`);
  await switcher.navigate(`${c.web.url}/__audit_blank`);await switcher.navigate(`${c.web.url}/${app}${magicHash(c.mock.issueSession(USER_A))}`);
  await expectOwnerState(c,switcher,app,APPS[app].items,'a@safety.test');
  await page.waitFor(`document.querySelector(${JSON.stringify(APPS[app].auth)})?.textContent.includes('a@safety.test')`);
  gate.resolve();await H.waitUntil(()=>c.mock.trace.some(t=>t.rule==='held-publish'&&t.completed),'old generation publish response returned');
  assert.equal(c.mock.rows(table,`user:${USER_B}`).length,0,'A publication never writes B snapshot');
  const oldSlug=c.mock.rows(table,`user:${USER_A}`)[0]?.slug;assert(oldSlug,'authorized A request may complete on A');
  const card=app==='movies'?'#share-link-card':'#dogs-share-link-card';
  assert.equal(await page.evaluate(`(()=>{const card=document.querySelector(${JSON.stringify(card)});return card&&!card.hidden&&card.textContent.includes(${JSON.stringify(oldSlug)})})()`),false,'old response does not reactivate the former session link');
  // Return to A through a NEW session. Earlier request generations must stay
  // invalid even when the user ID becomes equal again (ABA owner schedule).
  await boot(page,c.web,app);await expectList(page,app,APPS[app].items);
});

for(const app of Object.keys(APPS)) test(`${app} stale same-owner read cannot undo acknowledged edit`, ['DS-004','DS-010'],async c=>{
  seedRemote(c.mock,app);const {page}=await newDevice(c,app);await expectList(page,app,APPS[app].items);
  const gate=H.deferred(),rule=c.mock.rule({name:'captured-old-read',method:'GET',table:APPS[app].table,afterHold:gate});
  await page.evaluate(`window.dispatchEvent(new Event('online'))`);
  await H.waitUntil(()=>c.mock.trace.some(t=>t.rule==='captured-old-read'&&t.responseCaptured),'old response captured before edit');
  await remove(page,app,0);
  const expected=APPS[app].items.slice(1);
  await page.waitFor(`(()=>{const d=JSON.parse(localStorage.getItem('stackrank:${app}:safety:v1'));const r=JSON.parse(d.owners['user:${USER_A}'].raw[${JSON.stringify(APPS[app].key)}]);return r[${JSON.stringify(APPS[app].field)}].length===${expected.length}})()`);
  // Release only after local durability; implementations may safely serialize
  // the write behind this read or let CAS acknowledge before it completes.
  gate.resolve();await H.waitUntil(()=>c.mock.trace.some(t=>t.rule==='captured-old-read'&&t.completed),'stale captured response released');
  await writeObserved(c.mock,app,expected);await expectList(page,app,expected);
  await boot(page,c.web,app);await expectList(page,app,expected);
});

for(const app of Object.keys(APPS)) test(`${app} auth initialization timeout keeps owner unresolved until late session`, ['DS-001','DS-007'],async c=>{
  seedRemote(c.mock,app);const {page}=await newDevice(c,app);await expectList(page,app,APPS[app].items);
  const expired=c.mock.issueSession(USER_A,{expiresIn:-3600});
  const gate=H.deferred(),rule=c.mock.rule({name:'auth-init-held',path:'/auth/v1/token',hold:gate});
  await H.seedStorage(page,c.web.url,{[H.AUTH_STORAGE_KEY]:expired},{clear:false});await page.navigate(`${c.web.url}/${app}`);
  await H.waitUntil(()=>rule.hits>=1,'auth refresh pending');
  await page.waitFor(`performance.now()>3700`,10000,'real auth deadline passed');
  await expectList(page,app,[]);
  await page.evaluate(`document.querySelector(${JSON.stringify(APPS[app].clear)}).click()`);
  assert.deepEqual(ids(app,remote(c.mock,app)[APPS[app].field]),ids(app,APPS[app].items));
  const state=await page.evaluate(`JSON.parse(localStorage.getItem('stackrank:${app}:safety:v1'))`);
  assert(!state.owners.anonymous||!Object.keys(state.owners.anonymous.raw).length,'unresolved auth does not adopt private data anonymously');
  gate.resolve();await expectList(page,app,APPS[app].items);
  await boot(page,c.web,app);await expectList(page,app,APPS[app].items);
});

for(const app of Object.keys(APPS)) test(`${app} Use account response cannot replace new account session`, ['DS-001','DS-007'],async c=>{
  seedRemote(c.mock,app);seedRemote(c.mock,app,USER_B,APPS[app].private);
  const {page,browser}=await newDevice(c,app);await expectList(page,app,APPS[app].items);
  remote(c.mock,app).updated_at='2026-09-23T00:00:00Z';
  await remove(page,app,0);
  const use=app==='movies'?'#movies-use-account':'#dogs-use-account-copy';
  await page.waitFor(`(()=>{const b=document.querySelector(${JSON.stringify(use)});return b&&!b.hidden&&!b.disabled})()`);
  const gate=H.deferred(),rule=c.mock.rule({name:'use-old-account',method:'GET',table:APPS[app].table,when:ctx=>ctx.role.sub===USER_A,afterHold:gate});
  await page.evaluate(`document.querySelector(${JSON.stringify(use)}).click()`);
  await H.waitUntil(()=>c.mock.trace.some(t=>t.rule==='use-old-account'&&t.responseCaptured),'explicit replacement response captured');
  const switcher=await browser.newTab('switch-owner');await switcher.navigate(`${c.web.url}/${app}${magicHash(c.mock.issueSession(USER_B))}`);await expectOwnerState(c,switcher,app,APPS[app].private,'b@safety.test');
  gate.resolve();await H.waitUntil(()=>c.mock.trace.some(t=>t.rule==='use-old-account'&&t.completed),'old explicit replacement released');
  await page.waitFor(`document.querySelector(${JSON.stringify(APPS[app].auth)})?.textContent.includes('b@safety.test')`);
  await expectOwnerState(c,page,app,APPS[app].private,'b@safety.test',{reload:true});
  await boot(page,c.web,app,'b@safety.test');await expectList(page,app,APPS[app].private);
  assert.deepEqual(ids(app,remote(c.mock,app,USER_B)[APPS[app].field]),ids(app,APPS[app].private));
});

for(const app of Object.keys(APPS)) test(`${app} resolved recovery capacity remains downloadable and dismissible`, ['DS-012'],async c=>{
  seedRemote(c.mock,app);
  const browser=await H.launchBrowser({name:'capacity',mockUrl:c.mock.url,appUrl:c.web.url});c.browsers.push(browser);const page=await browser.firstPage();
  await H.seedStorage(page,c.web.url,{[H.AUTH_STORAGE_KEY]:c.mock.issueSession(USER_A)});
  await H.seedOwnedStorage(page,c.web.url,{key:`stackrank:${app}:safety:v1`,owner:`user:${USER_A}`,entries:{[APPS[app].key]:{[APPS[app].field]:APPS[app].items,updated_at:T}}});
  await page.evaluate(`(()=>{const k='stackrank:${app}:safety:v1',d=JSON.parse(localStorage.getItem(k));d.recoveries=Array.from({length:8},(_,i)=>({id:'capacity-'+i,owner:'user:${USER_A}',reason:'capacity-fixture-'+i,createdAt:'${T}',raw:d.owners['user:${USER_A}'].raw,remote:{},resolvedBy:['user:${USER_A}']}));localStorage.setItem(k,JSON.stringify(d))})()`);
  await boot(page,c.web,app);await expectList(page,app,APPS[app].items);
  const select=app==='movies'?'#movies-recovery-choice':'#dogs-recovery-list';
  await page.waitFor(`document.querySelector(${JSON.stringify(select)})?.options.length===8`);
  await page.evaluate(`document.querySelector('#${app}-recovery-download').click()`);
  await H.waitUntil(()=>fs.readdirSync(browser.downloads).some(f=>f.endsWith('.json')),'saved recovery download completed');
  const file=fs.readdirSync(browser.downloads).find(f=>f.endsWith('.json'));
  const downloaded=JSON.parse(fs.readFileSync(path.join(browser.downloads,file),'utf8'));
  assert.equal((downloaded.recovery||downloaded).owner,`user:${USER_A}`);
  await page.evaluate(`document.querySelector('#${app}-recovery-dismiss').click()`);
  await page.waitFor(`JSON.parse(localStorage.getItem('stackrank:${app}:safety:v1')).recoveries.length===7`);
  const result=await page.evaluate(`(async()=>{const {createDataSafetyStore}=await import('/lib/data-safety.js');const s=createDataSafetyStore({storage:localStorage,key:'stackrank:${app}:safety:v1'});await s.activate('user:${USER_A}');return s.preserve('after-explicit-dismiss')})()`);
  assert.equal(result.ok,true,'freed capacity admits new recovery without deleting other copies');
});

for(const app of Object.keys(APPS)) test(`${app} session-only failed-storage recovery is owner-filtered and downloadable`, ['DS-001','DS-012'],async c=>{
  seedRemote(c.mock,app);seedRemote(c.mock,app,USER_B,APPS[app].private);
  const {page,browser}=await newDevice(c,app);await expectList(page,app,APPS[app].items);
  await page.evaluate(`(()=>{window.__safetySetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='stackrank:${app}:safety:v1') throw new DOMException('synthetic quota','QuotaExceededError');return window.__safetySetItem.call(this,k,v)}})()`);
  await remove(page,app,0);
  await page.waitFor(`/storage|quota|persist|download|saved|unavailable/i.test(document.querySelector('#${app}-data-safety-message')?.textContent||'')`);
  await page.evaluate(`document.querySelector(${JSON.stringify(APPS[app].signout)}).click()`);await expectList(page,app,[]);
  await page.evaluate(`Storage.prototype.setItem=window.__safetySetItem`);
  const switcher=await browser.newTab('session-owner');await switcher.navigate(`${c.web.url}/${app}${magicHash(c.mock.issueSession(USER_B))}`);await expectOwnerState(c,switcher,app,APPS[app].private,'b@safety.test');await expectOwnerState(c,page,app,APPS[app].private,'b@safety.test');
  const select=app==='movies'?'#movies-recovery-choice':'#dogs-recovery-list';
  assert.equal(await page.evaluate(`[...document.querySelector(${JSON.stringify(select)}).options].some(o=>/session only/i.test(o.textContent))`),false,'B cannot access A RAM-only saved copy');
  await switcher.navigate(`${c.web.url}/__audit_blank`);await switcher.navigate(`${c.web.url}/${app}${magicHash(c.mock.issueSession(USER_A))}`);await expectOwnerState(c,page,app,APPS[app].items,'a@safety.test');
  await page.waitFor(`/session.only|only in this open session/i.test(document.querySelector('#${app}-data-safety-message').textContent)`);
  await page.evaluate(`(()=>{const select=document.querySelector(${JSON.stringify(select)});const option=[...select.options].find(o=>/session only/i.test(o.textContent));if(!option)throw new Error('missing memory recovery');select.value=option.value;select.dispatchEvent(new Event('change'))})()`);
  await captureRecoveryUi(page,app,'session-only');
  await page.evaluate(`document.querySelector('#${app}-recovery-download').click()`);
  await H.waitUntil(()=>fs.readdirSync(browser.downloads).some(f=>f.endsWith('.json')),'RAM-only recovery downloaded');
  const file=fs.readdirSync(browser.downloads).find(f=>f.endsWith('.json'));
  const document=JSON.parse(fs.readFileSync(path.join(browser.downloads,file),'utf8')),copy=document.recovery||document;
  assert.equal(copy.owner,`user:${USER_A}`);assert.equal(copy.memoryOnly,true);
  assert.deepEqual(ids(app,JSON.parse(copy.raw[APPS[app].key])[APPS[app].field]),ids(app,APPS[app].items.slice(1)));
});

test('Dogs explicit account replacement locks later edits until response settles', ['DS-005','DS-010'],async c=>{
  seedRemote(c.mock,'dogs');const {page}=await newDevice(c,'dogs');await expectList(page,'dogs',DOGS);
  remote(c.mock,'dogs').updated_at='2026-09-23T00:00:00Z';await remove(page,'dogs',0);
  await page.waitFor(`!document.querySelector('#dogs-use-account-copy').hidden`);
  const gate=H.deferred();c.mock.rule({name:'account-replacement',method:'GET',table:'category_rankings',afterHold:gate});
  await page.evaluate(`document.querySelector('#dogs-use-account-copy').click()`);
  await H.waitUntil(()=>c.mock.trace.some(t=>t.rule==='account-replacement'&&t.responseCaptured),'replacement response pending');
  const before=await page.evaluate(APPS.dogs.titles);
  await remove(page,'dogs',0);
  assert.deepEqual(await page.evaluate(APPS.dogs.titles),before,'editing locked before replacing account copy');
  gate.resolve();await expectList(page,'dogs',DOGS);await boot(page,c.web,'dogs');await expectList(page,'dogs',DOGS);
});

test('Movies remote queue cannot send a newer edit before its local Web Lock save', ['DS-004','DS-011'],async c=>{
  seedRemote(c.mock,'movies');const {page,browser}=await newDevice(c,'movies');await expectList(page,'movies',APPS.movies.items);
  const gate=H.deferred();c.mock.rule({name:'prior-write',table:'rankings',when:ctx=>['PATCH','POST'].includes(ctx.method),hold:gate});
  await remove(page,'movies',0);await H.waitUntil(()=>c.mock.trace.some(t=>t.rule==='prior-write'&&t.held),'first remote write held');
  const locker=await browser.newTab('local-lock');await locker.navigate(`${c.web.url}/__audit_blank`);
  await locker.evaluate(`(()=>{window.__held=false;window.__lock=navigator.locks.request('stackrank:data-safety:stackrank:movies:safety:v1',async()=>{window.__held=true;await new Promise(r=>window.__release=r)});return true})()`);
  await locker.waitFor('window.__held===true');
  await remove(page,'movies',0);
  gate.resolve();await H.waitUntil(()=>c.mock.trace.some(t=>t.rule==='prior-write'&&t.completed),'prior write response delivered');
  await page.send('Page.bringToFront');
  await page.evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  const candidateWrites=()=>c.mock.trace.filter(t=>t.table==='rankings'&&['PATCH','POST'].includes(t.method)&&t.body?.movies?.length===1);
  assert.equal(candidateWrites().length,0,'newer snapshot cannot escape while its local save is blocked');
  await locker.evaluate('window.__release();true');
  await writeObserved(c.mock,'movies',APPS.movies.items.slice(2));
  const stored=await page.evaluate(`JSON.parse(JSON.parse(localStorage.getItem('stackrank:movies:safety:v1')).owners['user:${USER_A}'].raw['stackrank:movies:v1']).movies`);
  assert.deepEqual(ids('movies',stored),ids('movies',APPS.movies.items.slice(2)));
  await boot(page,c.web,'movies');await expectList(page,'movies',APPS.movies.items.slice(2));
});

async function run() {
  const selected=tests.filter(t=>!process.env.DATA_SAFETY_ONLY||t.name.toLowerCase().includes(process.env.DATA_SAFETY_ONLY.toLowerCase()));
  assert(selected.length,'test filter selected no tests');
  const fingerprint=()=>Object.fromEntries(['app.js','dogs.js','lib/data-safety.js','lib/movies-data-safety.js','lib/category-remote-persistence.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(H.SNAPSHOT,file))).digest('hex')]));
  const report={startedAt:new Date().toISOString(),sourceRoot:H.SNAPSHOT,sourceHashes:fingerprint(),tests:[]};
  for(const t of selected){
    const c={mock:new H.MockSupabase(),browsers:[]}; c.mock.addUser(USER_A,'a@safety.test'); c.mock.addUser(USER_B,'b@safety.test');
    await c.mock.start(); c.web=await H.startStaticServer();
    const result={name:t.name,findings:t.findings,startedAt:new Date().toISOString()};
    try{await t.run(c);result.status='passed';}catch(e){result.status='failed';result.error=e.stack||String(e);}
    finally{
      result.dom=[];
      for(const b of c.browsers) for(const p of b.pages) try { result.dom.push({page:p.label,state:await p.evaluate(`({url:location.pathname,safety:{movies:JSON.parse(localStorage.getItem('stackrank:movies:safety:v1')||'null'),dogs:JSON.parse(localStorage.getItem('stackrank:dogs:safety:v1')||'null')},movies:[...document.querySelectorAll('#ranking .ranking__title')].map(e=>e.textContent),dogs:[...document.querySelectorAll('#dogs-ranking .ranking-row')].map(e=>e.dataset.key),status:[...document.querySelectorAll('#api-status,#settings-auth-state,#dogs-account-state,#dogs-remote-gate-note,#movies-data-safety-message,#dogs-data-safety-message')].map(e=>({id:e.id,text:e.textContent}))})`)}); } catch(_) {}
      result.guardedTransitions=c.guardedTransitions||[];result.trace=c.mock.trace; result.database=c.mock.snapshotDb(); result.events=c.browsers.flatMap(b=>b.pages.flatMap(p=>p.events)); result.network=c.browsers.flatMap(b=>b.external);
      const uncaught=result.events.filter(event=>event.type==='exception');
      if(uncaught.length){result.status='failed';result.error=[result.error,`Uncaught browser exception(s): ${uncaught.map(event=>event.text).join(' | ')}`].filter(Boolean).join('\n');}
      for(const b of c.browsers) await b.close(); await c.mock.close(); await c.web.close();
    }
    report.tests.push(result);fs.writeFileSync(path.join(reportDir,'results.json'),JSON.stringify(report,null,2));
    console.log(`${result.status.toUpperCase()} ${t.name}${result.error?'\n'+result.error:''}`);
  }
  H.cleanProfiles();report.finishedAt=new Date().toISOString();report.finalSourceHashes=fingerprint();report.sourceChangedDuringRun=JSON.stringify(report.sourceHashes)!==JSON.stringify(report.finalSourceHashes);report.passed=report.tests.filter(t=>t.status==='passed').length;report.failed=report.tests.length-report.passed;
  fs.writeFileSync(path.join(reportDir,'results.json'),JSON.stringify(report,null,2));console.log(`Report ${reportDir}/results.json (${report.passed} passed, ${report.failed} failed)`);process.exitCode=report.failed?1:0;
}
run().catch(e=>{console.error(e);H.cleanProfiles();process.exitCode=1;});
