import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync('custom_components/cloudpelizzon/ui/updater/panel.js','utf8').split('/* CP_DOCUMENTATION233:')[1];
function render(licensed_modules){
 class Panel {render(){} querySelector(){return {append:section=>this.result=section.innerHTML};}}
 const context={customElements:{get:()=>Panel},document:{createElement:()=>({style:{}})}};
 vm.runInNewContext('/*'+source,context);
 const panel=new Panel();panel.data={licensed_modules};panel.render();return panel.result;
}
const maintenance=render(['CP-MAINTENANCE']);
assert(maintenance.includes('Manutenção Residencial Preventiva'));
assert(maintenance.includes('CloudPelizzon Core'));
assert(maintenance.includes('Documentação e Atualizações'));
for(const name of ['Inteligência Solar','Central de Segurança Pro','Central Inteligente de Automações','Iluminação Inteligente'])assert(!maintenance.includes(name));
for(const licenses of [[],undefined])assert(!render(licenses).includes('Manutenção Residencial Preventiva'));
assert(render(['CP-SOLAR']).includes('Inteligência Solar'));
assert(!render(['CP-SOLAR']).includes('Manutenção Residencial Preventiva'));
console.log('License-scoped documentation: maintenance-only, no grants, missing grants and solar-only passed.');
