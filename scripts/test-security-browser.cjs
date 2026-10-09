"use strict";
// Actual public viewers + vendored Supabase in isolated Chrome. Synthetic HTTP
// responses test client behavior, not PostgreSQL privileges. No production calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
if(process.env.SECURITY_SERVE_ROOT)process.env.DATA_SAFETY_SERVE_ROOT=process.env.SECURITY_SERVE_ROOT;
const H = require('./testing/data-safety-browser.cjs');
const { USER_A, dog } = require('./testing/data-safety-fixtures.cjs');
const reportDir = path.resolve(process.env.SECURITY_BROWSER_REPORT_DIR || path.join(H.SOURCE_ROOT, 'reports/security-browser', new Date().toISOString().replace(/[:.]/g, '-')));
fs.mkdirSync(reportDir, {recursive:true});
const T = '2026-10-09T00:00:00.000Z';
const hostile = '<img src=x onerror="window.__shareXss=1">';
const apps = {
  movies: { slug:'abcde12345', rpc:'read_movie_share', table:'shared_lists', state:"document.querySelector('.shared-page')?.dataset.sharedState", cards:'#shared-grid .shared-card', title:'Shared StackRank movie list' },
  dogs: { slug:'abcdef123456', rpc:'read_dog_share', table:'category_shared_lists', state:"document.querySelector('.dog-share')?.dataset.state", cards:'#dog-share-list .dog-share__card', title:'Shared StackRank Dogs ranking' },
};
function publicRow(app) {
  const a=apps[app];
  return app==='movies' ? {slug:a.slug,payload:{displayName:'Synthetic viewer',movies:[{title:hostile,year:2001,tmdbId:900001,posterPath:null}]},updated_at:T}
    : {slug:a.slug,category:'dogs',payload:{items:[dog('VBO:0200162',hostile,'Synthetic public snapshot')]},created_at:T,updated_at:T};
}
async function startMock(app,mode) {
  const trace=[];const a=apps[app];
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Access-Control-Allow-Origin',req.headers.origin||'*');
    res.setHeader('Access-Control-Allow-Headers',req.headers['access-control-request-headers']||'*');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    let raw='';for await(const chunk of req)raw+=chunk;
    const url=new URL(req.url,'http://mock');
    const entry={path:url.pathname,query:Object.fromEntries(url.searchParams),method:req.method,body:raw?JSON.parse(raw):null,authorization:req.headers.authorization||'',apikey:req.headers.apikey||''};trace.push(entry);
    let status=200,body;
    if(url.pathname===`/rest/v1/rpc/${a.rpc}`) {
      if(mode==='fallback') {status=404;body={code:'PGRST202',message:'Synthetic missing function'};}
      else if(mode==='permission') {status=403;body={code:'42501',message:'Synthetic permission denied'};}
      else if(mode==='server') {status=503;body={code:'synthetic_server_error',message:'Synthetic unavailable'};}
      else if(mode==='revoked'||mode==='missing')body=null;
      else if(mode==='owner-column')body={...publicRow(app),list_id:`user:${USER_A}`};
      else if(mode==='wrong-slug')body={...publicRow(app),slug:'wrong12345'};
      else body=publicRow(app);
    } else if(url.pathname===`/rest/v1/${a.table}`&&mode==='fallback') {
      body=publicRow(app);if(app==='movies')delete body.slug;
    } else if(url.pathname==='/functions/v1/tmdb-detail') {
      body={result:{overview:hostile,director:hostile,cast:[hostile],genres:['Drama'],runtime:95}};
    } else {status=403;body={code:'42501',message:'Unexpected request denied by synthetic service'};}
    entry.status=status;res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {trace,url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}
async function startWeb(mockUrl,withCsp) {
  const backend=await H.startStaticServer();
  if(!withCsp)return backend;
  const config=JSON.parse(fs.readFileSync(path.join(H.SOURCE_ROOT,'vercel.json'),'utf8'));
  const original=config.headers.find(r=>r.source==='/(.*)').headers.find(h=>h.key==='Content-Security-Policy').value;
  // Only the synthetic transport origin is added. All script/DOM protections
  // remain identical to the production policy; localhost is a secure context.
  const policy=original.replace("connect-src 'self'",`connect-src 'self' ${mockUrl}`);
  const server=http.createServer((req,res)=>{
    const upstream=http.get(backend.url+req.url,response=>{
      res.writeHead(response.statusCode,{...response.headers,'content-security-policy':policy});response.pipe(res);
    });upstream.on('error',()=>{res.writeHead(502);res.end('local proxy error');});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {url:`http://127.0.0.1:${server.address().port}`,policy,close:async()=>{await new Promise(r=>server.close(r));await backend.close();}};
}
const storageSnapshot=page=>page.evaluate(`({local:Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])),session:Object.fromEntries(Object.keys(sessionStorage).sort().map(k=>[k,sessionStorage.getItem(k)]))})`);
async function screenshot(page,name,width,height) {
  await page.send('Page.bringToFront');
  await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  assert(await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),'no horizontal overflow');
  const shot=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(reportDir,`${name}.png`),Buffer.from(shot.data,'base64'));
}
async function runCase(app,mode,sessionKind,withCsp=false) {
  const a=apps[app],name=`${app}: ${mode}, ${sessionKind}${withCsp?', production CSP with local transport origin':''}`;
  const result={name,startedAt:new Date().toISOString(),status:'failed'};
  const mock=await startMock(app,mode),web=await startWeb(mock.url,withCsp);let browser,page;
  try {
    browser=await H.launchBrowser({name:`security-${app}-${mode}-${sessionKind}`,mockUrl:mock.url,appUrl:web.url});page=await browser.firstPage();
    const auth=new H.MockSupabase();auth.addUser(USER_A,'synthetic@security.test');
    const session=auth.issueSession(USER_A,{expiresIn:sessionKind==='expired'?-3600:3600});
    await H.seedStorage(page,web.url,{...(sessionKind==='present'||sessionKind==='expired'?{[H.AUTH_STORAGE_KEY]:session}:{}),'stackrank:movies:safety:v1':'synthetic-owner-copy','stackrank:dogs:safety:v1':'synthetic-dog-copy'});
    await page.evaluate("sessionStorage.setItem('synthetic-private-session','unchanged')");
    const before=await storageSnapshot(page);
    const fragment=sessionKind==='fragment'?`#access_token=${session.access_token}&refresh_token=${session.refresh_token}&expires_in=3600&token_type=bearer&type=magiclink`:'';
    const route=`/s/${app==='dogs'?'dogs/':''}${a.slug}`;
    await page.navigate(`${web.url}${route}${fragment}`);
    const expected=['success','fallback'].includes(mode)?'ready':['missing','revoked'].includes(mode)?'missing':'error';
    await page.waitFor(`${a.state}===${JSON.stringify(expected)}`,12000,`${name} state ${expected}`);
    assert.equal(await page.evaluate('document.title'),a.title);
    assert.equal(await page.evaluate('location.pathname'),route);
    assert.equal(await page.evaluate('location.hash'),fragment,'viewer does not consume auth fragments');
    assert.deepEqual(await storageSnapshot(page),before,'viewer does not mutate saved account session or private copies');
    assert.equal(mock.trace.filter(t=>t.path.startsWith('/auth/')).length,0,'no auth calls');
    const shareRequests=mock.trace.filter(t=>t.path.startsWith('/rest/'));
    assert.equal(shareRequests.length,mode==='fallback'?2:1,'only missing RPC allows legacy fallback');
    assert.equal(shareRequests[0].path,`/rest/v1/rpc/${a.rpc}`);
    assert.deepEqual(shareRequests[0].body,{share_slug:a.slug});
    for(const request of shareRequests) {
      assert(request.apikey.startsWith('sb_publishable_'),'public key used');
      assert.equal(request.authorization,`Bearer ${request.apikey}`,'no account bearer token sent');
      assert(!JSON.stringify(request.body).includes(USER_A),'no owner identifier sent');
    }
    if(mode==='fallback') {
      const query=shareRequests[1].query;
      assert.equal(query.slug,`eq.${a.slug}`);assert(!query.select.includes('list_id'));
      assert.equal(app==='dogs'?query.category:query.revoked,app==='dogs'?'eq.dogs':'eq.false');
    }
    if(expected==='ready') {
      assert.equal(await page.evaluate(`document.querySelectorAll(${JSON.stringify(a.cards)}).length`),1);
      assert(await page.evaluate(`document.querySelector(${JSON.stringify(a.cards)}).textContent.includes(${JSON.stringify(hostile)})`));
      assert.equal(await page.evaluate('Boolean(window.__shareXss)'),false,'hostile text not executed without CSP');
      assert.equal(await page.evaluate(`document.querySelectorAll(${JSON.stringify(a.cards+' img')}).length`),0,'hostile text never becomes an image element');
      if(mode==='success'&&sessionKind==='present') {
        for(const [viewport,width,height] of [['desktop',1280,900],['phone',390,844]])await screenshot(page,`${app}-${withCsp?'csp-':''}${viewport}`,width,height);
        if(app==='movies') {
          await page.evaluate("document.querySelector('.shared-card').click()");
          await page.waitFor("!document.querySelector('#shared-detail').hidden && document.querySelector('#shared-detail-overview').textContent.includes('onerror')");
          assert.equal(await page.evaluate('Boolean(window.__shareXss)'),false);
          await page.evaluate("document.querySelector('#shared-detail-close').click()");
          assert(await page.evaluate("document.querySelector('#shared-detail').hidden"),'detail closes');
        } else {
          assert.equal(await page.evaluate("document.querySelector('.dog-share__cta').getAttribute('href')"),'/dogs');
        }
      }
    } else assert.equal(await page.evaluate(`document.querySelectorAll(${JSON.stringify(a.cards)}).length`),0,'unavailable response does not render cards');
    assert.deepEqual(browser.external.filter(e=>!String(e.attemptedExternal||e.blockedExternal).startsWith('https://fonts.gstatic.com/')),[],'only expected font requests reach the external blocker');
    assert.deepEqual(await page.evaluate('window.__auditDenied'),[],'no unexpected application fetch');
    const unexpected=page.events.filter(e=>e.type==='exception'||(e.type==='console'&&['error','warning'].includes(e.level)&&!(expected==='error'&&e.text.startsWith('Could not load shared'))));
    assert.deepEqual(unexpected,[],'no unexplained console errors or exceptions');
    result.status='passed';
  } catch(error) {result.error=error.stack||String(error);}
  finally {
    result.trace=mock.trace;result.events=page?.events||[];result.network=browser?.external||[];result.csp=web.policy||null;
    if(page)try{result.dom=await page.evaluate(`({title:document.title,path:location.pathname,state:${a.state},text:document.body.innerText.slice(0,2500)})`);}catch{}
    if(browser)await browser.close();await mock.close();await web.close();
  }
  console.log(`${result.status.toUpperCase()} ${name}${result.error?'\n'+result.error:''}`);return result;
}
async function main() {
  const files=['shared.js','dogs-shared.js','lib/public-share-reader.js','shared.html','dogs-shared.html'];
  const hashes=()=>Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(H.SNAPSHOT,f))).digest('hex')]));
  const report={startedAt:new Date().toISOString(),sourceRoot:H.SNAPSHOT,sourceHashes:hashes(),browserPlugin:'not available; existing repository CDP workflow',csp:'22 cases without CSP; 2 with production policy plus local synthetic transport origin',tests:[]};
  for(const app of Object.keys(apps))for(const [mode,session] of [['success','absent'],['success','present'],['success','expired'],['success','fragment'],['fallback','present'],['missing','present'],['revoked','present'],['permission','present'],['server','present'],['owner-column','present'],['wrong-slug','present']]) {
    if(process.env.SECURITY_BROWSER_ONLY&&!`${app} ${mode} ${session}`.includes(process.env.SECURITY_BROWSER_ONLY))continue;
    report.tests.push(await runCase(app,mode,session));fs.writeFileSync(path.join(reportDir,'results.json'),JSON.stringify(report,null,2));
  }
  if(!process.env.SECURITY_BROWSER_ONLY)for(const app of Object.keys(apps))report.tests.push(await runCase(app,'success','present',true));
  assert(report.tests.length,'no tests selected');report.finalSourceHashes=hashes();report.sourceChangedDuringRun=JSON.stringify(report.sourceHashes)!==JSON.stringify(report.finalSourceHashes);
  report.passed=report.tests.filter(t=>t.status==='passed').length;report.failed=report.tests.length-report.passed;report.finishedAt=new Date().toISOString();
  fs.writeFileSync(path.join(reportDir,'results.json'),JSON.stringify(report,null,2));
  console.log(`Report ${reportDir}/results.json (${report.passed} passed, ${report.failed} failed)`);
  process.exitCode=report.failed||report.sourceChangedDuringRun?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>H.cleanProfiles());
