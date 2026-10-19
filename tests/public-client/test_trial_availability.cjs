const fs=require('fs'),vm=require('vm'),assert=require('assert');
const classes=new Map();let requests=0,confirmations=0,checks=0;
const context={HTMLElement:class{},customElements:{get:n=>classes.get(n),define:(n,c)=>classes.set(n,c)},
 document:{},window:{},console,confirm:()=>{confirmations++;return true},setTimeout:()=>0};
vm.runInNewContext(fs.readFileSync(process.argv[2],'utf8').replace(/^import .*;\r?$/gm,''),context);
const Core=classes.get('cloudpelizzon-core-panel'),core=Object.create(Core.prototype);
core.esc=x=>String(x);core.toast=()=>{};core.load=async()=>{};
core._hass={callWS:async()=>{requests++;return{first_activation:true}}};
(async()=>{
 for(const sku of ['CP-SECURITY']){
   const module={sku,trial:{verified:true,phase:'not_started'},license:{allowed:false}};
   assert(!core.v2TrialButton(module).includes('data-start-trial'));
   assert.equal(core.cpModuleStatus(module),'Teste ainda indisponível');
   await core.v2StartTrial(sku);assert.equal(requests,0);assert.equal(confirmations,0);checks++;
 }
 for(const sku of ['CP-MAINTENANCE','CP-SOLAR','CP-AUTOMATION']){
   const module={sku,trial:{verified:true,phase:'not_started'},license:{allowed:false}};
   assert(core.v2TrialButton(module).includes('data-start-trial'));
   await core.v2StartTrial(sku);checks++;
 }
 assert.equal(requests,3);assert.equal(confirmations,3);
 const existing={sku:'CP-SECURITY',trial:{verified:true,phase:'trial_active',paid_confirmed:false}};
 assert(core.cpTrialActive(existing));assert(!core.v2TrialButton(existing));checks++;
 assert(!core.v2TrialButton({sku:'CP-SOLAR',trial:{verified:false,phase:'not_started'}}));checks++;
 assert(core.cpModuleStatus({sku:'CP-AUTOMATION',license:{allowed:true,status:'licensed'}}).includes('Licenciado'));checks++;
 console.log(JSON.stringify({trial_availability_checks:checks,network_requests:0,real_trial_activations:0}));
})().catch(error=>{console.error(error);process.exitCode=1});
