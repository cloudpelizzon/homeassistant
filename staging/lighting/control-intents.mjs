// CP-LIGHTING public, inactive control intents. Last updated: 2026-10-19.
// This file NEVER sends Home Assistant services, issues grants or executes effects.
// A future trusted host MUST reauthorize each intent at the private gateway,
// check HA user/installation/permission and authorize the exact physical action.
export const LIGHTING_CONTROL_INTENTS = Object.freeze([
  'turn_on', 'turn_off', 'set_brightness', 'set_color_temperature', 'set_rgb_color',
]);
const IDENTIFIER = /^(?:light|switch)\.[a-z0-9_]{1,128}$/;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeInt = value => typeof value === 'number' && Number.isSafeInteger(value);

function deny() { return null; }

/** Validate a *presentation intent*, NOT an authorization proof or service call.
 *  No caller identity, backend operation, secret, target host or trial information
 *  can be placed in this object. The native host must independently enforce all
 *  policy, including exactly-current signed entitlement and per-entity ACL.
 */
export function createLightingControlIntent(view, entityId, action, parameter = undefined) {
  if (!isObject(view) || view.sku !== 'CP-LIGHTING' || view.locked !== false
      || view.status !== 'ready' || view.commands_available !== true
      || !Array.isArray(view.lights) || view.lights.length > 2000
      || typeof entityId !== 'string' || !IDENTIFIER.test(entityId)
      || typeof action !== 'string' || !LIGHTING_CONTROL_INTENTS.includes(action)) return deny();

  // Duplicate or mismatched rows must fail closed, not control an arbitrary match.
  const matches = view.lights.filter(row => isObject(row) && row.entity_id === entityId);
  if (matches.length !== 1) return deny();
  const row = matches[0];
  if (row.available !== true || !['on', 'off'].includes(row.state)) return deny();
  const relay = entityId.startsWith('switch.');
  if (relay && row.source_kind !== 'configured_switch') return deny();
  if (!relay && row.entity_id.slice(0, 6) !== 'light.') return deny();
  const caps = isObject(row.capabilities) ? row.capabilities : {};
  let parameters;

  if (action === 'turn_on' || action === 'turn_off') {
    if (parameter !== undefined) return deny();
    parameters = {};
  } else if (relay) {
    return deny(); // A configured switch has no supported dimmer, temperature or RGB.
  } else if (action === 'set_brightness') {
    if (caps.brightness !== true || !safeInt(parameter) || parameter < 1 || parameter > 100) return deny();
    parameters = {brightness_pct: parameter};
  } else if (action === 'set_color_temperature') {
    const low = caps.min_color_temp_kelvin, high = caps.max_color_temp_kelvin;
    if (caps.color_temperature !== true || !safeInt(low) || !safeInt(high)
        || low < 1 || high <= low || !safeInt(parameter)
        || parameter < low || parameter > high) return deny();
    parameters = {color_temp_kelvin: parameter};
  } else if (action === 'set_rgb_color') {
    if (caps.color !== true || !Array.isArray(parameter) || parameter.length !== 3
        || !parameter.every(v => safeInt(v) && v >= 0 && v <= 255)) return deny();
    parameters = {rgb_color: Object.freeze([...parameter])};
  } else return deny();

  // Return only the strictly allowlisted, detached fields. No batch commands.
  return Object.freeze({entity_id: entityId, action,
    parameters: Object.freeze(parameters)});
}
