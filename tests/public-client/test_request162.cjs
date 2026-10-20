const fs=require('fs'),vm=require('vm'),assert=require('assert'),root=process.argv[2];
const classes=new Map(),ctx={HTMLElement:class{},console,document:{},window:{innerWidth:1920},customElements:{get:n=>classes.get(n),define:(n,c)=>classes.set(n,c)},setTimeout:()=>0,clearTimeout(){}};
vm.createContext(ctx);
for(const file of ['ui/core/panel.js','ui/shell/panel.js'])vm.runInContext('(function(){'+fs.readFileSync(root+'/'+file,'utf8').replace(/^import .*;\r?$/gm,'')+'})();',ctx);
const Core=classes.get('cloudpelizzon-core-panel'),Root=classes.get('cloudpelizzon-panel');
const views={maintenance:'CP-MAINTENANCE',energy:'CP-SOLAR',security:'CP-SECURITY',automation:'CP-AUTOMATION'};
const core=Object.create(Core.prototype);core.esc=s=>String(s);core.renderHomeCarousel=()=>'';core.renderProductPreview=()=>'';core.boardPreview=()=>'';
const shell=Object.create(Root.prototype),button={hidden:true,dataset:{}};
shell.shadowRoot={querySelector:()=>button};shell._hass={};shell._moduleRights={};shell._moduleRightsLoaded=false;
shell.render=()=>{throw Error('An unchanged access grant must not recreate the module')};shell.propagateHass=()=>{};
const fixture=(sku,phase)=>({sku,name:sku,path:'/synthetic',installed:true,lifecycle:'developed',license:{allowed:phase==='licensed',status:phase==='licensed'?'licensed':phase},trial:{verified:true,phase,paid_confirmed:phase==='licensed',blocks_at:new Date(Date.now()+60000).toISOString()}});
(async()=>{
let states=0;
for(const [view,sku] of Object.entries(views)){
 for(const phase of ['trial_active','trial_blocked','trial_removal_due','not_started','licensed','expired','revoked','unverified']){
  const m=fixture(sku,phase);core.data={modules:[m],license:{online_status:'active'}};
  for(const html of [core.activeCard(m),core.lockedCard(m),core.renderDetail(sku)])assert.equal(html.includes(`data-request="${sku}"`),phase!=='licensed',view+' '+phase);
  const expired=phase==='trial_blocked'||phase==='trial_removal_due';
  assert.equal(core.lockedCard(m).includes('<div class="actions">'),expired);
  if(expired){assert.equal((core.lockedCard(m).match(/<button /g)||[]).length,2);assert(!core.lockedCard(m).includes('data-open='));}
  shell._view=view;shell.updatePaidModules162([m]);assert.equal(button.hidden,phase==='licensed');states++;
 }
 // Trial -> paid keeps the same access rights, but must hide the CTA immediately.
 const m=fixture(sku,'trial_active');shell._moduleRights={[sku]:true};shell._moduleRightsLoaded=true;
 shell.updatePaidModules162([m]);assert.equal(button.hidden,false);
 shell.ws=async()=>({modules:[fixture(sku,'licensed')]});assert.equal(await shell.loadModuleRights(true),true);assert.equal(button.hidden,true);
 shell.openModuleRequest161(); // A hidden paid CTA must not open a second contact dialog.
 assert.equal(shell._requestHost161,undefined);
 // Revocation changes purchase eligibility even before an access rerender.
 shell.updatePaidModules162([fixture(sku,'revoked')]);assert.equal(button.hidden,false);
}
// Purchasing one module must not suppress trial purchase buttons for the others.
const mixed=Object.values(views).map((sku,i)=>fixture(sku,i===0?'licensed':'trial_active'));
shell.updatePaidModules162(mixed);
for(const [view,sku] of Object.entries(views)){shell._view=view;shell.updateRequestCTA161();assert.equal(button.hidden,sku==='CP-MAINTENANCE');}
// The event path must update eligibility before the existing equal-rights early return.
const source=fs.readFileSync(root+'/ui/shell/panel.js','utf8');assert(source.indexOf('this.updatePaidModules162(event?.detail?.modules || [])')<source.indexOf('&& anterior === novo'));
console.log(JSON.stringify({purchase_states:states,trial_to_paid_refreshes:4,per_module_isolation:true,real_contact_submissions:0}));
})().catch(e=>{console.error(e);process.exitCode=1});
