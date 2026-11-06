/* Keep every field of the selected CMDB section in one scrollable editor. */
customElements.whenDefined('cloudpelizzon-inventory-panel').then(()=>{
 const P=customElements.get('cloudpelizzon-inventory-panel'),original=P.prototype.deviceForm;
 P.prototype.deviceForm=async function(...args){
  const result=await original.apply(this,args),dialog=[...this.shadowRoot.querySelectorAll('dialog[open]')].reverse().find(d=>d.querySelector('#device-form'));
  if(!dialog||dialog.dataset.layout650)return result;
  dialog.dataset.layout637='1';dialog.dataset.layout650='scroll';
  const deck=dialog.querySelector('.cmdb-deck515');
  dialog.querySelectorAll('.cmdb-part-hidden637').forEach(field=>field.classList.remove('cmdb-part-hidden637'));
  dialog.querySelectorAll('[data-cmdb-tab]').forEach(button=>button.addEventListener('click',()=>{deck.scrollTop=0;}));
  dialog.querySelector('#device-form').addEventListener('invalid',event=>{
   const page=event.target.closest('[data-cmdb-page]');if(!page)return;
   dialog.querySelector(`[data-cmdb-tab="${page.dataset.cmdbPage}"]`)?.click();
   requestAnimationFrame(()=>event.target.scrollIntoView({block:'nearest'}));
  },true);
  return result;
 };
});
