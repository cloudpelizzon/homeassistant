// Last updated: 2026-10-19. Public, read-only presentation transport lifecycle.
// readSnapshot must be supplied by the authenticated platform after private
// readiness review. No endpoint, signature verifier or local license is created.
import {LIGHTING_SKU, projectLightingSnapshot, hasLightingViewAccess} from './projection.mjs';
import {projectLightingCapabilities} from './capabilities.mjs';
import {loadLightingConfiguration, projectConfiguredLightingSnapshot} from './configuration-view.mjs';

const MAX_ENTITIES = 2000;
const MAX_PAYLOAD_BYTES = 524288;
const LIGHT_ID = /^light\.[a-z0-9_]+$/;
const CONFIG_ENTITY_ID = /^(light|switch|binary_sensor)\.[a-z0-9_]{1,128}$/;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function locked(status = 'locked') {
  return freeze({...projectLightingSnapshot(null, null), status, commands_available: false});
}

// The supplied grant is a display hint produced by a verified backend, NOT a
// credential. Browser flags cannot authenticate a user or authorize an HA read.
function projectResponse(payload) {
  if (!record(payload) || payload.sku !== LIGHTING_SKU) throw new TypeError('response');
  if (!record(payload.grant) || !hasLightingViewAccess(payload.grant)) return locked();
  if (!record(payload.states) || Object.keys(payload.states).length > MAX_ENTITIES) {
    throw new TypeError('states');
  }
  if (payload.areas !== undefined && !record(payload.areas)) throw new TypeError('areas');
  const raw = JSON.stringify(payload);
  if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) throw new TypeError('size');
  const input = JSON.parse(raw); // Detach all data from transport-owned objects.
  for (const [id, entity] of Object.entries(input.states)) {
    if (!(input.configuration === undefined ? LIGHT_ID : CONFIG_ENTITY_ID).test(id)
        || !record(entity) || entity.entity_id !== id) {
      throw new TypeError('entity');
    }
  }
  if (input.configuration !== undefined) {
    return freeze({...projectConfiguredLightingSnapshot(input.states, input.grant, input.configuration),
      status: 'ready', commands_available: false});
  }
  const view = projectLightingSnapshot(input.states, input.grant, input.areas);
  const lights = view.lights.map(light => {
    const capabilities = projectLightingCapabilities(input.states[light.entity_id]);
    return {...light, capabilities,
      brightness_pct: capabilities.brightness ? light.brightness_pct : null};
  });
  return freeze({...view, lights, status: 'ready', commands_available: false});
}

/**
 * A bounded single-flight reader for the UI. No polling, writes or device calls.
 * Ports receive only AbortSignal; installation identity and authenticated user
 * belong to the native platform, never to browser-supplied request fields.
 * Recreate this session when user/installation changes. Invalidate on denial,
 * disconnect or revocation. Do not reuse a cached grant as a read fallback.
 */
export class LightingReadSession {
  #read;
  #readConfiguration;
  #timeout;
  #closed = false;
  #flight = null;
  #snapshot = locked();

  constructor({readSnapshot, readConfigurationPage, timeoutMs = 10000} = {}) {
    if (readSnapshot !== undefined && typeof readSnapshot !== 'function') throw new TypeError('port');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
      throw new TypeError('timeout');
    }
    if (readConfigurationPage !== undefined && typeof readConfigurationPage !== 'function') {
      throw new TypeError('configuration_port');
    }
    this.#read = readSnapshot;
    this.#readConfiguration = readConfigurationPage;
    this.#timeout = timeoutMs;
  }

  get snapshot() { return this.#snapshot; }

  refresh() {
    if (this.#closed) return Promise.resolve(this.#snapshot);
    if (this.#flight) return this.#flight.promise;
    if (!this.#read) {
      this.#snapshot = locked('unavailable');
      return Promise.resolve(this.#snapshot);
    }
    this.#snapshot = locked('loading'); // Never show a cached unverified view.
    const controller = new AbortController();
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    const flight = {promise, controller, done: false, timer: null, finish: null};
    const finish = snapshot => {
      if (flight.done) return;
      flight.done = true;
      clearTimeout(flight.timer);
      if (this.#flight === flight) {
        this.#flight = null;
        this.#snapshot = snapshot;
      }
      resolve(this.#snapshot);
    };
    flight.finish = finish;
    this.#flight = flight;
    flight.timer = setTimeout(() => {
      finish(locked('unavailable'));
      controller.abort();
    }, this.#timeout);
    Promise.resolve().then(() => {
      if (flight.done) return undefined;
      return this.#read({signal: controller.signal});
    }).then(async payload => {
      if (flight.done) return;
      if (this.#readConfiguration && record(payload) && payload.sku === LIGHTING_SKU
          && record(payload.grant) && hasLightingViewAccess(payload.grant)) {
        const configuration = await loadLightingConfiguration({readPage: this.#readConfiguration,
          signal: controller.signal});
        if (flight.done) return;
        payload = {...payload, configuration};
      }
      if (!flight.done) finish(projectResponse(payload));
    }).catch(() => {
      finish(locked('unavailable')); // No backend body, error text or secrets in UI.
    });
    return promise;
  }

  invalidate() {
    this.#snapshot = locked(this.#closed ? 'closed' : 'locked');
    const flight = this.#flight;
    if (flight) {
      flight.finish(this.#snapshot);
      flight.controller.abort();
    }
    return this.#snapshot;
  }

  close() {
    this.#closed = true;
    this.#read = undefined;
    this.#readConfiguration = undefined;
    return this.invalidate();
  }
}
