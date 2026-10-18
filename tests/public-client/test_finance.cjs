const fs=require('fs'),vm=require('vm'),assert=require('assert');
const classes=new Map(),downloads=[];
const ctx={alert:()=>{},HTMLElement:class{},console,window:{},Blob,TextEncoder,Uint8Array,Date,Map,Set,
 customElements:{get:n=>classes.get(n),define:(n,c)=>classes.set(n,c)},setTimeout:()=>0,clearTimeout(){},queueMicrotask:f=>f(),requestAnimationFrame:f=>f(),
 URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:fixture'},revokeObjectURL(){}},document:{createElement:()=>({click(){},remove(){}})}};
vm.runInNewContext(fs.readFileSync(process.argv[2],'utf8'),ctx);
const P=classes.get('cloudpelizzon-maintenance-v311-core').prototype;
const nodes=new Map();function node(id,value='0'){let n={value,textContent:'',classList:{contains:()=>false}};nodes.set(id,n);return n;}
const modal={innerHTML:'',querySelector:s=>nodes.get(s)};
for(const s of ['#f-products-cost','#f-labor-cost','#f-market-labor','#f-saving','#f-est-material','#f-est-labor','#f-products-preview','#f-labor-preview','#f-paid-preview','#f-saving-preview','#f-est-total','#f-executor','[data-close]','[data-cancel]','.overlay','[data-save]'])node(s);
nodes.get('#f-executor').value='Responsável / morador';nodes.get('#f-market-labor').value='100';nodes.get('#f-est-labor').value='100';
const card=Object.create(P);Object.assign(card,{shadowRoot:{querySelector:()=>modal},_localDateValue:()=> '2026-10-18',estimateFor:()=>({material:0,labor:100,total:100}),money:v=>String(v),maintenanceMdi:()=>'',icon:()=>'',escapeHtml:v=>v});
card.openFinanceEntry({name:'Synthetic',category:'Casa'});
assert.equal(nodes.get('#f-saving').value,'100.00');
nodes.get('#f-saving').value='80';nodes.get('#f-saving').oninput();assert.equal(nodes.get('#f-saving').value,'80');
nodes.get('#f-products-cost').value='20';nodes.get('#f-products-cost').oninput();assert.equal(nodes.get('#f-saving').value,'80');
nodes.get('#f-market-labor').value='120';nodes.get('#f-market-labor').oninput();assert.equal(nodes.get('#f-saving').value,'120.00');
node('#f-date','2026-10-18');for(const s of ['#f-provider','#f-products','#f-notes'])node(s,'');
let calls=[];Object.assign(card,{financeEstimates:{},financeRecords:[],recommendationCache:new Map(),saveFinanceEstimates(){},__cpSaveSnapshot:async()=>calls.push('save'),_setMaintenanceExecutionDate:async(i,d,r)=>{calls.push('complete');assert.equal(r.saving,120);assert.equal(r.productsCost,20)},h:{callService:async()=>{}},update(){}});
(async()=>{await nodes.get('[data-save]').onclick();assert.deepEqual(calls,['complete','save']);assert.equal(card.financeRecords.length,1);
 let failed=true,completions=0;
 card.__cpSaveSnapshot=async()=>{if(failed){failed=false;throw Error('synthetic offline')}};
 card._setMaintenanceExecutionDate=async()=>{completions++};
 card.openFinanceEntry({name:'Synthetic retry',category:'Casa'});
 await nodes.get('[data-save]').onclick();assert.equal(completions,1);
 await nodes.get('[data-save]').onclick();assert.equal(completions,1);
 // Exercise original XLSX writer, not a separate workbook builder.
 const x=Object.create(P);Object.assign(x,{houseProfile:()=>({name:'Synthetic'}),normalizeFinanceRecords:r=>r,
 financeStartDate:'2026-01-01',financeEndDate:'2026-12-31',financeCategory:'Todas',financeRecords:[],
 financeProvisionEntries:()=>[],items:()=>[],financeRecordsForItem:()=>[],financePeriodMonths:()=>[],categoryDefinitions:()=>[],fmt:v=>v,money:v=>String(v),showToast(){}});
 await x.exportFinanceExcel([]);assert.equal(downloads.length,1);fs.writeFileSync(process.argv[3],Buffer.from(await downloads[0].arrayBuffer()));
 console.log(JSON.stringify({finance_input_checks:4,completion_finance_checks:3,excel_generated:true}));
})().catch(e=>{console.error(e);process.exitCode=1});
