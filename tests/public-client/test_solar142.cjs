const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const elements=new Map(),context={HTMLElement:class{attachShadow(){return this.shadowRoot={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]}}},customElements:{define:(n,c)=>elements.set(n,c),get:n=>elements.get(n)},console,setTimeout,clearTimeout};
vm.createContext(context);vm.runInContext(fs.readFileSync(process.argv[2],'utf8').replace(/^import .*;\r?\n/gm,''),context);
const Panel=elements.get('cloudpelizzon-energy-panel');
const good={configured:true,site:{phases:1},grid:{mode:'derived',net_sign:'import_positive'},generation:[{power_entity:'sensor.inverter_power',energy_entity:'sensor.inverter_energy',power_transform:'absolute'}],boards:[]};
function panel(){const p=new Panel();p._syncDraft=()=>{};p._render=()=>{};p._renderMessage=()=>{p.shownSuccess=true};p._cfg=JSON.parse(JSON.stringify(good));return p;}
(async()=>{
 const p=panel();p._error='Obsolete saved topology warning';p._ws=async()=>({power:[{entity_id:'sensor.inverter_power',name:'Inversor solar potência'}],energy:[]});await p._refreshDiscovery();assert.equal(p._error,'');
 for(const scenario of ['ok','mismatch','save_failure','read_failure']){
   const p=panel(),calls=[];p._ws=async(type)=>{calls.push(type);if(type.endsWith('/save')){if(scenario==='save_failure')throw Error('synthetic save rejected');return {ok:true};}if(scenario==='read_failure')throw Error('synthetic read unavailable');const config=JSON.parse(JSON.stringify(good));if(scenario==='mismatch')config.generation[0].power_entity='sensor.other';return {config,normalized_entities:{generation_power:'sensor.cloudpelizzon_energy_generation_power'}};};
   await p._save();assert.equal(Boolean(p.shownSuccess),scenario==='ok');if(scenario==='ok')assert.equal(p._normalized.generation_power,'sensor.cloudpelizzon_energy_generation_power');else assert(p._error);
   assert.equal(calls.length,scenario==='save_failure'?1:2);
 }
 console.log('SOLAR142=obsolete_warning_cleared; success_requires_exact_server_readback; failures_preserve_draft_and_never_claim_saved');
})().catch(e=>{console.error(e);process.exitCode=1});
