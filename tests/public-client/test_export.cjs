const fs=require('fs'),vm=require('vm'),assert=require('assert');
const classes=new Map(),downloads=[],revoked=[];let checks=0;
const context={HTMLElement:class{},console,window:{localStorage:{}},
  Blob,URL:{createObjectURL:blob=>{downloads.push({blob});return 'blob:synthetic'},
    revokeObjectURL:url=>revoked.push(url)},
  document:{createElement:()=>({click(){downloads.at(-1).clicked=true;downloads.at(-1).name=this.download},
    remove(){downloads.at(-1).removed=true}}),body:{appendChild(){}}},
  setTimeout:f=>f(),customElements:{get:n=>classes.get(n),define:(n,c)=>classes.set(n,c)}};
vm.runInNewContext(fs.readFileSync(process.argv[2],'utf8').replace(/^import .*;\r?$/gm,''),context);
const C=classes.get('cloudpelizzon-automation-panel');
(async()=>{
  const panel=Object.create(C.prototype);
  panel._settings=()=>({scope:'selected',native_selection:['automation.synthetic','light.not_an_automation'],
    rule_selection:['CUS-00000001','private-seed'],category_selection:['CASA'],
    category_names:{CASA:'Casa'},token:'synthetic-secret-must-not-export'});
  panel._native=()=>[{entity_id:'automation.synthetic',name:'Local synthetic',category:'CASA',state:'on',
    selected:true,last_triggered:null,private_key:'synthetic-key-must-not-export',actions:[{private:'do not export'}]}];
  panel._rules=()=>[{code:'CUS-00000001',alias:'Customer rule',category:'CASA',revision:3,active:false,
    private_policy:'synthetic-private-policy-must-not-export'}];
  panel._hass={auth:{access_token:'synthetic-ha-token-must-not-export'}};
  panel.ws=()=>{throw Error('Export must not send network requests')};panel._toast=m=>{panel.feedback=m};
  panel._exportConfiguration();
  assert.equal(downloads.length,1);assert(downloads[0].clicked&&downloads[0].removed);checks++;
  assert.equal(revoked.length,1);checks++;
  const text=await downloads[0].blob.text(),data=JSON.parse(text);
  assert.equal(data.schema,'cp.automation.client.export.v1');checks++;
  assert.deepEqual(data.settings.native_selection,['automation.synthetic']);checks++;
  assert.deepEqual(data.settings.rule_selection,['CUS-00000001']);checks++;
  assert.equal(data.native_automations.length,1);assert.equal(data.native_automations[0].entity_id,'automation.synthetic');checks++;
  assert.equal(data.module_rules[0].revision,3);checks++;
  assert(!text.includes('must-not-export'));assert(!text.includes('private_policy'));assert(!text.includes('actions'));checks++;
  assert.match(downloads[0].name,/^cloudpelizzon-automacoes-\d{4}-\d{2}-\d{2}\.json$/);checks++;
  panel.shadowRoot={contains:()=>true};
  await panel._click({target:{closest:()=>({dataset:{action:'export'},disabled:false})}});
  assert.equal(downloads.length,2);checks++;
  console.log(JSON.stringify({export_checks:checks,network_requests:0,real_device_commands:0,
    scope:'original_UI_methods_with_recording_browser_DOM_not_browser_E2E'}));
})().catch(e=>{console.error(e);process.exitCode=1});
