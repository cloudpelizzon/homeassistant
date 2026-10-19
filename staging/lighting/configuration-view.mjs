// Last updated: 2026-10-19. Public configuration presentation; no storage or effects.
// The native host supplies already-authorized metadata and states. This module
// does not establish installation/user identity or grant commercial access.
import {LIGHTING_SKU, hasLightingViewAccess, projectLightingSnapshot} from './projection.mjs';
import {projectLightingCapabilities} from './capabilities.mjs';

export const LIGHTING_CONFIG_READ = 'lighting.config.read';
const PAGE_SIZE = 100;
const MAX_ITEMS = 2000;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const ENTITY = /^(light|switch|binary_sensor)\.[a-z0-9_]{1,128}$/;
const THEMES = new Set(['grafite', 'flux', 'neo-soft']);
const ICONS = new Set(['bulb', 'pendant', 'spot', 'led', 'wall', 'floodlight', 'sensor']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0
  && value.length <= 80 && !/[\p{C}]/u.test(value);
const fail = () => { throw new Error('lighting_configuration_unavailable'); };
const checkAbort = signal => { if (signal?.aborted) fail(); };
const exact = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));

// Copy only the response contract, never arbitrary backend fields or error bodies.
export function validateLightingConfiguration(value, itemLimit = MAX_ITEMS) {
  if (!exact(value, ['revision', 'rooms', 'items', 'total', 'preferences'])
      || !Number.isSafeInteger(value.revision) || value.revision < 0
      || !Number.isSafeInteger(value.total) || value.total < 0 || value.total > MAX_ITEMS
      || !Array.isArray(value.items) || value.items.length > itemLimit
      || value.items.length > value.total
      || !Array.isArray(value.rooms) || value.rooms.length > 200
      || !exact(value.preferences, ['theme']) || !THEMES.has(value.preferences.theme)) fail();
  const roomIds = new Set();
  const rooms = value.rooms.map(row => {
    if (!exact(row, ['id', 'name']) || typeof row.id !== 'string' || !ID.test(row.id)
        || roomIds.has(row.id) || !text(row.name)) fail();
    roomIds.add(row.id);
    return {id: row.id, name: row.name};
  }).sort((a, b) => a.id.localeCompare(b.id));
  const seen = new Set();
  const items = value.items.map(row => {
    if (!exact(row, ['entity_id', 'name', 'kind', 'capabilities', 'visible', 'room_id', 'icon'])
        || typeof row.entity_id !== 'string' || !ENTITY.test(row.entity_id)
        || seen.has(row.entity_id) || !text(row.name) || !ICONS.has(row.icon)
        || typeof row.visible !== 'boolean'
        || (row.room_id !== null && !roomIds.has(row.room_id))
        || !Array.isArray(row.capabilities)) fail();
    const sensor = row.entity_id.startsWith('binary_sensor.');
    if (sensor ? row.kind !== 'sensor' || row.capabilities.length !== 0
      : row.kind !== 'light' || row.capabilities.length !== 1 || row.capabilities[0] !== 'on_off') fail();
    seen.add(row.entity_id);
    return {entity_id: row.entity_id, name: row.name, kind: row.kind,
      capabilities: [...row.capabilities], visible: row.visible,
      room_id: row.room_id, icon: row.icon};
  });
  return {revision: value.revision, rooms, items, total: value.total,
    preferences: {theme: value.preferences.theme}};
}

function cancellable(read, parameters, signal) {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value, rejected) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', aborted);
      if (rejected) reject(new Error('lighting_configuration_unavailable'));
      else resolve(value);
    };
    const aborted = () => finish(null, true);
    signal?.addEventListener('abort', aborted, {once: true});
    Promise.resolve().then(() => {
      checkAbort(signal);
      return read(parameters, {signal});
    }).then(value => finish(value, false), () => finish(null, true));
  });
}

