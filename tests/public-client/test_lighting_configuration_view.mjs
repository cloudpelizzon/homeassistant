import assert from 'node:assert/strict';
import test from 'node:test';
import {loadLightingConfiguration, projectConfiguredLightingSnapshot, LIGHTING_CONFIG_READ}
  from '../../staging/lighting/configuration-view.mjs';
import {LightingReadSession} from '../../staging/lighting/read-session.mjs';
import {renderLightingReadonly} from '../../staging/lighting/readonly-view.mjs';

// Synthetic presentation responses matching the existing configuration schema.
// These objects are not authentication, licenses, signatures or device records.
const grant = {sku: 'CP-LIGHTING', gateway_verified: true, license: {allowed: true}};
const binding = (id, overrides = {}) => ({entity_id: id, name: `Nome ${id}`, kind: 'light',
  capabilities: ['on_off'], visible: true, room_id: 'room-example', icon: 'bulb', ...overrides});
const config = (items = [binding('light.example')]) => ({revision: 1,
  rooms: [{id: 'room-example', name: 'Ambiente exemplo'}], items, total: items.length,
  preferences: {theme: 'grafite'}});
const states = {'light.example': {entity_id: 'light.example', state: 'on',
  attributes: {friendly_name: 'Nome do HA', brightness: 128, supported_color_modes: ['brightness']}}};
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => {resolve = done;});
  return {promise, resolve}; };
const page = (c, args) => ({...structuredClone(c), items: structuredClone(c.items.slice(args.offset, args.offset + args.limit))});

function locked(snapshot) {
  assert.equal(snapshot.locked, true);
  assert.deepEqual(snapshot.lights, []);
  assert.equal(snapshot.commands_available, false);
}

test('configuration port uses only pagination, no user-controlled identity or new operations', async () => {
  assert.equal(LIGHTING_CONFIG_READ, 'lighting.config.read');
  const c = config(); let calls = 0;
  const controller = new AbortController();
  const loaded = await loadLightingConfiguration({signal: controller.signal,
    readPage: (args, options) => {
      calls++;
      assert.deepEqual(args, {offset: 0, limit: 100});
      assert.deepEqual(Object.keys(options), ['signal']);
      assert.strictEqual(options.signal, controller.signal);
      return page(c, args);
    }});
  assert.equal(calls, 1);
  assert.deepEqual(loaded, c);
});

test('reads 150 bindings in two complete pages without omission', async () => {
  const c = config(Array.from({length: 150}, (_, i) => binding(`light.example_${i}`)));
  const offsets = [];
  const loaded = await loadLightingConfiguration({readPage: args => {offsets.push(args.offset); return page(c, args);}});
  assert.deepEqual(offsets, [0, 100]);
  assert.equal(loaded.items.length, 150);
  assert.equal(new Set(loaded.items.map(x => x.entity_id)).size, 150);
});

test('rejects revision, metadata, theme or total changes between pages', async () => {
  const c = config(Array.from({length: 101}, (_, i) => binding(`light.example_${i}`)));
  for (const mutate of [p => {p.revision++;}, p => {p.total++;},
    p => {p.preferences.theme = 'flux';}, p => {p.rooms[0].name = 'Outro';}]) {
    await assert.rejects(loadLightingConfiguration({readPage: args => {
      const result = page(c, args); if (args.offset) mutate(result); return result;
    }}), /lighting_configuration_unavailable/);
  }
});

test('rejects duplicate entries across pages, short pages and oversized inventories', async () => {
  const c = config(Array.from({length: 101}, (_, i) => binding(`light.example_${i}`)));
  await assert.rejects(loadLightingConfiguration({readPage: args => {
    const p = page(c, args); if (args.offset) p.items = [binding('light.example_0')]; return p;
  }}));
  await assert.rejects(loadLightingConfiguration({readPage: () => ({...c, items: c.items.slice(0, 50)})}));
  await assert.rejects(loadLightingConfiguration({readPage: () => ({...c, total: 2001, items: []})}));
});

test('empty configuration is valid without fabricating a light', async () => {
  const c = config([]);
  const loaded = await loadLightingConfiguration({readPage: () => c});
  assert.equal(loaded.total, 0);
  assert.deepEqual(loaded.items, []);
  const view = projectConfiguredLightingSnapshot(states, grant, loaded);
  assert.equal(view.counts.total, 0);
});

