const fs=require("node:fs"),assert=require("node:assert/strict");
const root=process.argv[2],read=p=>fs.readFileSync(root+"/"+p,"utf8");
const files={
 sdk:read("adapters/automation/lib/cloudpelizzon_client/client.py"),
 projection:read("public_core/projection.py"),
 trial:read("public_trials.py"),shell:read("ui/shell/panel.js"),
 optional:read("ui/shell/optional-modules.js"),
 metadata:read("public_core/metadata.py"),
 core:read("ui/core/panel.js"),manifest:read("manifest.json")
};
assert(files.manifest.includes("7.0.0-alpha.55"));
assert(files.sdk.includes("SIGNED_STATUS_SKU_SETS"));
assert(files.projection.includes("SIGNED_CLAIM_SKU_SETS"));
assert(files.projection.includes("frozenset(records) not in SIGNED_CLAIM_SKU_SETS"));
assert(files.sdk.includes('frozenset(claim["modules"]) not in SIGNED_STATUS_SKU_SETS'));
assert(files.metadata.includes("CP-LIGHTING"));
assert(files.optional.includes("cloudpelizzon-lighting-panel"));
assert(!files.optional.includes('customElements.define("cloudpelizzon-lighting-panel"'));
assert(files.shell.includes('cloudpelizzon-module-slot sku="CP-LIGHTING"'));
assert(files.shell.includes('lighting:"CP-LIGHTING"'));
assert(files.shell.includes('showProtectedView("lighting")'));
assert(files.shell.includes('isModuleAllowed("CP-LIGHTING")'));
assert(files.core.includes('"CP-LIGHTING": {'));
assert(files.trial.includes("'CP-LIGHTING'"));
assert(!/ACTIVATION_READY[^\n]*CP-LIGHTING/.test(files.trial));
console.log("CP_LIGHTING_HACS_ALPHA55=READINESS_ONLY;SERVER_TRIAL_ACTIVATION=DENIED_UNTIL_PRIVATE_SKU_READY;HA_EXTERNAL_PANEL=NONE");
