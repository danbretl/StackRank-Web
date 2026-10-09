'use strict';
// Synthetic keyboard regression fixture. Adapted from the reviewed accessibility
// audit's transport approach; never imports or writes its audit directories.
const fs=require('node:fs'),path=require('node:path');
const H=require('./data-safety-browser.cjs'),F=require('./data-safety-fixtures.cjs');
const ROOT=path.resolve(process.env.A11Y_SERVE_ROOT||path.join(__dirname,'../..'));
const playwright=require(process.env.A11Y_PLAYWRIGHT_PATH||'playwright');
const ORIGIN='http://127.0.0.1:17863'; // Fully intercepted; no listening server.
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const movies=[F.MOVIES.m1,F.MOVIES.m2,F.MOVIES.m3];
const dogs=[F.dog('VBO:0200162','Bichon Frise'),F.dog('VBO:0201396','Water Dog'),F.dog('VBO:0200329','Chi-Poo')];
async function launch(engine){return playwright[engine].launch({headless:true,proxy:{server:'http://127.0.0.1:9'},...(engine==='chromium'?{args:['--host-resolver-rules=MAP * ~NOTFOUND']}: {})});}
async function fixture(browser,app,{signedIn=true}={}){
  const mock=new H.MockSupabase();mock.addUser(F.USER_A,'fictional@accessibility.invalid');
  mock.db[app==='movies'?'rankings':'category_rankings'].push({list_id:`user:${F.USER_A}`,...(app==='movies'?{movies}:{category:'dogs',items:dogs}),updated_at:'2026-10-01T00:00:00.000Z'});
  if(app==='movies')mock.db.movie_lists.push({list_id:`user:${F.USER_A}`,list_type:'watch',movies:[F.queued('Audit Queue',2003,900401)],updated_at:'2026-10-01T00:00:00.000Z'});
  else mock.db.category_lists.push({list_id:`user:${F.USER_A}`,category:'dogs',list_type:'curious',items:[F.dog('VBO:0200799','Labrador Retriever')],updated_at:'2026-10-01T00:00:00.000Z'});
  mock.functions['tmdb-search']=()=>({results:[F.MOVIES.m4,F.MOVIES.m5]});
  mock.functions['tmdb-suggest']=()=>({results:[]});
  mock.functions['tmdb-detail']=q=>({tmdbId:Number(q.get('id')||900004),title:'Synthetic detail',year:1994,overview:'Fictional keyboard test film.',runtime:90,genres:['Drama'],director:'Synthetic Director',cast:['Synthetic Actor']});
  const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:true});
  const log={blocked:[],requests:[],errors:[],console:[],downloads:[],dialogs:[]};
  await context.addInitScript(({key,session})=>{if(session&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(session));},{key:H.AUTH_STORAGE_KEY,session:signedIn?mock.issueSession(F.USER_A):null});
  await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    // WebKit routes blob downloads through this hook. They are browser-local
    // bytes, not HTTP assets; treating their pathname as a disk path yields 404.
    if(['blob:','data:','about:'].includes(u.protocol))return route.continue();
    if(u.origin===ORIGIN){
      const relative=u.pathname==='/movies'?'index.html':u.pathname==='/dogs'?'dogs.html':u.pathname.replace(/^\/+/,''),file=path.resolve(ROOT,relative);
      if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
      return route.fulfill({status:200,contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
    }
    const image=()=>route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="180"><rect width="120" height="180" fill="#bbb"/></svg>'});
    if(u.origin===H.SUPABASE_ORIGIN){
      log.requests.push({method:req.method(),path:u.pathname});
      const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
      if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
      if(u.pathname.includes('tmdb-image'))return image();
      const result=await mock.handle({url:u.pathname+u.search,method:req.method(),headers:req.headers()},req.postData()||'');
      if(result.destroy)return route.abort();
      return route.fulfill({status:result.status,headers,contentType:'application/json',body:result.body==null?'':JSON.stringify(result.body)});
    }
    log.blocked.push(u.origin+u.pathname);
    if(req.resourceType()==='image')return image();
    return route.abort('blockedbyclient');
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);
  page.on('pageerror',e=>log.errors.push(String(e)));
  page.on('console',e=>{if(['error','warning'].includes(e.type()))log.console.push({type:e.type(),text:e.text()});});
  page.on('dialog',async d=>{log.dialogs.push({type:d.type(),message:d.message()});await d.accept();});
  await page.goto(ORIGIN+'/'+app);
  await page.waitForFunction(app=>document.documentElement.dataset[app+'PersistenceReady']==='true',app,{timeout:20000});
  if(app==='dogs')await page.waitForSelector('#dogs-catalog-status[data-ready=true]',{state:'attached',timeout:20000});
  return {context,page,mock,log};
}
async function active(page){return page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return {tag:e.tagName,id:e.id,text:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,120),disabled:e.matches(':disabled'),visible:!!e.getClientRects().length,focusVisible:e.matches(':focus-visible'),outline:s.outline,dialog:e.closest('dialog,[role=dialog]')?.id||null};});}
const tabKey=(engine,reverse=false)=>`${engine==='webkit'?'Alt+':''}${reverse?'Shift+':''}Tab`;
async function tabTo(page,selector,engine,{max=180}={}){
  const target=page.locator(selector).first();await target.waitFor({state:'visible'});let tail=[];
  for(let i=0;i<max;i++){if(await target.evaluate(e=>e===document.activeElement))return;
    await page.keyboard.press(tabKey(engine));tail.push(await active(page));tail=tail.slice(-5);
  }
  throw new Error('Keyboard target unreachable '+selector+' '+JSON.stringify(tail));
}
async function activate(page,selector,engine){await tabTo(page,selector,engine);await page.keyboard.press('Enter');}
async function settle(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
module.exports={ROOT,H,F,ORIGIN,launch,fixture,active,tabKey,tabTo,activate,settle};
