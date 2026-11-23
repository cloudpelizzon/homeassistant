/* CP_UI_REFRESH_20261122: safe, same-origin version updates for open tabs. */
(()=>{
 const version="registration-5a2df8336b6a";
 const endpoint='/cloudpelizzon/frontend/ui-version.json';
 const expectedAssets={"/cloudpelizzon/frontend/optional-modules.js": "24584c833f30cf354b7cd43866e4ad14ba1d2e390ce3e71ea19d586f1b6550b4", "/cloudpelizzon-maintenance/frontend/panel.js": "1663a3b82d16e9ba2999fba9d50e2f5e0c1e3950a935a058356c15f486120787", "/cloudpelizzon-maintenance/frontend/legacy-v311-core.js": "839214d0df5f818a768373aeb7e31c3a6e06711d685c1a57b5289baff8c83ff2", "/cloudpelizzon-maintenance/frontend/maintenance-v311.css": "99e071b3dfc1659a7e842ecedf7830c5e319426b7c880ce60fef8e75533d1f4a", "/cloudpelizzon-inventory/frontend/panel.js": "cf0f756d1d6debaadb93ede1b854b923a5fded5aa7d71043fc0189661e6da774"};
 document.documentElement.dataset.cpUiVersion=version;
 const key='cp-ui-refreshed-version';
 let checking=false,lastInteraction=Date.now(),pendingVersion=null;
 const edited=new Set();
 const roots=new WeakSet();
 const value=el=>el.type==='checkbox'||el.type==='radio'?String(el.checked):el.type==='file'?String(el.files?.length||0):String(el.value??'');
 const initial=el=>el.type==='checkbox'||el.type==='radio'?String(el.defaultChecked):el.type==='file'?'0':el.tagName==='SELECT'?String([...el.options].find(o=>o.defaultSelected)?.value??el.options[0]?.value??''):String(el.defaultValue??'');
 const track=e=>{
  const el=e.composedPath().find(n=>n instanceof HTMLInputElement||n instanceof HTMLSelectElement||n instanceof HTMLTextAreaElement);
  if(!el||el.type==='search'||el.closest('.header-search'))return;
  if(value(el)!==initial(el))edited.add(el);else edited.delete(el);
  lastInteraction=Date.now();
 };
 document.addEventListener('input',track,true);
 document.addEventListener('change',track,true);
 document.addEventListener('pointerdown',()=>{lastInteraction=Date.now()},true);
 document.addEventListener('keydown',()=>{lastInteraction=Date.now()},true);
 function busy(root=document){
  if(!roots.has(root)){root.addEventListener('input',track,true);root.addEventListener('change',track,true);roots.add(root)}
  const active=root.activeElement;
  if(active?.matches?.('input,textarea,select'))return true;
  for(const el of root.querySelectorAll('*')){
   if(el.matches('.overlay,.modal.show,dialog[open],[role="dialog"]')&&el.getBoundingClientRect().width>0&&getComputedStyle(el).visibility!=='hidden')return true;
   if(el.shadowRoot&&busy(el.shadowRoot))return true;
  }
  return false;
 }
 async function check(){
  if(checking||document.visibilityState!=='visible'||location.pathname!=='/cloudpelizzon')return;
  checking=true;
  try{
   const response=await fetch(endpoint,{cache:'no-store',credentials:'same-origin',headers:{'Cache-Control':'no-cache'}});
   if(!response.ok)return;
   const manifest=await response.json();
   if(manifest.schema!=='cloudpelizzon.ui-version.v1'||!/^registration-[a-f0-9]{12}$/.test(manifest.revision))return;
   const changed=await Promise.all(Object.entries(expectedAssets).map(async([path,expectedHash])=>{
    const result=await fetch(path,{cache:'no-store',credentials:'same-origin'});
    if(!result.ok)throw Error('version_unavailable');
    const bytes=await result.arrayBuffer();
    const current=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
    return current===expectedHash?'':path+':'+current;
   }));
   const signature=changed.filter(Boolean).join('|');
   const assetVersion=signature?'assets-'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature)))).map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,16):null;
   pendingVersion=assetVersion||(manifest.revision===version?null:manifest.revision);
   if(!pendingVersion||sessionStorage.getItem(key)===pendingVersion)return;
   for(const el of edited)if(!el.isConnected||value(el)===initial(el))edited.delete(el);
   if(edited.size||Date.now()-lastInteraction<30000||busy())return;
   // Refresh the HTTP cache for HA's registered module URL before reopening it.
   const watched=new Set([...Object.keys(expectedAssets),'/cloudpelizzon/frontend/panel.js']);
   const urls=new Set([import.meta.url,...performance.getEntriesByType('resource').map(entry=>entry.name).filter(name=>{
    const url=new URL(name,location.href);return url.origin===location.origin&&watched.has(url.pathname);
   })]);
   await Promise.all([...urls].map(async url=>{
    const resource=await fetch(url,{cache:'reload',credentials:'same-origin'});
    if(!resource.ok)throw Error('refresh_unavailable');
    await resource.arrayBuffer();
   }));
   sessionStorage.setItem(key,pendingVersion);
   location.reload();
  }catch(_){/* Unavailable version service must never interrupt the panel. */}
  finally{checking=false}
 }
 setInterval(check,60000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
 check();
})();
