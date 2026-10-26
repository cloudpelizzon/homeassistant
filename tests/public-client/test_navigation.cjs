const fs=require('fs'),vm=require('vm'),assert=require('assert');
function load(path,tag){
 const classes=new Map();
 const context={HTMLElement:class{addEventListener(name,fn){this.handlers[name]=fn}},
   CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options)}},console,
   document:{createElement:()=>({style:{},setAttribute(){}})},requestAnimationFrame:fn=>fn(),window:{addEventListener(){},removeEventListener(){},},customElements:{get:n=>classes.get(n),define:(n,c)=>classes.set(n,c)}};
 vm.runInNewContext(fs.readFileSync(path,'utf8').replace(/^import .*;\r?$/gm,''),context);
 return classes.get(tag);
}
const Root=load(process.argv[2],'cloudpelizzon-panel');
const Core=load(process.argv[3],'cloudpelizzon-core-panel');
let checks=0;
function shell(){const s=Object.create(Root.prototype);s.handlers={};s._view='core';s._moduleRights={};s._moduleRightsLoaded=true;
 s.isConnected=true;s.shadowRoot={querySelector:()=>null,querySelectorAll:()=>[],append(){}};
 s.render=()=>{};s.propagateHass=()=>{};s.show=v=>{s._view=v};s.connectedCallback();return s;}
(async()=>{
 const s=shell();let refreshes=0;
 s.loadModuleRights=async force=>{assert(force);refreshes++;s._moduleRights={'CP-MAINTENANCE':true};return true};
 s.showProtectedView=function(view){return this.pending=Root.prototype.showProtectedView.call(this,view)};
 s.handlers['cloudpelizzon-open-module']({detail:{path:'/cloudpelizzon-maintenance'}});
 await s.pending;assert.equal(refreshes,1);assert.equal(s._view,'maintenance');checks++;
 s._moduleRights={'CP-MAINTENANCE':true};s.loadModuleRights=async()=>false;
 s.handlers['cloudpelizzon-open-module']({detail:{path:'/cloudpelizzon-maintenance'}});
 await s.pending;assert.equal(s._view,'core');checks++;
 const c=Object.create(Core.prototype);let event;
 c._hass={callWS:async()=>({modules:[{sku:'CP-MAINTENANCE',license:{allowed:false},trial:{verified:true,phase:'trial_active',paid_confirmed:false}}]})};
 c.data={modules:[]};c.loading=false;c.render=()=>{};c.dispatchEvent=e=>{event=e};
 await c.load();assert.equal(event.type,'cloudpelizzon-module-rights-changed');assert(event.bubbles&&event.composed);checks++;
 s.handlers[event.type](event);assert(s._moduleRights['CP-MAINTENANCE']);checks++;
 s._view='maintenance';
 s.handlers[event.type]({detail:{modules:[{sku:'CP-MAINTENANCE',license:{allowed:false},trial:{verified:false,phase:'trial_active',paid_confirmed:false}}]}});
 assert(!s._moduleRights['CP-MAINTENANCE']);assert.equal(s._view,'core');checks++;
 s.handlers[event.type]({detail:{modules:[{sku:'CP-MAINTENANCE',license:{allowed:false},trial:{verified:true,phase:'trial_blocked',paid_confirmed:false}}]}});
 assert(!s._moduleRights['CP-MAINTENANCE']);checks++;
 console.log(JSON.stringify({navigation_checks:checks,scope:'actual_UI_methods_with_recording_DOM_and_signed_status_result_fixtures',network_requests:0,trial_activations:0}));
})().catch(e=>{console.error(e);process.exitCode=1});
