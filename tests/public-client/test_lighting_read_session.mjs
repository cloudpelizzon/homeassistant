import assert from 'node:assert/strict';
import test from 'node:test';
import {LightingReadSession} from '../../staging/lighting/read-session.mjs';
import {projectLightingCapabilities as caps} from '../../staging/lighting/capabilities.mjs';
import {renderLightingReadonly} from '../../staging/lighting/readonly-view.mjs';

// Synthetic response fixtures. These are NOT authenticated gateway responses.
function fixture() {
  return {sku: 'CP-LIGHTING', grant: {sku: 'CP-LIGHTING', gateway_verified: true,
    license: {allowed: true}}, areas: {'light.example_a': 'Ambiente exemplo'}, states: {
    'light.example_a': {entity_id: 'light.example_a', state: 'on', attributes: {
      friendly_name: 'Nome local', brightness: 128, supported_color_modes: ['color_temp'],
      color_mode: 'color_temp', min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6000,
      color_temp_kelvin: 3000}},
    'light.example_b': {entity_id: 'light.example_b', state: 'unavailable', attributes: {}},
  }};
}
const entity = modes => ({state: 'on', attributes: {supported_color_modes: modes}});
const deferred = () => { let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject}; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function assertLocked(view, status) {
  assert.equal(view.locked, true);
  assert.deepEqual(view.lights, []);
  assert.equal(view.counts.total, 0);
  assert.equal(view.commands_available, false);
  if (status) assert.equal(view.status, status);
}

test('no port means no access; initial state is locked', async () => {
  const s = new LightingReadSession();
  assertLocked(s.snapshot, 'locked');
  assertLocked(await s.refresh(), 'unavailable');
});

test('accepts read-only data and renders existing individual cards without ID mutation', async () => {
  const input = fixture();
  const before = structuredClone(input);
  const s = new LightingReadSession({readSnapshot: async () => input});
  const view = await s.refresh();
  assert.equal(view.status, 'ready');
  assert.equal(view.counts.total, 2);
  assert.equal(view.counts.unavailable, 1);
  assert.equal(view.measured_power_w, null);
  assert.equal(view.commands_available, false);
  const row = view.lights.find(x => x.entity_id === 'light.example_a');
  assert.equal(row.name, 'Nome local');
  assert.equal(row.area, 'Ambiente exemplo');
  assert.equal(row.brightness_pct, 50);
  assert.equal(row.capabilities.color_temp_kelvin, 3000);
  const html = renderLightingReadonly(view);
  assert.equal((html.match(/<article /g) || []).length, 2);
  assert.match(html, /data-entity="light.example_a"/);
  assert.doesNotMatch(html, /<button|<input|callService/);
  assert.deepEqual(input, before);
  input.states['light.example_a'].attributes.friendly_name = 'Alterado';
  assert.equal(row.name, 'Nome local');
  assert.throws(() => { row.capabilities.supported_color_modes.push('rgb'); }, TypeError);
});

test('simultaneous refresh requests share one provider call and one result', async () => {
  const d = deferred(); let calls = 0;
  const s = new LightingReadSession({readSnapshot: () => {calls++; return d.promise;}});
  const a = s.refresh(), b = s.refresh();
  assert.strictEqual(a, b);
  assertLocked(s.snapshot, 'loading');
  await tick(); assert.equal(calls, 1);
  d.resolve(fixture());
  assert.strictEqual(await a, await b);
});

test('denied, expired and wrong-SKU hints never preserve earlier entity data', async () => {
  for (const grant of [null, {}, {sku: 'CP-SOLAR', gateway_verified: true, license: {allowed: true}},
    {sku: 'CP-LIGHTING', gateway_verified: false, license: {allowed: true}},
    {sku: 'CP-LIGHTING', gateway_verified: true, trial: {verified: true,
      phase: 'trial_expired', paid_confirmed: false}}]) {
    let input = fixture();
    const s = new LightingReadSession({readSnapshot: async () => input});
    assert.equal((await s.refresh()).locked, false);
    input = {...fixture(), grant};
    const view = await s.refresh();
    assertLocked(view);
    assert.doesNotMatch(renderLightingReadonly(view), /data-entity=/);
  }
});

test('timeout aborts and discards success returned after the deadline', async () => {
  const d = deferred(); let signal;
  const s = new LightingReadSession({timeoutMs: 15, readSnapshot: args => {
    signal = args.signal; return d.promise;
  }});
  assertLocked(await s.refresh(), 'unavailable');
  assert.equal(signal.aborted, true);
  d.resolve(fixture()); await tick();
  assertLocked(s.snapshot, 'unavailable');
});

test('invalidation resolves pending reads even if provider ignores cancellation', async () => {
  const d = deferred(); let signal;
  const s = new LightingReadSession({readSnapshot: args => {signal = args.signal; return d.promise;}});
  const pending = s.refresh(); await tick();
  s.invalidate();
  assertLocked(await pending, 'locked');
  assert.equal(signal.aborted, true);
  d.resolve(fixture()); await tick(); assertLocked(s.snapshot, 'locked');
});

test('late response from previous session does not overwrite fresh data', async () => {
  const old = deferred(); let calls = 0;
  const fresh = fixture(); fresh.states['light.example_a'].attributes.friendly_name = 'Novo';
  const s = new LightingReadSession({readSnapshot: () => ++calls === 1 ? old.promise : fresh});
  const prior = s.refresh(); await tick(); s.invalidate(); await prior;
  await s.refresh(); old.resolve(fixture()); await tick();
  assert.equal(s.snapshot.lights.find(x => x.entity_id === 'light.example_a').name, 'Novo');
});

