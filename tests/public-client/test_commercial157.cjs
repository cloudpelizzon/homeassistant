const fs=require('fs'),vm=require('vm'),assert=require('assert');
function load(file,tag){
 const classes=new Map(),ctx={HTMLElement:class{},console,window:{},document:{},
  customElements:{get:n=>classes.get(n),define:(n,c)=>classes.set(n,c)},setTimeout:()=>0,clearTimeout(){}};
 vm.runInNewContext(fs.readFileSync(file,'utf8').replace(/^import .*;\r?$/gm,''),ctx);
 return classes.get(tag);
}
const root=process.argv[2],Core=load(root+'/ui/core/panel.js','cloudpelizzon-core-panel');
const Maintenance=load(root+'/ui/maintenance/panel.js','cloudpelizzon-maintenance-panel');
async function check(Class,maintenance){
 const obj=Object.create(Class.prototype),prefix=maintenance?'#req-':'#request-';
 const fields={'name':'Synthetic','phone':'0000000','email':'test@example.invalid','subject':'Test','message':'Synthetic only'};
 const button={},body={innerHTML:'',querySelector:()=>null},inputs=Object.fromEntries(Object.entries(fields).map(([k,v])=>[prefix+k,{value:v}]));
 obj.shadowRoot={querySelector:id=>inputs[id]||(id==='#request-body'?body:button)};
 obj.requestSku='CP-SOLAR';obj.render=()=>obj.rendered=true;obj.messages=[];
 obj.toast=obj.showToast=(...args)=>obj.messages.push(args);
 const method=maintenance?'submitCommercialRequest':'submitRequest',sku=maintenance?'CP-MAINTENANCE':'CP-SOLAR';
 let finish,calls=0;obj._hass={callWS:msg=>{calls++;assert.equal(msg.sku,sku);return new Promise(resolve=>finish=resolve)}};
 const pending=obj[method]();await obj[method]();assert.equal(calls,1);assert(button.disabled);
 finish({ok:true,status:'registered',request_id:'REQ-012345ABCDEF',sku,email_status:'failed'});await pending;
 assert(!obj._commercialSending157);assert.equal(obj.messages.at(-1)[0],'Solicitação registrada com sucesso.');
 if(maintenance)assert(body.innerHTML.includes('ficou registrada no servidor'));
 else assert.equal(obj.requestResult.email_status,'failed');
 obj.requestResult=null;obj._requestResult=null;obj._hass.callWS=async()=>({ok:true});await obj[method]();
 assert.equal(obj.messages.at(-1)[1],'error');assert(!obj.requestResult&&!obj._requestResult);assert.equal(button.disabled,false);
 obj._hass.callWS=async()=>{throw Error('Serviço temporariamente indisponível')};await obj[method]();
 assert.equal(obj.messages.at(-1)[1],'error');assert.equal(inputs[prefix+'name'].value,'Synthetic');assert(!obj._commercialSending157);
}
(async()=>{await check(Core,false);await check(Maintenance,true);console.log(JSON.stringify({commercial_UI:'passed',actual_methods:2,real_contact_submissions:0}));})().catch(e=>{console.error(e);process.exitCode=1});
