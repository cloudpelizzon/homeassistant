import assert from "node:assert/strict";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

const path = process.argv[2];
assert.ok(path, "projection file path required");
const {LIGHTING_SKU, hasLightingViewAccess, projectLightingSnapshot} =
  await import(pathToFileURL(resolve(path)).href);

const fixture = {
  a: {entity_id: "light.sala_2", state: "on", attributes: {friendly_name: "Sala 2", brightness: 128}},
  b: {entity_id: "light.sala_1", state: "off", attributes: {friendly_name: "Sala 1", brightness: 255}},
  c: {entity_id: "light.garagem", state: "unavailable", attributes: {friendly_name: "Garagem"}},
  d: {entity_id: "light.escritorio", state: "unknown", attributes: {}},
  e: {entity_id: "light.quarto", state: "on", attributes: {friendly_name: "<Quarto>", brightness: 999}},
  f: {entity_id: "switch.externo", state: "on", attributes: {friendly_name: "Exclude"}},
  g: {entity_id: "light.bad-script<script>", state: "on", attributes: {}}
};
const paid = {sku: LIGHTING_SKU, gateway_verified: true, license: {allowed: true}};
const trial = {sku: LIGHTING_SKU, gateway_verified: true,
  trial: {verified: true, phase: "trial_active", paid_confirmed: false}};

for (const invalid of [undefined, null, {}, {sku: LIGHTING_SKU, license: {allowed: true}},
  {sku: LIGHTING_SKU, gateway_verified: false, license: {allowed: true}},
  {sku: "CP-SOLAR", gateway_verified: true, license: {allowed: true}},
  {sku: LIGHTING_SKU, gateway_verified: true, trial: {verified: false, phase: "trial_active"}},
  {sku: LIGHTING_SKU, gateway_verified: true, trial: {verified: true, phase: "trial_expired"}},
  {sku: LIGHTING_SKU, gateway_verified: true, trial: {verified: true, phase: "trial_active", paid_confirmed: true}}]) {
  assert.equal(hasLightingViewAccess(invalid), false);
  const locked = projectLightingSnapshot(fixture, invalid);
  assert.equal(locked.locked, true);
  assert.deepEqual(locked.lights, []);
  assert.equal(locked.counts.total, 0);
}
assert.equal(hasLightingViewAccess(paid), true);
assert.equal(hasLightingViewAccess(trial), true);
const result = projectLightingSnapshot(fixture, trial, {"light.sala_1": "Sala"});
assert.equal(result.locked, false);
assert.deepEqual(result.counts, {total: 5, on: 2, off: 1, unavailable: 1, unknown: 1});
assert.equal(result.measured_power_w, null);
assert.equal(result.lights.length, 5);
assert.ok(result.lights.every(l => l.entity_id.startsWith("light.")));
assert.ok(result.lights.some(l => l.name === "Quarto"));
assert.equal(result.lights.find(l => l.entity_id === "light.sala_2").brightness_pct, 50);
assert.equal(result.lights.find(l => l.entity_id === "light.sala_1").brightness_pct, null);
assert.equal(result.lights.find(l => l.entity_id === "light.quarto").brightness_pct, null);
assert.equal(result.lights.find(l => l.entity_id === "light.sala_1").area, "Sala");
assert.equal(result.lights.find(l => l.entity_id === "light.escritorio").available, false);
assert.deepEqual(projectLightingSnapshot([], paid).counts,
  {total: 0, on: 0, off: 0, unavailable: 0, unknown: 0});
const stable = projectLightingSnapshot(fixture, paid).lights.map(x => x.entity_id);
assert.deepEqual(stable, projectLightingSnapshot(fixture, paid).lights.map(x => x.entity_id));
console.log("CP_LIGHTING_PUBLIC_PROJECTION=PASS");
