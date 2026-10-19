import test from 'node:test';
import assert from 'node:assert/strict';
import {createLightingControlIntent, LIGHTING_CONTROL_INTENTS} from '../../staging/lighting/control-intents.mjs';

const lamp = (patch = {}) => ({entity_id: 'light.sala', name: 'Sala', state: 'on', available: true,
  capabilities: {brightness: true, color_temperature: true, color: true,
    min_color_temp_kelvin: 2300, max_color_temp_kelvin: 6500}, ...patch});
const snap = (row = lamp(), patch = {}) => ({sku: 'CP-LIGHTING', locked: false,
  status: 'ready', commands_available: true, lights: [row], ...patch});
const intent = (action, value, v = snap()) => createLightingControlIntent(v, 'light.sala', action, value);

test('default closed snapshot, missing and expired access yield no intent', () => {
  for (const s of [undefined, null, {}, snap(lamp(), {locked: true}),
    snap(lamp(), {status: 'loading'}), snap(lamp(), {commands_available: false}),
    snap(lamp(), {sku: 'CP-SOLAR'}), snap(lamp(), {commands_available: 1})]) {
    assert.equal(createLightingControlIntent(s, 'light.sala', 'turn_on'), null);
  }
});

test('turn on and off are single-entity intents with no caller or license fields', () => {
  assert.deepEqual([...LIGHTING_CONTROL_INTENTS], ['turn_on','turn_off','set_brightness','set_color_temperature','set_rgb_color']);
  for (const action of ['turn_on', 'turn_off']) {
    const result = intent(action);
    assert.deepEqual(result, {entity_id: 'light.sala', action, parameters: {}});
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.parameters), true);
    assert.deepEqual(Object.keys(result), ['entity_id','action','parameters']);
    assert.equal(intent(action, {}), null);
  }
});

test('brightness is a supported integer percentage, never zero or out of range', () => {
  for (const pct of [1, 30, 100]) assert.equal(intent('set_brightness',pct)?.parameters.brightness_pct, pct);
  for (const pct of [0, -1, 101, 1.5, Infinity, NaN, '40', null, true, [10]]) assert.equal(intent('set_brightness', pct), null);
  assert.equal(intent('set_brightness', 50, snap(lamp({capabilities:{brightness:false}}))), null);
});

test('temperature uses real HA kelvin limits only', () => {
  for (const k of [2300, 3000, 6500]) assert.equal(intent('set_color_temperature',k)?.parameters.color_temp_kelvin,k);
  for (const k of [2100, 6501, 2300.5, null, '3000', Infinity]) assert.equal(intent('set_color_temperature',k),null);
  for (const c of [{color_temperature:true}, {color_temperature:true,min_color_temp_kelvin:7000,max_color_temp_kelvin:6000},
    {color_temperature:false,min_color_temp_kelvin:2200,max_color_temp_kelvin:6000},
    {color_temperature:true,min_color_temp_kelvin:'2200',max_color_temp_kelvin:6000}]) {
    assert.equal(intent('set_color_temperature',3000,snap(lamp({capabilities:c}))),null);
  }
});

test('RGB is permitted only for declared color support and strict channels', () => {
  const rgb=[0,128,255];const output=intent('set_rgb_color',rgb);
  assert.deepEqual(output.parameters.rgb_color,[0,128,255]);
  assert.equal(Object.isFrozen(output.parameters.rgb_color),true);
  rgb[0]=55;assert.equal(output.parameters.rgb_color[0],0);
  for (const bad of [[1,2],[0,0,0,0],[-1,1,1],[256,2,2],[1.1,2,3],[1,'2',3],null,{},'0,0,0']) {
    assert.equal(intent('set_rgb_color',bad),null);
  }
  assert.equal(intent('set_rgb_color',[1,2,3],snap(lamp({capabilities:{color:false}}))),null);
});

test('unknown actions and batch targets fail closed', () => {
  for(const action of ['toggle','scene','callService','light.turn_on','activate','group_on',{},null]) {
    assert.equal(intent(action),null);
  }
  for(const id of ['light.a<script>','switch.unspecified','light.a,light.b','light.*',42,'light.Á','sensor.power']) {
    assert.equal(createLightingControlIntent(snap(),id,'turn_on'),null);
  }
});

test('cannot operate unknown, off-line, stale or duplicated row', () => {
  for (const row of [lamp({available:false}), lamp({state:'unknown'}),lamp({state:'unavailable'}),
    lamp({state:'on',available:1}),lamp({entity_id:'switch.fake'})]) {
    assert.equal(intent('turn_off',undefined,snap(row)),null);
  }
  assert.equal(intent('turn_on',undefined,snap(lamp(),{lights:[lamp(),lamp()]})),null);
});

test('only explicitly registered switch-light permits on and off, never other capabilities', () => {
  const relay= {entity_id:'switch.rele',source_kind:'configured_switch',state:'off',available:true,
    capabilities:{brightness:true,color:true,color_temperature:true,min_color_temp_kelvin:2200,max_color_temp_kelvin:6000}};
  const v=snap(relay);
  assert.equal(createLightingControlIntent(v,'switch.rele','turn_on')?.entity_id,'switch.rele');
  assert.equal(createLightingControlIntent(v,'switch.rele','turn_off')?.action,'turn_off');
  for (const action of ['set_brightness','set_color_temperature','set_rgb_color']) {
    assert.equal(createLightingControlIntent(v,'switch.rele',action,50),null);
  }
  assert.equal(createLightingControlIntent(snap({...relay,source_kind:'unreviewed'}),'switch.rele','turn_on'),null);
});

test('input objects are never mutated or returned as live references', () => {
  const v=snap();const orig=structuredClone(v);const result=intent('set_brightness',45,v);
  assert.deepEqual(v,orig);
  assert.notStrictEqual(result.parameters,v.lights[0].capabilities);
});

test('never sends commands or exposes transport, user identity, token or client signing logic', () => {
  const result=intent('turn_on');
  assert.deepEqual(Object.keys(result),['entity_id','action','parameters']);
  assert.doesNotMatch(JSON.stringify(result),/gateway_verified|token|trial|actor|installation|password/);
  assert.equal(result.constructor,Object);
});

test('large lists have defensive upper bound and invalid view shape is denied', () => {
  assert.equal(createLightingControlIntent(snap(lamp(),{lights:Array(2001).fill(lamp())}),'light.sala','turn_on'),null);
  assert.equal(createLightingControlIntent(snap(lamp(),{lights:{}}),'light.sala','turn_on'),null);
});
