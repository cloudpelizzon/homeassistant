const fs=require('fs'),vm=require('vm'),assert=require('assert');
function run(file,returnHtml){const classes=new Map();let captured=null,opens=0;const BaseDate=Date;class FixedDate extends Date{constructor(...a){super(...(a.length?a:['2026-10-19T00:06:34Z']))}}
 const ctx={HTMLElement:class{},console,Date:FixedDate,window:{open:()=>{opens++;return{document:{write:s=>captured=s,close(){}}}}},customElements:{get:n=>classes.get(n),define:(n,c)=>classes.set(n,c)},alert:e=>{throw Error(e)}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),ctx);const card=Object.create(classes.get('cloudpelizzon-maintenance-v311-core').prototype);
 const record={id:'synthetic',date:'2026-10-18',name:'Corte de grama — exemplo',category:'Casa',executor:'Responsável / morador',provider:'',products:'',productsCost:0,laborCost:0,paid:0,saving:100,marketLabor:100,notes:'Dados fictícios'};
 const item={id:'fixture',name:record.name,category:'Casa'};
 Object.assign(card,{houseProfile:()=>({name:'Residência de teste',type:'Casa',logo:'',address:'Endereço fictício',cityState:'Cidade / UF'}),items:()=>[item],
 financeRecords:[record],financeStartDate:'2026-01-01',financeEndDate:'2026-12-31',financeCategory:'Todas',categoryDefinitions:()=>[{name:'Casa'}],
 provisionSchedule:()=>[{date:'2026-12-17',item,estimate:{material:0,labor:100,total:100}}],financeRecordsForItem:()=>[record],estimateFor:()=>({material:0,labor:100,total:100})});
 const result=card.exportFinanceReport([record],'complete',returnHtml);return{html:returnHtml?result:captured,opens,history:returnHtml?card.exportFinanceReport([record],'history',true):null};}
const old=run(process.argv[2],false),fresh=run(process.argv[3],true);assert.equal(old.html,fresh.html);assert.equal(fresh.opens,0);
fs.writeFileSync(process.argv[4],fresh.html);fs.writeFileSync(process.argv[5],fresh.history);
console.log(JSON.stringify({pdf_HTML_unchanged:true,excel_uses_identical_report_HTML:true,no_popup_for_export_data:true}));