/** Read all pages of the existing configuration contract, without partial results.
 * readPage receives only pagination and cancellation. Authenticated actor and
 * installation, request IDs, signing and reauthorization belong to the native host.
 * Invoke under the enclosing read-session deadline; no retries or persistence.
 */
export async function loadLightingConfiguration({readPage, signal} = {}) {
  if (typeof readPage !== 'function') fail();
  let first, metadata;
  const items = [], seen = new Set();
  for (let pageNo = 0; pageNo < MAX_ITEMS / PAGE_SIZE; pageNo++) {
    const offset = items.length;
    const raw = await cancellable(readPage, {offset, limit: PAGE_SIZE}, signal);
    checkAbort(signal);
    const page = validateLightingConfiguration(raw, PAGE_SIZE);
    const stamp = JSON.stringify([page.revision, page.total, page.rooms, page.preferences]);
    if (!first) {first = page; metadata = stamp;}
    else if (stamp !== metadata) fail(); // No mixed-revision snapshot after concurrent edits.
    if (page.items.length !== Math.min(PAGE_SIZE, page.total - offset)) fail();
    for (const item of page.items) {
      if (seen.has(item.entity_id)) fail();
      seen.add(item.entity_id);
      items.push(item);
    }
    if (items.length === page.total) return {...first, items};
  }
  fail();
}

/** Join authorized live states with persisted display bindings. No HA writes. */
export function projectConfiguredLightingSnapshot(states, grant, configuration) {
  if (!hasLightingViewAccess(grant)) return projectLightingSnapshot(null, null);
  const config = validateLightingConfiguration(configuration);
  if (config.items.length !== config.total || !isRecord(states)) fail();
  const rooms = new Map(config.rooms.map(room => [room.id, room.name]));
  const lights = [];
  let hidden = 0, sensors = 0;
  for (const binding of config.items) {
    if (binding.kind === 'sensor') {sensors++; continue;}
    if (!binding.visible) {hidden++; continue;}
    const id = binding.entity_id;
    const raw = Object.hasOwn(states, id) ? states[id] : undefined;
    if (raw !== undefined && (!isRecord(raw) || raw.entity_id !== id)) fail();
    const entity = raw ?? {entity_id: id, state: 'unavailable', attributes: {}};
    const area = binding.room_id === null ? 'Sem ambiente' : rooms.get(binding.room_id);
    let row;
    if (id.startsWith('light.')) {
      const projected = projectLightingSnapshot({[id]: {...entity,
        attributes: {...(isRecord(entity.attributes) ? entity.attributes : {}),
          friendly_name: binding.name}}}, grant, {[id]: area});
      row = projected.lights[0];
      if (!row) fail();
    } else {
      // Only persisted switch bindings classified as light by the private service.
      // An unbound switch from discovery is never promoted by this presentation.
      const state = ['on', 'off', 'unknown', 'unavailable'].includes(entity.state)
        ? entity.state : 'unknown';
      row = {entity_id: id, name: binding.name, area, state,
        available: state === 'on' || state === 'off', brightness_pct: null,
        source_kind: 'configured_switch'};
    }
    const capabilities = id.startsWith('switch.')
      ? projectLightingCapabilities({state: entity.state, attributes: {supported_color_modes: ['onoff']}})
      : projectLightingCapabilities(entity);
    lights.push({...row, icon: binding.icon, room_id: binding.room_id, capabilities,
      brightness_pct: capabilities.brightness ? row.brightness_pct : null});
  }
  lights.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', {numeric: true, sensitivity: 'base'})
    || a.entity_id.localeCompare(b.entity_id));
  const counts = {total: lights.length, on: 0, off: 0, unavailable: 0, unknown: 0};
  for (const light of lights) counts[light.state]++;
  return {sku: LIGHTING_SKU, locked: false, lights, counts, measured_power_w: null,
    configuration: {revision: config.revision, theme: config.preferences.theme,
      bindings_total: config.total, hidden_lights: hidden, sensor_bindings: sensors},
    commands_available: false};
}
