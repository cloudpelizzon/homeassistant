const fs=require('fs'),vm=require('vm'),assert=require('assert');
const classes=new Map();let requests=0,confirmations=0,checks=0;
const context={HTMLElement:class{},customElements:{get:n=>classes.get(n),define:(n,c)=>classes.set(n,c)},
 document:{},window:{addEventListener(){},removeEventListener(){},},console,confirm:()=>{confirmations++;return true},setTimeout:()=>0};
vm.runInNewContext(fs.readFileSync(process.argv[2],'utf8').replace(/^import .*;\r?$/gm,''),context);
const Core=classes.get('cloudpelizzon-core-panel'),core=Object.create(Core.prototype);
core.esc=x=>String(x);core.toast=()=>{};core.load=async()=>{};
core._hass={callWS:async()=>{requests++;return{first_activation:true}}};
(async()=>{
 for(const sku of ['CP-UNKNOWN']){
   const module={sku,trial:{verified:true,phase:'not_started'},license:{allowed:false}};
   assert(!core.v2TrialButton(module).includes('data-start-trial'));
   assert.equal(core.cpModuleStatus(module),'Teste ainda indisponível');
   await core.v2StartTrial(sku);assert.equal(requests,0);assert.equal(confirmations,0);checks++;
 }
 for(const sku of ['CP-MAINTENANCE','CP-SOLAR','CP-AUTOMATION','CP-SECURITY']){
   const module={sku,trial:{verified:true,phase:'not_started'},license:{allowed:false}};
   assert(core.v2TrialButton(module).includes('data-start-trial'));
   await core.v2StartTrial(sku);checks++;
 }
 assert.equal(requests,4);assert.equal(confirmations,4);
 const existing={sku:'CP-SECURITY',trial:{verified:true,phase:'trial_active',paid_confirmed:false}};
 assert(core.cpTrialActive(existing));assert(!core.v2TrialButton(existing));checks++;
 assert(!core.v2TrialButton({sku:'CP-SOLAR',trial:{verified:false,phase:'not_started'}}));checks++;
 assert(core.cpModuleStatus({sku:'CP-AUTOMATION',license:{allowed:true,status:'licensed'}}).includes('Licenciado'));checks++;
 const lighting={sku:'CP-LIGHTING',lifecycle:'planned',license:{allowed:false},trial:{verified:true,phase:'not_started',paid_confirmed:false}};
 assert.equal(core.moduleState229(lighting),'available');
 assert(core.v2TrialButton(lighting).includes('Iniciar teste de 7 dias'));
 assert.equal(requests,4);assert.equal(confirmations,4);checks++;
 const unverified={...lighting,license:{allowed:false,status:'unverified'},trial:{...lighting.trial,verified:false}};
 assert.equal(core.moduleState229(unverified),'unknown');assert(!core.v2TrialButton(unverified));checks++;
 const expired={...lighting,trial:{verified:true,phase:'trial_active',paid_confirmed:false,blocks_at:new Date(Date.now()-60000).toISOString()}};
 assert.equal(core.moduleState229(expired),'expired');assert(!core.v2TrialButton(expired));checks++;
 const paid={...lighting,license:{allowed:true,status:'licensed'}};
 assert.equal(core.moduleState229(paid),'pending');assert(!core.v2TrialButton(paid));
 assert.equal(core.moduleState229({...paid,local_installed:true}),'local');checks++;
 console.log(JSON.stringify({trial_availability_checks:checks,network_requests:0,real_trial_activations:0}));
})().catch(error=>{console.error(error);process.exitCode=1});
