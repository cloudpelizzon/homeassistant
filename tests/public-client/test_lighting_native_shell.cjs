/* Native CP-LIGHTING shell gate — no unverified trial or physical effects. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const [metadata,optional,shell,core,trial,sdk,projection]=process.argv.slice(2).map(p=>fs.readFileSync(p,'utf8'));
assert(metadata.includes('CP-LIGHTING'));
assert(optional.includes('cloudpelizzon-lighting-panel'));
assert(optional.includes('Release Center'));
assert(!optional.includes('customElements.define("cloudpelizzon-lighting-panel"'));
assert(shell.includes('lighting:"CP-LIGHTING"'));
assert(shell.includes('isModuleAllowed("CP-LIGHTING")'));
assert(shell.includes('cloudpelizzon-module-slot sku="CP-LIGHTING"'));
assert(shell.includes('showProtectedView("lighting")'));
assert(shell.includes('"lighting"&&!this.isModuleAllowed("CP-LIGHTING")'));
assert(core.includes('"CP-LIGHTING"'));
assert(!trial.match(/SKUS\s*=[^\n]*CP-LIGHTING/));
assert(!sdk.match(/SKUS\s*=[^\n]*CP-LIGHTING/));
assert(!projection.match(/SKUS\s*=[^\n]*CP-LIGHTING/));
console.log('native_shell_tests=13; new_trial_started=0; physical_effects=0');
