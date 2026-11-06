customElements.whenDefined('cloudpelizzon-inventory-panel').then(()=>{
 const P=customElements.get('cloudpelizzon-inventory-panel'),original=P.prototype.deviceForm;
 P.prototype.deviceForm=async function(...args){
  const result=await original.apply(this,args),d=[...this.shadowRoot.querySelectorAll('dialog[open]')].reverse().find(d=>d.querySelector('#device-form'));
  if(!d||d.dataset.layout637)return result;d.dataset.layout637='1';
  const deck=d.querySelector('.cmdb-deck515'),form=d.querySelector('#device-form');
  let pager=document.createElement('div');pager.className='cmdb-pager637';pager.innerHTML='<button type="button" data-prev637>← Anterior</button><span role="status" aria-live="polite"></span><button type="button" data-next637>Próxima →</button>';deck.before(pager);
  const state=new Map();let current='identity',scheduled=false;
  for(const page of deck.querySelectorAll('[data-cmdb-page]')){
   const fields=page.querySelector('.cmdb-fields');state.set(page.dataset.cmdbPage,{page,fields,items:[...fields.children],parts:[],at:0});
  }
  function show(){
   const s=state.get(current);if(!s)return;
   s.items.forEach(el=>el.classList.toggle('cmdb-part-hidden637',!s.parts[s.at]?.includes(el)));
   pager.hidden=s.parts.length<=1;pager.querySelector('span').textContent=`${s.at+1} de ${s.parts.length}${s.parts[s.at]?.some(x=>x.matches('[data-documents635]'))?' · Documentos':''}`;
   pager.querySelector('[data-prev637]').disabled=s.at===0;pager.querySelector('[data-next637]').disabled=s.at>=s.parts.length-1;
  }
  function layout(){
   scheduled=false;if(!d.open)return;
   for(const [key,s]of state){
    if(key!==current)continue;
    s.items.forEach(el=>el.classList.toggle('cmdb-part-hidden637',el.matches('[data-documents635]')));s.parts=[];
    // Fit real fields to the available area rather than introducing nested scrollbars.
    const height=Math.max(120,deck.clientHeight-s.page.querySelector('.cmdb-page-title515').getBoundingClientRect().height-32);
    let part=[];
    for(const item of s.items){
     s.items.forEach(el=>el.classList.toggle('cmdb-part-hidden637',!part.includes(el)&&el!==item));
     if(part.length&&(item.matches('[data-documents635]')||part.some(x=>x.matches('[data-documents635]'))||s.fields.getBoundingClientRect().height>height)){
      s.parts.push(part);part=[item];
     }else part.push(item);
    }
    if(part.length)s.parts.push(part);s.at=Math.min(s.at,Math.max(0,s.parts.length-1));
   }
   show();
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(layout);}}
  pager.querySelector('[data-prev637]').onclick=()=>{state.get(current).at--;show();};pager.querySelector('[data-next637]').onclick=()=>{state.get(current).at++;show();};
  d.querySelectorAll('[data-cmdb-tab]').forEach(b=>b.addEventListener('click',()=>{current=b.dataset.cmdbTab;schedule();}));
  form.addEventListener('invalid',e=>{const item=[...state.values()].find(s=>s.page.contains(e.target));if(!item)return;current=item.page.dataset.cmdbPage;d.querySelector(`[data-cmdb-tab="${current}"]`).click();requestAnimationFrame(()=>{const s=state.get(current);s.at=s.parts.findIndex(p=>p.some(el=>el.contains(e.target)));show();e.target.focus();});},true);
  const observer=new ResizeObserver(schedule);observer.observe(d);d.addEventListener('close',()=>observer.disconnect(),{once:true});schedule();return result;
 };
});
