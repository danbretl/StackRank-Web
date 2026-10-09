'use strict';
// Mandatory keyboard regressions. Uses existing zero-dependency Chrome/CDP and
// local synthetic Supabase helpers. Never fetches customer data or production.
// evaluate().focus() appears only in boot(), to initialize a fixture's starting
// point. Every action after that uses real Input.dispatchKeyEvent key events.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
if (process.env.A11Y_CDP_SERVE_ROOT) process.env.DATA_SAFETY_SERVE_ROOT = process.env.A11Y_CDP_SERVE_ROOT;
const H = require('./testing/data-safety-browser.cjs');
const { USER_A, MOVIES, dog } = require('./testing/data-safety-fixtures.cjs');
const reportDir = path.resolve(process.env.A11Y_CDP_REPORT_DIR || path.join(H.SOURCE_ROOT, 'reports/accessibility-cdp', new Date().toISOString().replace(/[:.]/g, '-')));
fs.mkdirSync(reportDir, { recursive: true });
const T = '2026-10-09T00:00:00.000Z';
const dogs = [dog('VBO:0200162', 'Bichon Frise'), dog('VBO:0201396', 'Water Dog')];
const queuedDog = dog('VBO:0200329', 'Chi-Poo');
const tests = [];
const test = (name, run) => tests.push({ name, run });
const active = p => p.evaluate(`({id:document.activeElement?.id,tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.trim().slice(0,80),disabled:Boolean(document.activeElement?.disabled)})`);
async function key(c, p, name, shift = false) {
  // Native Chrome can hide a headless target between interactions. A hidden
  // document may defer native dialog close events even while CDP accepts keys.
  // Establish browser visibility, not DOM focus, before testing user input.
  await p.send('Page.bringToFront');
  await p.waitFor("document.visibilityState === 'visible'",2500,'keyboard target is visible');
  const visibilityBefore=await p.evaluate('document.visibilityState');
  assert.equal(visibilityBefore,'visible','keyboard interaction targets a visible page');
  const code = { Tab:9, Enter:13, Escape:27 }[name];
  assert(code, `Unsupported test key ${name}`);
  const data = { key:name, code:name, windowsVirtualKeyCode:code, nativeVirtualKeyCode:code, modifiers:shift ? 8 : 0 };
  // CDP modifiers: Alt=1, Ctrl=2, Meta=4, Shift=8.
  await p.send('Input.dispatchKeyEvent', { type:'keyDown', ...data, ...(name==='Enter'?{text:'\r',unmodifiedText:'\r'}:{}) });
  await p.send('Input.dispatchKeyEvent', { type:'keyUp', ...data });
  c.keys.push({key:name,shift,visibilityBefore,focus:await active(p)});
}
async function tabTo(c, p, selector, {reverse=false,limit=100}={}) {
  for (let n=0;n<=limit;n++) {
    if (await p.evaluate(`document.activeElement?.matches(${JSON.stringify(selector)})`)) return;
    if (n===limit) throw new Error(`Keyboard could not reach ${selector}; last focus ${JSON.stringify(await active(p))}`);
    await key(c,p,'Tab',reverse);
  }
}
async function activate(c,p,selector,options) { await tabTo(c,p,selector,options); await key(c,p,'Enter'); }
async function expectFocus(p,selector) {
  await p.waitFor(`document.activeElement?.matches(${JSON.stringify(selector)})`,2500,`focus restored to ${selector}`);
  assert(await p.evaluate(`document.activeElement.isConnected && !document.activeElement.disabled && document.activeElement.getClientRects().length>0`),'focus target remains visible and enabled');
}
async function boot(c, app, {signedIn=true,queue=false}={}) {
  const mock = new H.MockSupabase();mock.addUser(USER_A,'keyboard@accessibility.test');await mock.start();c.mocks.push(mock);
  if (signedIn) {
    mock.db[app==='movies'?'rankings':'category_rankings'].push({list_id:`user:${USER_A}`,...(app==='dogs'?{category:'dogs',items:dogs}:{movies:[MOVIES.m1,MOVIES.m2,MOVIES.m3].map(item=>({...item,posterPath:null}))}),updated_at:T});
    if(queue)mock.db.category_lists.push({list_id:`user:${USER_A}`,category:'dogs',list_type:'curious',items:[queuedDog],updated_at:T});
  }
  const browser=await H.launchBrowser({name:`a11y-${app}-${c.browsers.length}`,mockUrl:mock.url,appUrl:c.web.url});c.browsers.push(browser);
  const p=await browser.firstPage();await H.seedStorage(p,c.web.url,signedIn?{[H.AUTH_STORAGE_KEY]:mock.issueSession(USER_A)}:{});
  c.browserVersions.push(await p.send('Browser.getVersion'));
  await p.navigate(`${c.web.url}/${app}?debug=1`);await p.send('Page.bringToFront');
  await p.waitFor(`document.documentElement.dataset.${app}PersistenceReady==='true'`,25000);
  if(app==='dogs')await p.waitFor(`document.querySelector('#dogs-catalog-status')?.dataset.ready==='true'`,25000);
  assert((await p.evaluate('document.title')).includes('StackRank'),'page identity');
  assert((await p.evaluate('document.body.innerText.length'))>100,'rendered meaningful application');
  // Fixture initialization only, not a tested interaction or restoration proof.
  const start=app==='dogs'?'#dogs-settings-toggle':'button[data-app-destination-target="ranking"]';
  await p.evaluate(`document.querySelector(${JSON.stringify(start)}).focus()`);
  await p.evaluate(`(()=>{window.__a11yNativeCloseEvents=[];document.addEventListener('close',event=>{if(event.target instanceof HTMLDialogElement)window.__a11yNativeCloseEvents.push({dialog:event.target.id,open:event.target.open,visibility:document.visibilityState,time:performance.now()});},true)})()`);
  c.initialFocus.push({app,selector:start});return {p,mock,browser};
}
async function namedDialog(p,dialog,name) {
  await p.waitFor(`document.querySelector(${JSON.stringify(dialog)}).open`);
  const ax=await p.send('Accessibility.getFullAXTree');
  assert(ax.nodes.some(n=>!n.ignored&&n.role?.value==='dialog'&&n.name?.value===name),`exposed dialog name is ${name}`);
}
async function screenshot(c,p,label) {
  await p.send('Page.bringToFront');
  const shot=await p.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const file=`${c.index}-${label}.png`;fs.writeFileSync(path.join(reportDir,file),Buffer.from(shot.data,'base64'));c.screenshots.push(file);
}
for(const [kind,trigger,name] of [['signin','#dogs-sign-in','Sign in to sync Dogs'],['backup','#dogs-open-backup','Backup & import'],['export','#dogs-open-export','Export ranking']]) {
  test(`Dogs Settings ${kind}: accessible name, reverse Tab, Escape and close return`,async c=>{
    const {p}=await boot(c,'dogs',{signedIn:false});const dialog=`#dogs-${kind}-dialog`;
    for(const mechanism of ['Escape','close']) {
      await key(c,p,'Enter');await activate(c,p,trigger);
      await namedDialog(p,dialog,name);
      await key(c,p,'Tab');await key(c,p,'Tab',true);
      assert(await p.evaluate(`document.querySelector(${JSON.stringify(dialog)}).contains(document.activeElement)`),'reverse Tab remains within modal');
      if(mechanism==='Escape')await key(c,p,'Escape');
      else await activate(c,p,`${dialog} .dialog-close-form button`,{reverse:true});
      await p.waitFor(`!document.querySelector(${JSON.stringify(dialog)}).open`);
      await expectFocus(p,'#dogs-settings-toggle');
    }
    await screenshot(c,p,`${kind}-restored`);
  });
}
for(const mechanism of ['Escape','cancel button'])test(`Dogs queued ranking ${mechanism} restores Rank button`,async c=>{
  const {p,mock}=await boot(c,'dogs',{queue:true});const selector='#dogs-curious-list .secondary-item__actions button:first-child';
  await activate(c,p,'button[data-destination="you"]',{reverse:true});await activate(c,p,selector);
  await p.waitFor(`document.body.classList.contains('is-comparing')`);
  if(mechanism==='Escape'){await tabTo(c,p,'#dogs-cancel-comparison');await key(c,p,'Escape');}else await activate(c,p,'#dogs-cancel-comparison');
  await p.waitFor(`!document.body.classList.contains('is-comparing')`);await expectFocus(p,selector);
  assert.deepEqual(mock.db.category_lists[0].items,[queuedDog],'cancel preserves queued data');
  assert.deepEqual(mock.db.category_rankings[0].items,dogs,'cancel preserves ranking');
  await screenshot(c,p,'queue-restored');
});
async function openPublish(c,p,app) {
  if(app==='dogs') {
    await key(c,p,'Enter');await activate(c,p,'#dogs-open-export');
    await p.waitFor(`document.querySelector('#dogs-export-dialog').open`);
  } else {
    await key(c,p,'Enter');await activate(c,p,'#share-list');
    await p.waitFor(`!document.querySelector('#share-studio').hidden`);
    await activate(c,p,'summary:has(#share-link-meta)');
  }
  const publish=app==='dogs'?'#dogs-share-publish':'#share-link-publish';
  await p.waitFor(`!document.querySelector(${JSON.stringify(publish)}).disabled`);
  await tabTo(c,p,publish);return publish;
}
for(const app of ['movies','dogs'])for(const outcome of ['success','error'])test(`${app} publish ${outcome}: held-request focus and no late theft`,async c=>{
  for(const action of ['move','close']) {
    const {p,mock}=await boot(c,app);const publish=await openPublish(c,p,app);const hold=H.deferred();c.holds.push(hold);
    const rule=mock.rule({name:`held-publish-${outcome}`,method:'POST',table:app==='movies'?'shared_lists':'category_shared_lists',hold,...(outcome==='error'?{response:{status:500,body:{code:'A11Y_SYNTHETIC',message:'Synthetic publishing failure'}}}:{})});
    await key(c,p,'Enter');await H.waitUntil(()=>rule.hits===1,'publish request held');
    const close=app==='movies'?'#share-close':'#dogs-export-dialog .dialog-close-form button';
    await expectFocus(p,close);
    assert(await p.evaluate(`document.querySelector(${JSON.stringify(publish)}).disabled`),'publish is unavailable while request is held');
    if(action==='move')await key(c,p,'Tab');
    else {await key(c,p,'Escape');await p.waitFor(app==='movies'?`document.querySelector('#share-studio').hidden`:`!document.querySelector('#dogs-export-dialog').open`);await expectFocus(p,app==='movies'?'#share-list':'#dogs-settings-toggle');}
    const expected=await active(p);assert.notEqual(expected.tag,'BODY','user keeps a concrete keyboard position');
    await p.evaluate('window.__a11yExpectedFocus=document.activeElement');hold.resolve();
    await H.waitUntil(()=>mock.trace.some(t=>t.rule===rule.name&&t.completed),'held response completed');
    const settled=outcome==='success'?(app==='movies'?`!document.querySelector('#share-link-card').hidden`:`!document.querySelector('#dogs-share-link-card').hidden`):(app==='movies'?`document.querySelector('#share-link-status').textContent.includes('Could not publish')`:`document.querySelector('#dogs-share-status').textContent.includes('Could not save')`);
    await p.waitFor(settled);
    assert(await p.evaluate('document.activeElement===window.__a11yExpectedFocus'),'async completion does not steal moved/restored focus');
    c.completions.push({app,outcome,action,focus:await active(p)});
    if(action==='move')await screenshot(c,p,`${app}-${outcome}`);
  }
});
async function main() {
  const files=['app.js','dogs.js','dogs.html'];const hashes=()=>Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(H.SNAPSHOT,f))).digest('hex')]));
  const report={startedAt:new Date().toISOString(),serveRoot:H.SNAPSHOT,sourceHashes:hashes(),browser:'Chrome/CDP, existing repository helper; Browser plugin unavailable',input:'Actual Input.dispatchKeyEvent Tab/Shift+Tab/Enter/Escape. evaluate focus only initializes each fixture. No DOM click calls.',tests:[]};
  const web=await H.startStaticServer();
  try {for(const [index,t] of tests.entries()) {
    if(process.env.A11Y_CDP_ONLY&&!t.name.includes(process.env.A11Y_CDP_ONLY))continue;
    const c={index,web,mocks:[],browsers:[],holds:[],keys:[],initialFocus:[],screenshots:[],completions:[],browserVersions:[]};const result={name:t.name,status:'failed'};
    try {
      await t.run(c);
      for(const b of c.browsers)for(const p of b.pages) {
        assert.deepEqual(await p.evaluate('window.__auditDenied'),[],'no unexpected app fetch');
        const errors=p.events.filter(e=>e.type==='exception'||e.type==='console'&&['error','warning','warn'].includes(e.level)&&!(/publish error/.test(t.name)&&/Could not (publish shared list link|save Dogs public snapshot)/.test(e.text)));
        assert.deepEqual(errors,[],'no unexplained console error');
      }
      result.status='passed';
    }catch(e){result.error=e.stack||String(e);}
    finally {
      result.keyboard=c.keys;result.initialFocus=c.initialFocus;result.screenshots=c.screenshots;result.completions=c.completions;
      result.browserVersions=c.browserVersions;result.nativeDialogs=[];
      for(const b of c.browsers)for(const p of b.pages)try{result.nativeDialogs.push(await p.evaluate(`({pageVisibility:document.visibilityState,hasFocus:document.hasFocus(),closeEvents:window.__a11yNativeCloseEvents||[]})`));}catch{}
      result.mockTrace=c.mocks.flatMap(m=>m.trace);result.browserEvents=c.browsers.flatMap(b=>b.pages.flatMap(p=>p.events));result.network=c.browsers.flatMap(b=>b.external);
      for(const hold of c.holds)hold.resolve();for(const b of c.browsers)await b.close();for(const mock of c.mocks)await mock.close();
    }
    report.tests.push(result);fs.writeFileSync(path.join(reportDir,'results.json'),JSON.stringify(report,null,2));
    console.log(`${result.status.toUpperCase()} ${t.name}${result.error?'\n'+result.error:''}`);
  }}finally {await web.close();}
  assert(report.tests.length,'no cases selected');report.finalSourceHashes=hashes();report.sourceChangedDuringRun=JSON.stringify(report.sourceHashes)!==JSON.stringify(report.finalSourceHashes);report.passed=report.tests.filter(t=>t.status==='passed').length;report.failed=report.tests.length-report.passed;report.finishedAt=new Date().toISOString();
  fs.writeFileSync(path.join(reportDir,'results.json'),JSON.stringify(report,null,2));console.log(`Report ${reportDir}/results.json (${report.passed} passed, ${report.failed} failed)`);process.exitCode=report.failed||report.sourceChangedDuringRun?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>H.cleanProfiles());