test('fails closed for missing provider, malformed responses and unsupported fields', async () => {
  await assert.rejects(loadLightingConfiguration());
  for (const c of [null, [], {}, {...config(), revision: true}, {...config(), preferences: {theme: 'unknown'}},
    {...config(), rooms: [{id: 'room-example', name: 'A'}, {id: 'room-example', name: 'B'}]},
    config([binding('light.example', {room_id: 'missing'})]),
    config([binding('light.example', {favorite: true})]),
    config([binding('switch.unreviewed', {kind: 'review'})]),
    config([binding('binary_sensor.presence')]), config([binding('light.example', {visible: 'true'})])]) {
    await assert.rejects(loadLightingConfiguration({readPage: () => c}));
  }
});

test('cancellation settles an ignored provider and never delivers late configuration', async () => {
  const controller = new AbortController(), d = deferred();
  const promise = loadLightingConfiguration({signal: controller.signal, readPage: () => d.promise});
  await tick(); controller.abort();
  await assert.rejects(promise, /lighting_configuration_unavailable/);
  d.resolve(config()); await tick();
});

test('already aborted request does not call the provider', async () => {
  const controller = new AbortController(); controller.abort(); let calls = 0;
  await assert.rejects(loadLightingConfiguration({signal: controller.signal, readPage: () => {calls++; return config();}}));
  assert.equal(calls, 0);
});

test('join preserves stored name, room, icon, theme and original HA ID', () => {
  const c = config([binding('light.example', {name: 'Nome escolhido', icon: 'pendant'})]);
  c.preferences.theme = 'neo-soft';
  const original = structuredClone(states);
  const view = projectConfiguredLightingSnapshot(states, grant, c);
  assert.deepEqual(states, original);
  assert.equal(view.lights[0].entity_id, 'light.example');
  assert.equal(view.lights[0].name, 'Nome escolhido');
  assert.equal(view.lights[0].area, 'Ambiente exemplo');
  assert.equal(view.lights[0].icon, 'pendant');
  assert.equal(view.lights[0].brightness_pct, 50);
  assert.equal(view.configuration.theme, 'neo-soft');
  assert.equal(view.commands_available, false);
  assert.equal(view.measured_power_w, null);
});

test('all three selected theme identifiers share the same bindings', () => {
  for (const theme of ['grafite', 'flux', 'neo-soft']) {
    const c = config(); c.preferences.theme = theme;
    const view = projectConfiguredLightingSnapshot(states, grant, c);
    assert.equal(view.configuration.theme, theme);
    assert.equal(view.lights[0].entity_id, 'light.example');
  }
});

test('unbound states never create bindings and missing states never become off', () => {
  const c = config([binding('light.missing')]);
  const view = projectConfiguredLightingSnapshot(states, grant, c);
  assert.equal(view.lights.length, 1);
  assert.equal(view.lights[0].entity_id, 'light.missing');
  assert.equal(view.lights[0].state, 'unavailable');
  assert.equal(view.counts.off, 0);
  assert.equal(view.counts.unavailable, 1);
});

test('stored switch light binding is rendered individually without a fictitious dimmer', () => {
  const c = config([binding('switch.example')]);
  const view = projectConfiguredLightingSnapshot({'switch.example': {
    entity_id: 'switch.example', state: 'on', attributes: {brightness: 200, supported_color_modes: ['rgb']}}}, grant, c);
  assert.equal(view.lights[0].source_kind, 'configured_switch');
  assert.equal(view.lights[0].brightness_pct, null);
  assert.equal(view.lights[0].capabilities.color, false);
  assert.equal(view.counts.on, 1);
  const html = renderLightingReadonly(view);
  assert.match(html, /data-entity="switch.example"/);
  assert.doesNotMatch(html, /<button|<input|% de brilho/);
});

test('renderer still rejects raw switches without the configured presentation marker', () => {
  const html = renderLightingReadonly({sku: 'CP-LIGHTING', locked: false, lights: [
    {entity_id: 'switch.example', state: 'on', name: 'Não configurado'}]});
  assert.doesNotMatch(html, /data-entity="switch.example"/);
});

