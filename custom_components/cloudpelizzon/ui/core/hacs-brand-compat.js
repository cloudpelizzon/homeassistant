/* CloudPelizzon-only compatibility for HACS versions using the legacy brands CDN.
 * Changes only this integration's icon inside HACS. No HACS files, tokens or settings.
 */
(() => {
  if(window.__cpLocalHacsBrand106)return;
  window.__cpLocalHacsBrand106=true;
  const image='/cloudpelizzon-core/frontend/hacs-icon.png';
  const observed=new WeakSet(),frames=new WeakSet(),queued=new Map();
  let timer;
  function isLegacyIcon(raw,base){
    try{
      const url=new URL(raw,base);
      return ['https:','http:'].includes(url.protocol)
        && ['brands.home-assistant.io','data-v2.hacs.xyz'].includes(url.hostname)
        && /\/cloudpelizzon\/(?:dark_)?icon(?:@2x)?\.png$/.test(url.pathname);
    }catch{return false;}
  }
  function queue(root,inHacs){
    queued.set(root,Boolean(queued.get(root)||inHacs));
    if(!timer)timer=setTimeout(flush,80);
  }
  function flush(){
    timer=null;
    const batch=[...queued];queued.clear();
    for(const [root,inHacs] of batch)scan(root,inHacs);
  }
  function scan(root,inHacs=false){
    if(!root?.querySelectorAll)return;
    if(!observed.has(root)){
      observed.add(root);
      new MutationObserver(()=>queue(root,inHacs)).observe(root,
        {subtree:true,childList:true,attributes:true,attributeFilter:['src']});
    }
    for(const node of root.querySelectorAll('*')){
      const scoped=inHacs||node.localName?.startsWith('hacs-');
      if(inHacs&&node.localName==='img'&&isLegacyIcon(node.getAttribute('src'),node.ownerDocument.baseURI)){
        node.setAttribute('src',image);
        node.setAttribute('data-cloudpelizzon-local-brand','106');
      }
      if(node.shadowRoot)scan(node.shadowRoot,scoped);
      if(node.localName==='iframe'){
        const read=()=>{try{if(node.contentDocument)scan(node.contentDocument,scoped);}catch{/* Other-origin frames are out of scope. */}};
        if(!frames.has(node)){frames.add(node);node.addEventListener('load',read);}
        read();
      }
    }
  }
  scan(document);
})();
