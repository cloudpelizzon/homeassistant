/* Viewport navigation and the Free HA-registry discovery list. */
customElements.whenDefined('cloudpelizzon-inventory-panel').then(()=>{
 const p=customElements.get('cloudpelizzon-inventory-panel').prototype;
 const old={navigate:p.navigate,load:p.load,render:p.render,discovery:p.discovery};
 const free=panel=>panel.data?.capabilities?.mode==='free';
 p.resetScroll650=function(){
  let element=this;
  while(element){if(element.scrollTop||element.scrollLeft)element.scrollTo?.({top:0,left:0,behavior:'instant'});element=element.parentElement||element.getRootNode?.().host;}
  window.scrollTo({top:0,left:0,behavior:'instant'});
 };
 p.scheduleTop650=function(){const view=this.closest(".view");if(view&&!view.classList.contains("active"))return;if(this.isConnected)this.resetScroll650();requestAnimationFrame(()=>{if(this.isConnected)this.resetScroll650();});};
 p.connectNavigation650=function(){
  this.navigationLife650?.abort();const life=this.navigationLife650=new AbortController();
  this.scheduleTop650();
  const container=this.closest('.view');
  if(container){this.viewObserver650?.disconnect();this.viewObserver650=new MutationObserver(()=>{if(container.classList.contains('active'))this.scheduleTop650();});this.viewObserver650.observe(container,{attributes:true,attributeFilter:['class']});}
  this.shadowRoot.addEventListener('click',event=>{
   if(!event.target.closest?.('[data-expand-map],[data-fullscreen557]'))return;
   event.preventDefault();event.stopImmediatePropagation();
   this.mapExpanded=!this.mapExpanded;this.render();
   if(this.mapExpanded&&this.requestFullscreen){this.nativeFullscreen650=true;this.requestFullscreen({navigationUI:'hide'}).catch(()=>{this.nativeFullscreen650=false;});}
   else if(this.matches(':fullscreen'))document.exitFullscreen?.().catch(()=>{});
  },{capture:true,signal:life.signal});
  document.addEventListener('fullscreenchange',()=>{if(this.nativeFullscreen650&&!this.matches(':fullscreen')){this.nativeFullscreen650=false;this.mapExpanded=false;this.render();}},{signal:life.signal});
 };
 p.disconnectNavigation650=function(){this.navigationLife650?.abort();this.viewObserver650?.disconnect();};
 p.navigate=async function(...args){const result=await old.navigate.apply(this,args);this.scheduleTop650();return result;};
 p.load=async function(...args){const initial=!this.data,result=await old.load.apply(this,args);if(initial&&this.data)this.scheduleTop650();return result;};
 p.discovery=function(...args){
  if(!free(this))return old.discovery.apply(this,args);
  const data=this.data,total=data.candidate_filtered_count||0,size=data.candidate_page_size||50,page=data.candidate_page||0,pages=Math.max(1,Math.ceil(total/size));
  const pager=()=>`<div class="discovery-pager650"><span role="status">${total?`${page*size+1}–${Math.min((page+1)*size,total)}`:'0'} de ${total} dispositivos · Página ${page+1} de ${pages}</span><div><button type="button" data-free-page650="${page-1}" ${page===0?'disabled':''}>← Anterior</button><button type="button" data-free-page650="${page+1}" ${page+1>=pages?'disabled':''}>Próxima →</button></div></div>`;
  return `<div class="section-head"><div><h1>Dispositivos do Home Assistant</h1><p>Registros já existentes no seu HA. Adicione até 10 equipamentos ao Inventário Free.</p></div></div><section class="card" data-discovery-list650><form data-free-search650 class="discovery-search650"><label>Buscar dispositivo<input name="query" value="${this.esc632(this.candidateQuery||'')}" placeholder="Nome, fabricante ou modelo" maxlength="200"></label><label>Itens por página<select name="size">${[[50,'50'],[100,'100'],['all','Mostrar todos']].map(([value,label])=>`<option value="${value}" ${String(this.candidatePageSize650||50)===String(value)?'selected':''}>${label}</option>`).join('')}</select></label><button type="submit">Buscar</button></form>${pager()}${data.candidates.map(device=>`<div class="candidate"><span><strong>${this.esc632(device.name)}</strong><small>${this.esc632(device.manufacturer||'')} · ${this.esc632(device.model||'')}</small></span><button data-free-adopt632="${device.id}" ${data.summary.managed>=10?'disabled':''}>Adicionar ao inventário</button></div>`).join('')||'<p>Nenhum dispositivo corresponde à busca.</p>'}${pager()}</section>`;
 };
 p.render=function(...args){
  const container=this.closest(".view");if(this.isConnected&&container&&this.viewObserver650)this.viewObserver650.observe(container,{attributes:true,attributeFilter:["class"]});
  this.toggleAttribute('data-map-fullscreen650',!!this.mapExpanded);
  if(!this.mapExpanded&&this.matches(':fullscreen'))document.exitFullscreen?.().catch(()=>{});
  const result=old.render.apply(this,args),root=this.shadowRoot;
  root.querySelectorAll('[data-free-page650]').forEach(button=>button.onclick=async()=>{this.candidatePage=Math.max(0,Number(button.dataset.freePage650));await this.load();this.scheduleTop650();});
  const form=root.querySelector('[data-free-search650]');
  if(form){form.onsubmit=async event=>{event.preventDefault();this.candidateQuery=form.elements.query.value.trim();this.candidatePageSize650=form.elements.size.value;this.candidatePage=0;await this.load();this.scheduleTop650();};form.elements.size.onchange=()=>form.requestSubmit();}
  return result;
 };
});