test('explicitly hidden lights and presence sensor bindings are not counted as lamps', () => {
  const c = config([binding('light.example'), binding('light.hidden', {visible: false}),
    binding('binary_sensor.presence', {kind: 'sensor', capabilities: [], icon: 'sensor'})]);
  const view = projectConfiguredLightingSnapshot(states, grant, c);
  assert.equal(view.counts.total, 1);
  assert.deepEqual(view.configuration, {revision: 1, theme: 'grafite', bindings_total: 3, hidden_lights: 1, sensor_bindings: 1});
});

test('denial clears configuration metadata as well as light names', () => {
  const view = projectConfiguredLightingSnapshot(states, null, config());
  assert.equal(view.locked, true);
  assert.deepEqual(view.lights, []);
  assert.equal(view.configuration, undefined);
  assert.doesNotMatch(renderLightingReadonly(view), /Nome light.example/);
});

test('stored names and room markup are escaped at rendering, not executed', () => {
  const c = config([binding('switch.example', {name: '<script>x</script>'})]);
  c.rooms[0].name = '<img src=x>';
  const html = renderLightingReadonly(projectConfiguredLightingSnapshot({}, grant, c));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(html, /<script>|<img /);
});

test('integrates configuration port, live snapshot projection and renderer', async () => {
  const c = config([binding('light.example', {name: 'Persistido'})]); c.preferences.theme = 'flux';
  const s = new LightingReadSession({readSnapshot: async () => ({sku: 'CP-LIGHTING', grant, states}),
    readConfigurationPage: args => page(c, args)});
  const snapshot = await s.refresh();
  assert.equal(snapshot.status, 'ready');
  assert.equal(snapshot.lights[0].name, 'Persistido');
  assert.equal(snapshot.configuration.theme, 'flux');
  assert.match(renderLightingReadonly(snapshot), /Persistido/);
  assert.equal(Object.isFrozen(snapshot.configuration), true);
  s.close(); locked(s.snapshot);
});

test('bad metadata or revision conflict replaces previous good session with locked view', async () => {
  let bad = false;
  const s = new LightingReadSession({readSnapshot: async () => ({sku: 'CP-LIGHTING', grant, states}),
    readConfigurationPage: () => bad ? {...config(), total: 4} : config()});
  assert.equal((await s.refresh()).locked, false);
  bad = true; locked(await s.refresh());
  assert.equal(s.snapshot.configuration, undefined);
});

test('denied state response never invokes metadata provider', async () => {
  let calls = 0;
  const s = new LightingReadSession({readSnapshot: async () => ({sku: 'CP-LIGHTING', grant: null, states}),
    readConfigurationPage: () => {calls++; return config();}});
  locked(await s.refresh());
  assert.equal(calls, 0);
});

test('session deadline includes configuration request and cancels a stalled page', async () => {
  const d = deferred(); let signal;
  const s = new LightingReadSession({timeoutMs: 15,
    readSnapshot: async () => ({sku: 'CP-LIGHTING', grant, states}),
    readConfigurationPage: (_args, options) => {signal = options.signal; return d.promise;}});
  locked(await s.refresh());
  assert.equal(signal.aborted, true);
  d.resolve(config()); await tick(); locked(s.snapshot);
});

test('closing during configuration fetch cannot restore the earlier session', async () => {
  const d = deferred();
  const s = new LightingReadSession({readSnapshot: async () => ({sku: 'CP-LIGHTING', grant, states}),
    readConfigurationPage: () => d.promise});
  const pending = s.refresh(); await tick(); s.close();
  locked(await pending); d.resolve(config()); await tick(); locked(s.snapshot);
});

test('session supports only configured switch IDs and ignores unbound relay inventory', async () => {
  const c = config([binding('switch.example')]);
  const s = new LightingReadSession({readSnapshot: async () => ({sku: 'CP-LIGHTING', grant, states: {
    'switch.example': {entity_id: 'switch.example', state: 'on'},
    'switch.other': {entity_id: 'switch.other', state: 'on'}}}), readConfigurationPage: args => page(c, args)});
  const result = await s.refresh();
  assert.equal(result.counts.total, 1);
  assert.equal(result.lights[0].entity_id, 'switch.example');
  assert.doesNotMatch(renderLightingReadonly(result), /data-entity="switch.other"/);
});

test('configuration port rejects non-callable options', () => {
  assert.throws(() => new LightingReadSession({readConfigurationPage: true}), /configuration_port/);
});
