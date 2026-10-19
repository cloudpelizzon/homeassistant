"""Actual native HA entity adapters, no private engine and no device access."""
import types,unittest
from datetime import datetime,timedelta,timezone
from unittest.mock import AsyncMock
from client81.alarm_control_panel import PrivateAlarm
from client81.select import PrivateMode
from client81.public_security.edge126 import Edge

class NativeSecurity134Tests(unittest.IsolatedAsyncioTestCase):
 def edge(self):
  now=datetime.now(timezone.utc)
  return types.SimpleNamespace(closed=False,connected=True,native={'alarm':'disarmed','mode':'Casa','faults':[],'revision':1},native_at=now,clock=lambda:now,native_command=AsyncMock(),native_listeners=set())
 async def test_alarm_entity_has_no_dependency_on_source_or_external_alarm(self):
  edge=self.edge();entity=PrivateAlarm(edge)
  self.assertTrue(entity.available);self.assertEqual(str(entity.alarm_state),'disarmed');self.assertTrue(entity.extra_state_attributes['cloudpelizzon_native_security'])
  edge.native['alarm']='panic';self.assertEqual(str(entity.alarm_state),'triggered')
 async def test_native_alarm_services_only_call_signed_private_transport(self):
  edge=self.edge();entity=PrivateAlarm(edge);entity.hass=types.SimpleNamespace(auth=None)
  await entity.async_alarm_arm_home();await entity.async_alarm_arm_away();await entity.async_alarm_disarm();await entity.async_alarm_trigger()
  self.assertEqual([x.args[0] for x in edge.native_command.await_args_list],['alarm.arm_home','alarm.arm_away','alarm.disarm','alarm.panic'])
 async def test_stale_or_disconnected_native_state_is_unavailable(self):
  edge=self.edge();entity=PrivateAlarm(edge);edge.native_at-=timedelta(seconds=7);self.assertFalse(entity.available)
  edge.native_at=edge.clock();edge.connected=False;self.assertFalse(entity.available)
 async def test_residence_selector_is_a_projection_not_a_local_engine(self):
  edge=self.edge();entity=PrivateMode(edge);entity.hass=types.SimpleNamespace(auth=None)
  self.assertEqual(entity.current_option,'Casa');await entity.async_select_option('Ausente');self.assertEqual(edge.native_command.await_args.args,('native.mode',{'mode':'Ausente'}));self.assertEqual(entity.current_option,'Casa')
 async def test_invalid_server_state_never_overwrites_a_valid_snapshot(self):
  edge=object.__new__(Edge);edge.native=None;edge.native_at=None;edge.native_listeners=set();edge.clock=lambda:datetime.now(timezone.utc)
  with self.assertRaises(ValueError):edge.native_update({'alarm':'forged','mode':'Casa'})
  self.assertIsNone(edge.native)

 async def test_presence_refresh_is_awaited_before_private_snapshot_delivery(self):
  sequence=[];policy={'reads':['person.synthetic'],'effects':[],'notification':None}
  async def refresh(approved):self.assertEqual(approved,policy);sequence.append('refresh')
  class SDK:
   def security(self,action,payload,**kwargs):sequence.append('feed');return {'connected':True,'faults':[],'shadow_mode':True}
  async def executor(fn):return fn()
  def snapshot(reads):sequence.append('snapshot');return {}
  edge=Edge(SDK(),executor=executor,snapshot=snapshot,read_policy=lambda:policy,save_policy=lambda x:None,service=None,relay_factory=None,before_snapshot=refresh)
  await edge.cycle();self.assertEqual(sequence,['refresh','snapshot','feed'])

 async def test_partial_bypass_and_blockers_are_server_projections(self):
  edge=self.edge();edge.native.update(partial_open_bypass=True,bypassed_sensors=['binary_sensor.window'],arm_blockers={'partial_closed':['binary_sensor.door']});entity=PrivateAlarm(edge)
  attrs=entity.extra_state_attributes;self.assertEqual(attrs['bypassed_sensors'],['binary_sensor.window']);self.assertEqual(attrs['arm_blockers'],{'partial_closed':['binary_sensor.door']});self.assertTrue(attrs['partial_open_bypass'])

 async def test_native_alarm_changes_are_written_into_the_actual_HA_state_machine(self):
  import logging,shutil,uuid
  from pathlib import Path
  from homeassistant import loader,config_entries
  from homeassistant.core import HomeAssistant
  from homeassistant.helpers import issue_registry,entity_registry,device_registry
  from homeassistant.setup import async_setup_component
  from homeassistant.components.alarm_control_panel.const import DATA_COMPONENT
  root=Path('/tmp')/('native-alarm137-'+uuid.uuid4().hex);root.mkdir()
  hass=HomeAssistant(str(root));loader.async_setup(hass)
  hass.config_entries=config_entries.ConfigEntries(hass,{})
  device_registry.async_setup(hass)
  await issue_registry.async_load(hass);await device_registry.async_load(hass);await entity_registry.async_load(hass);await hass.config_entries.async_initialize()
  self.assertTrue(await async_setup_component(hass,'alarm_control_panel',{}));await hass.async_start()
  edge=object.__new__(Edge);edge.closed=False;edge.connected=True;edge.native=None;edge.native_at=None;edge.native_listeners=set();edge.clock=lambda:datetime.now(timezone.utc)
  edge.native_update({'alarm':'disarmed','mode':'Casa','pending':None,'revision':1})
  entity=PrivateAlarm(edge);component=hass.data[DATA_COMPONENT]
  try:
   await component.async_add_entities([entity])
   self.assertEqual(hass.states.get(entity.entity_id).state,'disarmed')
   edge.native_update({'alarm':'arming','mode':'Casa','pending':{'kind':'exit','target':'armed_home','due':edge.clock().timestamp()+60},'revision':2})
   self.assertEqual(hass.states.get(entity.entity_id).state,'arming');self.assertEqual(hass.states.get(entity.entity_id).attributes['pending']['target'],'armed_home')
   edge.native_update({'alarm':'armed_home','mode':'Casa','pending':None,'revision':3,'bypassed_sensors':['binary_sensor.synthetic_open']})
   self.assertEqual(hass.states.get(entity.entity_id).state,'armed_home');self.assertEqual(hass.states.get(entity.entity_id).attributes['bypassed_sensors'],['binary_sensor.synthetic_open'])
   await entity.async_remove();self.assertEqual(edge.native_listeners,set())
  finally:
   await hass.async_stop();shutil.rmtree(root)
