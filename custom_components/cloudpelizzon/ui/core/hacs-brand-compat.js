/* CloudPelizzon-only compatibility for HACS versions using the legacy brands CDN.
 * Changes only this integration's icon inside HACS. No HACS files, tokens or settings.
 */
(() => {
  if(window.__cpLocalHacsBrand109)return;
  window.__cpLocalHacsBrand109=true;
  const image='/cloudpelizzon-core/frontend/hacs-icon.png';
  const observed=new WeakSet(),frames=new WeakSet(),queued=new Map();
  const patched=new WeakSet();
  const wiredLinks=new WeakSet();
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
    if(root.host?.localName==='cloudpelizzon-core-panel')upgradeLegacyPanel(root.host);
    if(!observed.has(root)){
      observed.add(root);
      new MutationObserver(()=>queue(root,inHacs)).observe(root,
        {subtree:true,childList:true,attributes:true,attributeFilter:['src']});
    }
    for(const node of root.querySelectorAll('*')){
      if(node.localName==='cloudpelizzon-core-panel')upgradeLegacyPanel(node);
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
  function upgradeLegacyPanel(panel){
    const prototype=Object.getPrototypeOf(panel);
    if(patched.has(prototype)){wireLegacyPortal(panel);return;}
    if(typeof prototype.v2TrialButton!=='function'
      ||typeof prototype.cpModuleStatus!=='function'||typeof prototype.v2StartTrial!=='function'||typeof panel.render!=='function')return;
    const oldPortal=prototype.cpOpenSecurePortal;
    const legacy=typeof oldPortal==='function'&&oldPortal.toString().includes('/portal/pair/start');
    if(!legacy)return;
    patched.add(prototype);
    const ready=sku=>['CP-MAINTENANCE','CP-SOLAR','CP-AUTOMATION'].includes(sku);
    const oldButton=prototype.v2TrialButton,oldStatus=prototype.cpModuleStatus,oldStart=prototype.v2StartTrial;
    prototype.v2TrialButton=function(module){
      if(!ready(module?.sku)&&module?.trial?.verified===true&&module.trial.phase==='not_started'&&!module?.license?.allowed)
        return '<p role="status">Teste ainda indisponível nesta versão.</p>';
      return oldButton.call(this,module);
    };
    prototype.cpModuleStatus=function(module){
      if(!ready(module?.sku)&&module?.trial?.verified===true&&module.trial.phase==='not_started'&&!module?.license?.allowed)
        return 'Teste ainda indisponível';
      return oldStatus.call(this,module);
    };
    prototype.v2StartTrial=function(sku){
      if(!ready(sku)){this.toast('O teste deste módulo ainda não está disponível nesta versão.','error');return;}
      return oldStart.call(this,sku);
    };
    prototype.cpOpenSecurePortal=async function(event){
      event.preventDefault();event.stopPropagation();
      const view=this.ownerDocument.defaultView;
      const opened=view.open('about:blank','_blank');
      if(!opened){this.toast('Permita a abertura do Portal do Cliente.','error');return;}
      try{
        opened.opener=null;
        opened.document.body.textContent='Validando instalação CloudPelizzon...';
        const result=await this._hass.callWS({type:'cloudpelizzon/core/portal/pair'});
        if(!result||typeof result.assertion!=='string'||!/^[A-Za-z0-9_-]{100,3000}$/.test(result.assertion))throw Error('invalid_handoff');
        const form=opened.document.createElement('form');form.method='POST';form.action='https://cliente.cloudpelizzon.com.br/login';
        const input=opened.document.createElement('input');input.type='hidden';input.name='assertion';input.value=result.assertion;
        form.append(input);opened.document.body.append(form);form.submit();
      }catch{opened.location.replace('https://cliente.cloudpelizzon.com.br/login');}
    };
    // Preserve any form currently being edited; the next normal render picks up
    // the upgraded methods. Detail/catalog pages can be redrawn immediately.
    const shadow=panel.shadowRoot;
    if(shadow&&!shadow.querySelector('.modal.show')&&!shadow.activeElement?.matches('input,textarea,select,[contenteditable="true"]'))
      panel.render();
    wireLegacyPortal(panel);
  }
  function wireLegacyPortal(panel){
    for(const link of panel.shadowRoot?.querySelectorAll('a[href]')||[]){
      let url;
      try{url=new URL(link.getAttribute('href'),panel.ownerDocument.baseURI);}catch{continue;}
      if(url.origin!=='https://cliente.cloudpelizzon.com.br'||url.pathname!=='/login'
        ||link.hasAttribute('data-portal-pair')||wiredLinks.has(link))continue;
      wiredLinks.add(link);link.setAttribute('data-cloudpelizzon-legacy-portal','109');
      link.addEventListener('click',event=>panel.cpOpenSecurePortal(event));
    }
  }
  scan(document);
})();
