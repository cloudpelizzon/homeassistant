const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const file=process.argv[2];const code=fs.readFileSync(file,'utf8').replace(/^import .*;\r?\n/gm,'');
const elements=new Map();const sandbox={HTMLElement:class{attachShadow(){return this.shadowRoot={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]}}},customElements:{define:(n,c)=>elements.set(n,c),get:n=>elements.get(n)},console,setTimeout,clearTimeout};
vm.runInNewContext(code+';globalThis.Panel131=CloudPelizzonEnergyPanel;',sandbox);
(async()=>{const panel=new sandbox.Panel131();let calls=0,renders=0;panel._syncDraft=()=>{};panel._render=()=>renders++;panel._ws=async type=>{assert.equal(type,'cloudpelizzon/energy/discover');calls++;return {power:[{entity_id:'sensor.inversor_power',name:'Inversor solar potencia'},{entity_id:'sensor.house_power',name:'Consumo total da casa'}],energy:[],suggestions:{}}};
 await panel._refreshDiscovery();assert.equal(calls,1);assert.equal(panel._detecting,false);assert(panel._cfg.generation.length>0);assert(panel._detectFeedback.includes('2 sensores'));assert(renders>=2);
 panel._ws=async()=>{throw Error('synthetic denied')};await panel._refreshDiscovery();assert.equal(panel._detecting,false);assert(panel._detectFeedback.includes('synthetic denied'));
 console.log('SOLAR131=LIVE_REFRESH_SELECTION_AND_VISIBLE_ERROR_OK');
})().catch(e=>{console.error(e);process.exitCode=1});
