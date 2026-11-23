const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),component=path.join(root,'custom_components/cloudpelizzon');
const source=fs.readFileSync(path.join(component,'ui/shell/refresh754.js'),'utf8');
const refresh=source.slice(source.indexOf('/* CP_UI_REFRESH_20261122:'));
assert(refresh.includes("'/cloudpelizzon/frontend/ui-version.json'"));
assert(!refresh.includes("headers.get('ETag')"));assert(!refresh.includes('/local/'));
const expected=JSON.parse(refresh.match(/const expectedAssets=(\{[^\n]+\});/)[1]);
const routes={'/cloudpelizzon/frontend/':'ui/shell/','/cloudpelizzon-maintenance/frontend/':'ui/maintenance/','/cloudpelizzon-inventory/frontend/':'ui/inventory/'};
const assets={};for(const [url,hash] of Object.entries(expected)){
 const prefix=Object.keys(routes).find(p=>url.startsWith(p));assert(prefix);
 const bytes=fs.readFileSync(path.join(component,routes[prefix],url.slice(prefix.length)));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);assets[url]=bytes;
}
(async()=>{
 let now=100000,busy=true,reloads=0,interval,mode='old';const saved=new Map();
 const DateMock=class extends Date{static now(){return now;}};
 const dialog={matches:()=>true,getBoundingClientRect:()=>({width:200})};
 const document={documentElement:{dataset:{}},visibilityState:'visible',activeElement:null,addEventListener(){},querySelectorAll(){return busy?[dialog]:[];}};
 const context={document,Date:DateMock,HTMLInputElement:class{},HTMLSelectElement:class{},HTMLTextAreaElement:class{},getComputedStyle:()=>({visibility:'visible'}),location:{pathname:'/cloudpelizzon',origin:'https://test.invalid',href:'https://test.invalid/cloudpelizzon',reload:()=>reloads++},sessionStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},performance:{getEntriesByType:()=>[]},setInterval:fn=>{interval=fn;},URL,TextEncoder,crypto:webcrypto,entryUrl:'https://test.invalid/cloudpelizzon/frontend/panel.js',fetch:async url=>{
  const key=String(url).replace('https://test.invalid','').split('?')[0];
  if(key==='/cloudpelizzon/frontend/ui-version.json')return {ok:true,json:async()=>({schema:'cloudpelizzon.ui-version.v1',revision:mode==='old'?'registration-000000000000':document.documentElement.dataset.cpUiVersion})};
  const raw=assets[key]||Buffer.from(source);return {ok:true,arrayBuffer:async()=>raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)};
 }};
 vm.runInNewContext(refresh.replaceAll('import.meta.url','entryUrl').replace('catch(_){/* Unavailable version service must never interrupt the panel. */}', 'catch(error){throw error;}'),context);
 await new Promise(resolve=>setTimeout(resolve,30));now+=31000;await interval();assert.equal(reloads,0,'open dialog must prevent refresh');
 busy=false;await interval();assert.equal(reloads,1,'idle update must refresh once');
 await interval();assert.equal(reloads,1,'same revision must not reload repeatedly');
 console.log('PASS: portable content digests, same-origin manifest, editor guard and one refresh per revision.');
})().catch(error=>{console.error(error);process.exit(1);});
