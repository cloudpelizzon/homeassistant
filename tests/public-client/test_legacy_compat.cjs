const fs=require('fs'),vm=require('vm'),assert=require('assert');
let activations=0,posted=null,checks=0;
const popup={opener:{},location:{replace:url=>posted={fallback:url}},document:{body:{append:form=>posted={action:form.action,method:form.method,input:form.input}},
 createElement:tag=>tag==='form'?{append(input){this.input=input},submit(){}}:{}}};
class LegacyPanel{
 constructor(){this.localName='cloudpelizzon-core-panel';this.ownerDocument={defaultView:{open:()=>popup}};
 this.shadowRoot={querySelector:()=>null,querySelectorAll:()=>[],activeElement:null};
 this._hass={callWS:async msg=>{assert.equal(msg.type,'cloudpelizzon/core/portal/pair');return{assertion:'a'.repeat(140)}}};}
 v2TrialButton(module){return ['CP-MAINTENANCE','CP-SOLAR','CP-SECURITY','CP-AUTOMATION'].includes(module.sku)?'old-trial-button':'';}
 cpModuleStatus(){return 'old status';}
 v2StartTrial(){activations++;}
 cpOpenSecurePortal(){return '/portal/pair/start';}
 toast(){}
 render(){this.rendered=true;}
}
const panel=new LegacyPanel();
const context={window:{},MutationObserver:class{observe(){}},URL,setTimeout:()=>1,
 document:{querySelectorAll:()=>[panel]}};
vm.runInNewContext(fs.readFileSync(process.argv[2],'utf8'),context);
(async()=>{
 assert(panel.rendered);checks++;
 for(const sku of ['CP-UNKNOWN']){
  const module={sku,trial:{verified:true,phase:'not_started'},license:{allowed:false}};
  assert(!panel.v2TrialButton(module).includes('old-trial-button'));
  assert.equal(panel.cpModuleStatus(module),'Teste ainda indisponível');
  panel.v2StartTrial(sku);assert.equal(activations,0);checks++;
 }
 panel.v2StartTrial('CP-SOLAR');panel.v2StartTrial('CP-AUTOMATION');panel.v2StartTrial('CP-SECURITY');assert.equal(activations,3);checks++;
 assert.equal(panel.cpModuleStatus({sku:'CP-SECURITY',trial:{phase:'trial_active',verified:true}}),'old status');checks++;
 await panel.cpOpenSecurePortal({preventDefault(){},stopPropagation(){}});
 assert.equal(posted.action,'https://cliente.cloudpelizzon.com.br/login');assert.equal(posted.method,'POST');
 assert.equal(posted.input.name,'assertion');assert.equal(posted.input.value,'a'.repeat(140));assert.equal(popup.opener,null);checks++;
 console.log(JSON.stringify({legacy_UI_compatibility_checks:checks,real_trial_activations:0}));
})().catch(error=>{console.error(error);process.exitCode=1});
