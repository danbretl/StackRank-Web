'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const H=require('./testing/accessibility-browser.cjs');
const reportDir=path.resolve(process.env.A11Y_REPORT_DIR||path.join(__dirname,'../reports/accessibility',new Date().toISOString().replace(/[:.]/g,'-')));
fs.mkdirSync(reportDir,{recursive:true});
const baseline=process.env.A11Y_BASELINE==='1',tests=[];
const test=(name,app,run,options={})=>tests.push({name,app,run,options});
const nav=(app,d)=>app==='movies'?`[data-app-destination-target="${d}"]`:`[data-destination="${d}"]`;
const settings=app=>app==='movies'?'#ranking-settings-toggle':'#dogs-settings-toggle';
const share={movies:{publish:'#share-link-publish',update:'#share-link-update',close:'#share-close',dialog:'#share-studio',status:'#share-link-status',table:'shared_lists'},dogs:{publish:'#dogs-share-publish',update:'#dogs-share-update',close:'#dogs-export-dialog .dialog-close-form button',dialog:'#dogs-export-dialog',status:'#dogs-share-status',table:'category_shared_lists'}};
async function focused(p,selector){await p.waitForFunction(selector=>document.querySelector(selector)===document.activeElement,selector);}
async function usefulFocus(p,within){const a=await H.active(p);assert.notEqual(a.tag,'BODY','focus remains on a usable control');assert(a.visible&&!a.disabled,'focused element visible and enabled');if(within)assert(await p.locator(within).evaluate(e=>e.contains(document.activeElement)),'focus stays in open dialog');return a;}
async function openShare(p,app,engine){if(app==='movies'){await H.activate(p,nav(app,'ranking'),engine);await H.activate(p,'#share-list',engine);await H.activate(p,'#share-studio details:has(#share-link-publish) summary',engine);}else{await H.activate(p,settings(app),engine);await H.activate(p,'#dogs-open-export',engine);}await p.locator(share[app].publish).waitFor({state:'visible'});}
async function cycle(p,selector,engine){const trace=[];const count=await p.locator(selector).evaluate(root=>[...root.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(e=>e.tabIndex>=0&&!e.matches(':disabled')&&e.getClientRects().length).length);
 for(const reverse of [false,true])for(let i=0;i<count+3;i++){await p.keyboard.press(H.tabKey(engine,reverse));const a=await H.active(p),inside=await p.locator(selector).evaluate(e=>e.contains(document.activeElement));trace.push({reverse,...a,inside});assert(inside||a.tag==='BODY','native dialog must not focus background page controls');}return trace;}

for(const app of ['movies','dogs']){
 test('phone-settings-dialog',app,async({page:p},engine)=>{
   await p.setViewportSize({width:390,height:844});await H.activate(p,settings(app),engine);await H.activate(p,app==='movies'?'#settings-sign-in':'#dogs-sign-in',engine);
   const dialog=app==='movies'?'#signin-overlay':'#dogs-signin-dialog';await p.locator(dialog).waitFor({state:'visible'});
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'phone dialog does not overflow');
   await usefulFocus(p,dialog);await p.screenshot({path:path.join(reportDir,`${engine}-${app}-phone-dialog-open.png`)});
   await p.keyboard.press('Escape');await focused(p,settings(app));return {width:390,height:844,after:await H.active(p)};
 },{signedIn:false});
 test('settings-escape',app,async({page:p},engine)=>{await H.activate(p,settings(app),engine);await H.tabTo(p,app==='dogs'?'#dogs-sign-in':'#settings-sign-in',engine);await p.keyboard.press('Escape');await focused(p,settings(app));return {focus:await H.active(p)};},{signedIn:false});
 for(const type of app==='dogs'?['signin','backup','export']:['signin'])test(`settings-dialog-${type}`,app,async({page:p},engine)=>{
   const opener=app==='movies'?'#settings-sign-in':{signin:'#dogs-sign-in',backup:'#dogs-open-backup',export:'#dogs-open-export'}[type];
   const dialog=app==='movies'?'#signin-overlay [role=dialog]':`#dogs-${type}-dialog`;
   const close=app==='movies'?'#signin-close':`${dialog} .dialog-close-form button`;const rounds=[];
   for(const method of ['Escape','Close','Escape','Close']){
     await H.activate(p,settings(app),engine);await H.activate(p,opener,engine);await p.locator(dialog).waitFor({state:'visible'});
     const aria=await p.locator(dialog).ariaSnapshot();const first=aria.split('\n')[0];
     if(method==='Escape')await p.keyboard.press('Escape');else await H.activate(p,close,engine);
     await H.settle(p);const restored=await H.active(p);rounds.push({method,aria:first,restored});
     assert(first.includes('dialog "'),'dialog has a descriptive computed accessible name');
     await focused(p,settings(app));
   }
   return {rounds};
 },{signedIn:false});
 for(const method of ['Escape','Cancel'])test(`queue-cancel-${method}`,app,async({page:p,mock},engine)=>{
   await H.activate(p,nav(app,'you'),engine);
   const selector=app==='movies'?'#watch-list button[aria-label^="Rank "]':'#dogs-curious-list .secondary-item__actions button:first-child';
   const queueSelector=app==='movies'?'#watch-list':'#dogs-curious-list';const queueBefore=await p.locator(queueSelector).textContent();await H.tabTo(p,selector,engine);const trigger=await H.active(p);await p.keyboard.press('Enter');
   await p.locator(app==='movies'?'#compare':'#dogs-comparison').waitFor({state:'visible'});
   if(method==='Escape')await p.keyboard.press('Escape');else await H.activate(p,app==='movies'?'#cancel-ranking':'#dogs-cancel-comparison',engine);
   await H.settle(p);const after=await H.active(p);
   assert.equal(await p.locator(queueSelector).textContent(),queueBefore,'queued item retained');
   await focused(p,selector);assert.equal(after.text,trigger.text,'same logical queue Rank control restored');
   return {trigger,after,accountQueue:mock.db[app==='movies'?'movie_lists':'category_lists']};
 });
 for(const outcome of ['success','failure'])for(const movement of ['rest','navigate','close'])test(`publish-${outcome}-${movement}`,app,async({page:p,mock,log},engine)=>{
   const s=share[app];await openShare(p,app,engine);
   const hold=H.H.deferred();const rule=mock.rule({name:'held-publish',method:'POST',table:s.table,hold,...(outcome==='failure'?{response:{status:500,body:{code:'SYNTHETIC',message:'Synthetic write failure'}}}:{})});
   try{
     await H.activate(p,s.publish,engine);await H.H.waitUntil(()=>rule.hits===1,'publish request held');
     const busy=await H.active(p);assert(await p.locator(s.publish).isDisabled(),'publish remains natively disabled while busy');
     if(baseline){hold.resolve();await H.H.waitUntil(()=>mock.trace.some(t=>t.rule==='held-publish'&&t.completed),'publish released');await H.settle(p);const after=await H.active(p);log.observed={busy,after};assert(busy.tag!=='BODY'&&!busy.disabled,'busy control must hand off usable focus');assert.notEqual(after.tag,'BODY','completion retains usable focus');return {busy,after};}
     await usefulFocus(p,s.dialog);
     let before;
     if(movement==='navigate'){await p.keyboard.press(H.tabKey(engine));await usefulFocus(p,s.dialog);before=await H.active(p);}
     if(movement==='close'){await p.keyboard.press('Escape');await p.locator(s.dialog).waitFor({state:'hidden'});await H.settle(p);before=await H.active(p);}
     hold.resolve();await H.H.waitUntil(()=>mock.trace.some(t=>t.rule==='held-publish'&&t.completed),'publish response returned');
     if(outcome==='success')await p.locator(s.update).waitFor({state:movement==='close'?'attached':'visible'});
     else await p.waitForFunction(selector=>/could not|unable|fail/i.test(document.querySelector(selector)?.textContent||''),s.status);
     await H.settle(p);const after=await H.active(p);
     if(movement==='rest')await usefulFocus(p,s.dialog);else assert.deepEqual({id:after.id,text:after.text},{id:before.id,text:before.text},'completion does not steal moved focus');
     if(movement!=='close'){await p.keyboard.press('Escape');await p.locator(s.dialog).waitFor({state:'hidden'});}
     return {busy,before,after,status:await p.locator(s.status).textContent(),writes:mock.trace.filter(t=>t.rule==='held-publish')};
   }finally{hold.resolve();}
 });
}
test('native-dialog-tab-cycle','dogs',async({page:p},engine)=>{await H.activate(p,settings('dogs'),engine);await H.activate(p,'#dogs-open-backup',engine);return {trace:await cycle(p,'#dogs-backup-dialog',engine)};});
for(const outcome of ['success','failure'])test(`publish-status-refresh-${outcome}`,'dogs',async({page:p,mock},engine)=>{
 // Match the already-adopted canonical snapshots. Re-serving the seed's old
 // names/artwork instead would intentionally replace placement and reset work,
 // exercising a different persistence boundary than an unchanged UI refresh.
 const canonical=await p.evaluate(owner=>{const raw=JSON.parse(localStorage.getItem('stackrank:dogs:safety:v1')).owners[owner].raw;return {ranking:JSON.parse(raw['stackrank:dogs:ranking:v1']).items,queues:JSON.parse(raw['stackrank:dogs:queues:v1'])};},`user:${H.F.USER_A}`);
 mock.db.category_rankings[0].items=canonical.ranking;
 for(const row of mock.db.category_lists)row.items=canonical.queues[row.list_type]||[];
 await openShare(p,'dogs',engine);const hold=H.H.deferred();const rule=mock.rule({name:'status-refresh-publish',table:'category_shared_lists',method:'POST',hold,...(outcome==='failure'?{response:{status:500,body:{message:'Synthetic failure',code:'SYNTHETIC'}}}:{})});
 const refresh=async()=>{const count=()=>mock.trace.filter(t=>t.table==='category_pack_progress'&&t.method==='GET'&&t.completed).length;const before=count();await p.evaluate(()=>window.dispatchEvent(new Event('online')));await H.H.waitUntil(()=>count()>before,'ordinary account refresh completed');await H.settle(p);};
 try{
  await H.activate(p,'#dogs-share-publish',engine);await H.H.waitUntil(()=>rule.hits===1,'publish held');
  await p.waitForFunction(()=>/Publishing/.test(document.querySelector('#dogs-share-status').textContent));const pending=await p.locator('#dogs-share-status').textContent();
  await refresh();assert.equal(await p.locator('#dogs-share-status').textContent(),pending,'account refresh preserves pending announcement');
  hold.resolve();await H.H.waitUntil(()=>mock.trace.some(t=>t.rule==='status-refresh-publish'&&t.completed),'publish completed');
  await p.waitForFunction(outcome=>outcome==='success'?!document.querySelector('#dogs-share-update').hidden:/Could not save/.test(document.querySelector('#dogs-share-status').textContent),outcome);
  const completed=await p.locator('#dogs-share-status').textContent();await refresh();assert.equal(await p.locator('#dogs-share-status').textContent(),completed,'account refresh preserves completion/failure announcement');
  return {pending,completed,focus:await usefulFocus(p,'#dogs-export-dialog')};
 }finally{hold.resolve();}
});
test('nested-about-queue','dogs',async({page:p},engine)=>{await H.activate(p,nav('dogs','you'),engine);await H.activate(p,'#dogs-curious-list .secondary-item__actions button:first-child',engine);await H.activate(p,'#dogs-new-choice .comparison-card__learn',engine);await p.locator('#dogs-detail').waitFor({state:'visible'});const trace=await cycle(p,'#dogs-detail',engine);await p.keyboard.press('Escape');await focused(p,'#dogs-new-choice .comparison-card__learn');assert(await p.locator('#dogs-comparison').isVisible());await p.keyboard.press('Escape');await focused(p,'#dogs-curious-list .secondary-item__actions button:first-child');return {trace,after:await H.active(p)};});
test('nested-pack-cancel','dogs',async({page:p},engine)=>{await H.activate(p,'#dogs-featured-packs .featured-pack__footer button',engine);await p.locator('#dogs-packs-dialog').waitFor({state:'visible'});const title=await p.locator('#dogs-pack-detail-title').textContent();await H.activate(p,'#dogs-pack-rank-next',engine);await p.locator('#dogs-comparison').waitFor({state:'visible'});await H.activate(p,'#dogs-new-choice .comparison-card__learn',engine);await p.keyboard.press('Escape');await focused(p,'#dogs-new-choice .comparison-card__learn');await p.keyboard.press('Escape');await focused(p,'#dogs-pack-rank-next');assert.equal(await p.locator('#dogs-pack-detail-title').textContent(),title);return {title,after:await H.active(p)};});
test('nested-share-preview','movies',async({page:p},engine)=>{await H.activate(p,nav('movies','ranking'),engine);await H.activate(p,'#share-list',engine);await H.activate(p,'#share-preview [role=button]',engine);await p.locator('#share-lightbox').waitFor({state:'visible'});const trace=await cycle(p,'#share-lightbox',engine);await p.keyboard.press('Escape');assert(await p.locator('#share-studio').isVisible());await usefulFocus(p,'#share-studio');await p.keyboard.press('Escape');await focused(p,'#share-list');return {trace,after:await H.active(p)};});
test('png-download-completes','movies',async({page:p,log},engine)=>{await H.activate(p,nav('movies','ranking'),engine);await H.activate(p,'#share-list',engine);const received=p.waitForEvent('download',{timeout:45000});await H.activate(p,'#share-download-png',engine);const download=await received;const failure=await download.failure();assert.equal(failure,null,'browser confirms completed download');const file=path.join(reportDir,`${engine}-movies-export-${download.suggestedFilename()}`);await download.saveAs(file);assert(fs.statSync(file).size>100,'export has bytes');await p.waitForFunction(()=>!document.querySelector('#share-download-png').disabled,null,{timeout:45000});await H.settle(p);const after=await usefulFocus(p,'#share-studio');log.downloads.push({name:download.suggestedFilename(),failure,bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});await download.delete();return {after,status:await p.locator('#share-export-status').textContent(),download:log.downloads};});
test('png-set-preserves-preview-focus','movies',async({page:p,log},engine)=>{
 await H.activate(p,nav('movies','ranking'),engine);await H.activate(p,'#share-list',engine);
 // Radio-group arrow navigation is native; Tab does not focus unchecked radios.
 await H.tabTo(p,'input[name="share-format"][value="single"]',engine);await p.keyboard.press('ArrowRight');
 await p.locator('.share-preview-card').first().waitFor({state:'visible'});
 await p.evaluate(()=>{const original=HTMLCanvasElement.prototype.toBlob;window.__a11yPendingBlobs=[];window.__a11yHoldBlob=true;HTMLCanvasElement.prototype.toBlob=function(callback,...args){return original.call(this,blob=>window.__a11yHoldBlob?window.__a11yPendingBlobs.push(()=>callback(blob)):callback(blob),...args);};});
 const received=p.waitForEvent('download',{timeout:45000});
 await H.activate(p,'#share-download-png',engine);await p.waitForFunction(()=>window.__a11yPendingBlobs.length>0,null,{timeout:30000});
 await H.tabTo(p,'.share-preview-card[data-page-index="0"]',engine);const before=await H.active(p);
 await p.evaluate(()=>{window.__a11yHoldBlob=false;for(const f of window.__a11yPendingBlobs.splice(0))f();});
 const download=await received;assert.equal(await download.failure(),null);const bytes=await fs.promises.readFile(await download.path());log.downloads.push({name:download.suggestedFilename(),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 await p.waitForFunction(()=>!document.querySelector('#share-download-png').disabled);await H.settle(p);
 const after=await H.active(p);assert(await p.locator('.share-preview-card[data-page-index="0"]').evaluate(e=>e===document.activeElement),'async preview update preserves the chosen semantic card');
 await download.delete();return {before,after,download:log.downloads};
});
test('queue-cancel-owner-race','dogs',async({page:p,mock,context},engine)=>{
 mock.addUser(H.F.USER_B,'second@accessibility.invalid');
 const owner=`user:${H.F.USER_B}`;mock.db.category_rankings.push({...structuredClone(mock.db.category_rankings[0]),list_id:owner});mock.db.category_lists.push({...structuredClone(mock.db.category_lists[0]),list_id:owner});
 await H.activate(p,nav('dogs','you'),engine);await H.activate(p,'#dogs-curious-list .secondary-item__actions button:first-child',engine);
 await p.locator('#dogs-comparison').waitFor({state:'visible'});
 await p.evaluate(()=>{window.__a11yFrames=[];window.__a11yRaf=requestAnimationFrame;window.requestAnimationFrame=callback=>{window.__a11yFrames.push(callback);return -1;};});
 await p.keyboard.press('Escape');await p.evaluate(()=>window.requestAnimationFrame=window.__a11yRaf);
 const held=await p.evaluate(()=>window.__a11yFrames.length);assert(held>=2,'cancel scroll and focus callbacks held');
 const s=mock.issueSession(H.F.USER_B),other=await context.newPage();
 await other.goto(`${H.ORIGIN}/dogs#access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=3600&token_type=bearer&type=magiclink`);
 await p.waitForFunction(()=>document.querySelector('#dogs-account-state').textContent.includes('second@accessibility.invalid'),null,{timeout:20000});
 await p.locator('#dogs-curious-list .secondary-item__actions button:first-child').waitFor({state:'visible'});
 await H.tabTo(p,'#dogs-settings-toggle',engine);const before=await H.active(p);
 await p.evaluate(()=>{for(const callback of window.__a11yFrames.splice(0))callback(performance.now());});await H.settle(p);
 const after=await H.active(p);assert.equal(after.id,before.id,'old-owner callback cannot focus the new owner queue');
 await other.close();return {held,before,after};
});

async function main(){
 const hashes=()=>Object.fromEntries(['app.js','dogs.js','index.html','dogs.html'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(H.ROOT,f))).digest('hex')]));
 const report={startedAt:new Date().toISOString(),root:H.ROOT,baseline,sourceHashes:hashes(),tests:[]};
 const engines=(process.env.A11Y_ENGINES||'chromium,webkit').split(',');
 for(const engine of engines){const browser=await H.launch(engine);report[engine+'Version']=browser.version();try{
   for(const t of tests){if(process.env.A11Y_ONLY&&!new RegExp(process.env.A11Y_ONLY).test(`${t.app} ${t.name}`))continue;
     const result={engine,app:t.app,name:t.name,status:'failed'};let f;
     try{f=await H.fixture(browser,t.app,t.options);result.detail=await t.run(f,engine);assert.deepEqual(f.log.errors,[],'no uncaught application errors');result.status='passed';}
     catch(e){result.error=e.stack||String(e);}
     finally{if(f){result.focus=await H.active(f.page).catch(()=>null);result.log=f.log;try{await f.page.screenshot({path:path.join(reportDir,`${engine}-${t.app}-${t.name}.png`)});}catch{}await f.context.close();}}
     report.tests.push(result);fs.writeFileSync(path.join(reportDir,'results.json'),JSON.stringify(report,null,2));console.log(`${result.status.toUpperCase()} ${engine} ${t.app} ${t.name}${result.error?'\n'+result.error:''}`);
   }
   if(!process.env.A11Y_ONLY){const c=await browser.newContext(),p=await c.newPage();await p.setContent('<button id="before">Before</button><dialog id="plain"><h1>Native control</h1><button>First</button><button>Last</button></dialog><button id="after">After</button>');await p.locator('dialog').evaluate(e=>e.showModal());const trace=await cycle(p,'#plain',engine);report.tests.push({engine,app:'plain-native',name:'native-dialog-control',status:'passed',detail:{trace}});await c.close();}
 }finally{await browser.close();}}
 report.finishedAt=new Date().toISOString();report.finalSourceHashes=hashes();report.sourceChangedDuringRun=JSON.stringify(report.sourceHashes)!==JSON.stringify(report.finalSourceHashes);report.passed=report.tests.filter(t=>t.status==='passed').length;report.failed=report.tests.length-report.passed;
 fs.writeFileSync(path.join(reportDir,'results.json'),JSON.stringify(report,null,2));console.log(`Report ${reportDir}/results.json (${report.passed} passed, ${report.failed} failed; baseline=${baseline})`);assert(report.tests.length,'selected no tests');process.exitCode=(!baseline&&report.failed)||report.sourceChangedDuringRun?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>H.H.cleanProfiles());
