const fs=require('fs'),vm=require('vm'),assert=require('assert'),root=process.argv[2];
const classes=new Map(),ctx={HTMLElement:class{},console,document:{},window:{innerWidth:1920},CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options)}},customElements:{get:n=>classes.get(n),define:(n,c)=>classes.set(n,c)},setTimeout:()=>0,clearTimeout(){}};
vm.createContext(ctx);
for(const file of ['ui/core/panel.js','ui/shell/panel.js'])vm.runInContext('(function(){'+fs.readFileSync(root+'/'+file,'utf8').replace(/^import .*;\r?$/gm,'')+'})();',ctx);
const Core=classes.get('cloudpelizzon-core-panel'),Root=classes.get('cloudpelizzon-panel');
const core=Object.create(Core.prototype);core.esc=s=>String(s);core.renderHomeCarousel=()=>'';core.renderProductPreview=()=>'';
for(const sku of ['CP-MAINTENANCE','CP-SOLAR','CP-SECURITY','CP-AUTOMATION']){
 for(const phase of ['trial_active','trial_blocked','not_started','licensed']){
  const module={sku,name:sku,path:'/synthetic',installed:true,lifecycle:'developed',license:{allowed:phase==='licensed'},trial:{verified:true,phase,paid_confirmed:phase==='licensed',blocks_at:new Date(Date.now()+60000).toISOString()}};
  assert.equal(core.activeCard(module).includes(`data-request="${sku}"`),phase!=='licensed');
  assert.equal(core.lockedCard(module).includes(`data-request="${sku}"`),phase!=='licensed');
 }
}
const shell=Object.create(Root.prototype),button={hidden:true,dataset:{}};
shell.shadowRoot={querySelector:()=>button};
for(const [view,sku] of Object.entries({maintenance:'CP-MAINTENANCE',energy:'CP-SOLAR',security:'CP-SECURITY',automation:'CP-AUTOMATION'})){
 shell._view=view;shell.updateRequestCTA161();assert.equal(button.hidden,false);assert.equal(button.dataset.sku,sku);
}
shell._view='core';shell.updateRequestCTA161();assert(button.hidden);
// Standalone contact mode must not start background status/trial timers.
const dialog=Object.create(Core.prototype);dialog.requestOnly161=true;dialog.connectedCallback();
assert.equal(dialog.cpTrialTimer,undefined);
console.log(JSON.stringify({catalog_states_checked:16,module_views_checked:4,trial_activations:0,real_contact_submissions:0}));
