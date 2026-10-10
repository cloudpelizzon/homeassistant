"use strict";
// Regression: the HA object must reach EVERY installed private panel slot.
// CloudPelizzon renders Maintenance, Energy and Security in one shadow root.
const fs = require("fs");
const assert = require("assert");
const source = fs.readFileSync(
  "custom_components/cloudpelizzon/frontend/panel.js", "utf8"
);
const found = source.match(/  propagateHass\(\) \{([\s\S]*?)\n  \}\n\}\n\n\nif \(/);
assert(found, "CloudPelizzon propagateHass not found");
const propagate = Function(found[1]);

const make = () => ({ hass: null });
const core = make(), maintenance = make(), energy = make(),
  security = make(), updater = make();
const slots = {
  "cloudpelizzon-core-panel": [core],
  "cloudpelizzon-module-slot": [maintenance, energy, security],
  "cloudpelizzon-updater-panel": [updater],
};
const host = {
  _hass: { user: { is_admin: true } },
  shadowRoot: {
    querySelectorAll: selector => slots[selector] || [],
    querySelector: selector => (slots[selector] || [])[0],
  },
  installShellLayoutFix: () => {},
};
propagate.call(host);
for (const element of [core, maintenance, energy, security, updater]) {
  assert.strictEqual(element.hass, host._hass);
}
const next = { user: { is_admin: false } };
host._hass = next;
propagate.call(host);
for (const element of [core, maintenance, energy, security, updater]) {
  assert.strictEqual(element.hass, next);
}

assert(
  source.includes("if(rightsChanged){\n        this.render();"),
  "Stable entitlement refresh must not repeatedly rebuild module panels"
);
console.log("PASS: all three commercial slots receive hass; unchanged license polling preserves panels");
