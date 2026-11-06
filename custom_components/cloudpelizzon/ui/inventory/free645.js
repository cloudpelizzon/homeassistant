import {renderIcon520} from '/cloudpelizzon-inventory/frontend/topology.js?v=4707fb1f677f09e955f46710b27aba40191e7adb14535924c478462c40bbbc39';
/* The Free tier uses the same CMDB, network and room renderers as Full. */
export function installFree645(p){
 const isFree=s=>s.data?.capabilities?.mode==='free',previous={ws:p.ws,render:p.render,navigate:p.navigate,dialog:p.dialog};
 const restrict=root=>root.querySelectorAll('[data-export-topology],[data-map-report592],[data-floor-print593],[data-room-print593],[data-map-sync],[data-analyze-network]').forEach(b=>{b.disabled=true;b.title='Disponível na versão completa';});
 p.dialog=function(...args){const d=previous.dialog.apply(this,args);if(isFree(this))restrict(d);return d;};
 p.ws=async function(operation,args={}){if(!isFree(this))return previous.ws.call(this,operation,args);const actor=this._hass?.user?.id;const result=await previous.ws.call(this,operation,{...args,free_revision:this.freeRevision646??this.data?.free_revision});if(actor===this._hass?.user?.id&&Number.isInteger(result?.free_revision))this.freeRevision646=result.free_revision;return result;};
 p.navigate=async function(view,...args){if(isFree(this)&&['history','diagnostics'].includes(view)){this.view=view;this.notice='';this.error='';this.render();return;}return previous.navigate.call(this,view,...args);};
 p.render=function(...args){const result=previous.render.apply(this,args);if(!isFree(this)||this.shadowRoot.querySelector('dialog[open]'))return result;const root=this.shadowRoot;
  restrict(root);
  const heading=root.querySelector('.map511-heading');if(heading){const note=document.createElement('p');note.className='notice';note.textContent='Free permanente · 10 equipamentos e 2 cômodos completos · mesmos editores 2D/3D da versão completa. Impressão, exportação e descoberta ativa exigem licença completa.';heading.after(note);}
  root.querySelectorAll('[data-free-adopt632]').forEach(b=>{const d=this.data.candidates.find(d=>d.id===b.dataset.freeAdopt632),row=b.closest('.candidate');if(!d||!row||row.querySelector('[data-discovery-icon646]'))return;const icon=document.createElement('span');icon.dataset.discoveryIcon646='';icon.style.cssText='display:inline-flex;width:64px;height:52px;flex:none';icon.innerHTML=renderIcon520(d.attributes?.icon_key||'',d.category,d.icon_image||'');row.prepend(icon);});return result;
 };
}