test('closing before provider starts cancels without invoking it and prevents future reads', async () => {
  let calls = 0;
  const s = new LightingReadSession({readSnapshot: () => {calls++; return fixture();}});
  const pending = s.refresh(); s.close();
  assertLocked(await pending, 'closed');
  assertLocked(await s.refresh(), 'closed');
  await tick(); assert.equal(calls, 0);
});

test('closing during a read rejects late data and suppresses provider error bodies', async () => {
  const d = deferred();
  const s = new LightingReadSession({readSnapshot: () => d.promise});
  const pending = s.refresh(); await tick(); s.close();
  assertLocked(await pending, 'closed');
  d.reject(new Error('sensitive-response-placeholder')); await tick();
  assert.doesNotMatch(JSON.stringify(s.snapshot), /sensitive-response-placeholder/);
});

test('provider rejection clears prior data without exposing error details', async () => {
  let fail = false;
  const s = new LightingReadSession({readSnapshot: () => {
    if (fail) throw new Error('sensitive-response-placeholder'); return fixture();
  }});
  await s.refresh(); fail = true;
  const view = await s.refresh(); assertLocked(view, 'unavailable');
  assert.doesNotMatch(JSON.stringify(view), /sensitive-response-placeholder/);
});

test('rejects malformed, mismatched, other-domain and oversized payloads', async () => {
  const huge = fixture(); huge.extra = 'x'.repeat(524288);
  const tooMany = fixture(); tooMany.states = Object.fromEntries(Array.from({length: 2001}, (_, i) =>
    [`light.x_${i}`, {entity_id: `light.x_${i}`, state: 'off'}]));
  const circular = fixture(); circular.self = circular;
  for (const input of [null, {}, {...fixture(), sku: 'CP-SOLAR'}, {...fixture(), states: []},
    {...fixture(), areas: []}, {...fixture(), states: {'light.other': fixture().states['light.example_a']}},
    {...fixture(), states: {'switch.example': {entity_id: 'switch.example', state: 'on'}}},
    huge, tooMany, circular]) {
    const s = new LightingReadSession({readSnapshot: async () => input});
    assertLocked(await s.refresh(), 'unavailable');
  }
});

test('advanced capabilities come from reported modes, not brightness leftovers or names', () => {
  for (const modes of [undefined, [], ['unknown'], ['rgb', 'onoff'], ['white'], ['rgb', 'rgb'], ['RGB']]) {
    const c = caps(entity(modes));
    assert.equal(c.reported, false); assert.equal(c.brightness, false);
    assert.equal(c.color, false); assert.equal(c.color_temperature, false);
  }
  assert.equal(caps(entity(['onoff'])).brightness, false);
  assert.equal(caps(entity(['brightness'])).brightness, true);
  for (const mode of ['hs', 'xy', 'rgb', 'rgbw', 'rgbww']) {
    assert.equal(caps(entity([mode])).color, true);
    assert.equal(caps(entity([mode])).brightness, true);
  }
  assert.equal(caps(entity(['rgb', 'white'])).white, true);
});

test('validates actual kelvin limits and current mode without fabricating defaults', () => {
  const e = fixture().states['light.example_a'];
  assert.equal(caps(e).color_temp_kelvin, 3000);
  for (const patch of [{min_color_temp_kelvin: undefined}, {max_color_temp_kelvin: Infinity},
    {min_color_temp_kelvin: '2200'}, {min_color_temp_kelvin: 7000}, {min_color_temp_kelvin: 0}]) {
    const c = caps({...e, attributes: {...e.attributes, ...patch}});
    assert.equal(c.min_color_temp_kelvin, null); assert.equal(c.color_temp_kelvin, null);
  }
  for (const patch of [{color_temp_kelvin: 100}, {color_mode: 'rgb'}, {color_temp_kelvin: NaN}]) {
    assert.equal(caps({...e, attributes: {...e.attributes, ...patch}}).color_temp_kelvin, null);
  }
  assert.equal(caps({...e, state: 'off'}).color_temp_kelvin, null);
  assert.equal(caps({...e, state: 'unavailable'}).color_temp_kelvin, null);
});

test('onoff and missing modes do not display a misleading dimmer brightness', async () => {
  for (const modes of [['onoff'], undefined]) {
    const data = fixture(); data.states['light.example_a'].attributes.supported_color_modes = modes;
    const s = new LightingReadSession({readSnapshot: async () => data});
    const view = await s.refresh();
    assert.equal(view.lights.find(x => x.entity_id === 'light.example_a').brightness_pct, null);
    assert.doesNotMatch(renderLightingReadonly(view), /% de brilho/);
  }
});

test('reuses flat view for more than one hundred lights without inventing power', async () => {
  const data = fixture(); data.states = Object.fromEntries(Array.from({length: 150}, (_, i) =>
    [`light.example_${i}`, {entity_id: `light.example_${i}`, state: 'off', attributes: {}}]));
  const s = new LightingReadSession({readSnapshot: async () => data});
  const view = await s.refresh();
  assert.equal(view.lights.length, 150);
  assert.equal(view.counts.off, 150);
  assert.equal(view.measured_power_w, null);
  assert.equal((renderLightingReadonly(view).match(/<article /g) || []).length, 150);
});

test('validates constructor options', () => {
  for (const timeoutMs of [0, -1, NaN, Infinity, 30001, '100', 0.5]) {
    assert.throws(() => new LightingReadSession({timeoutMs}), TypeError);
  }
  assert.throws(() => new LightingReadSession({readSnapshot: true}), TypeError);
});
