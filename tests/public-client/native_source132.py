"""Synthetic production endpoint only; never contacts equipment."""
import json,types,unittest
from datetime import datetime,timedelta,timezone
from unittest.mock import AsyncMock,patch
from native_setup import NativeSetupTests
from native_mirror130 import MirrorTests,FakeWS,Session,SOURCE,result,state
from client81.homolog_mirror import Mirror,policy
from client81.homolog_mirror import source132 as source

class SourceTests(unittest.IsolatedAsyncioTestCase):
 asyncSetUp=MirrorTests.asyncSetUp
 cleanup=NativeSetupTests.cleanup
 start=NativeSetupTests.start
 finish=NativeSetupTests.finish
 entry=MirrorTests.entry
 async def mirror(self):
  entry=await self.entry();m=Mirror(self.hass,entry,'synthetic-not-a-real-token',SOURCE)
  self.hass.data[policy.DOMAIN]={entry.entry_id:m};m.apply(state('switch.test_fence','off'))
  return m
 async def test132_default_has_no_production_actuation(self):
  m=await self.mirror()
  with patch.object(source,'request',AsyncMock()) as send:
   with self.assertRaises(PermissionError):await source.forward(self.hass,'switch','turn_on',{'entity_id':'switch.test_fence'})
   send.assert_not_called()
  self.assertTrue(self.hass.states.get('switch.test_fence').attributes['cloudpelizzon_read_only'])
 async def test132_signed_context_and_ack_required(self):
  m=await self.mirror();m.forward_commands=True;m.apply(state('switch.test_fence','off'))
  ws=FakeWS([{'type':'auth_required'},{'type':'auth_ok'},result(1,{})]);check=[]
  token=source.DELIVERY_CHECK.set(lambda:check.append(True))
  try:
   with patch.object(source,'async_get_clientsession',return_value=Session(ws)),patch.object(source,'source_state',AsyncMock(side_effect=[state('switch.test_fence','off'),state('switch.test_fence','on')])):
    self.assertTrue(await source.forward(self.hass,'switch','turn_on',{'entity_id':'switch.test_fence'}))
  finally:source.DELIVERY_CHECK.reset(token)
  self.assertEqual(check,[True]);self.assertEqual(m.commands_forwarded,1)
  self.assertEqual(ws.sent[-1],{'id':1,'type':'call_service','domain':'switch','service':'turn_on','target':{'entity_id':'switch.test_fence'},'service_data':{}})
 async def test132_denied_source_ack_never_retries(self):
  m=await self.mirror();m.forward_commands=True
  ws=FakeWS([{'type':'auth_required'},{'type':'auth_ok'},{'type':'result','id':1,'success':False}]);token=source.DELIVERY_CHECK.set(lambda:None)
  try:
   with patch.object(source,'async_get_clientsession',return_value=Session(ws)),patch.object(source,'source_state',AsyncMock(return_value=state('switch.test_fence','off'))):
    with self.assertRaises(PermissionError):await source.forward(self.hass,'switch','turn_on',{'entity_id':'switch.test_fence'})
  finally:source.DELIVERY_CHECK.reset(token)
  self.assertEqual(sum(x['type']=='call_service' for x in ws.sent),1);self.assertEqual(m.commands_forwarded,0)
 async def test132_expired_receipt_cannot_cross_source_handshake(self):
  m=await self.mirror();m.forward_commands=True
  ws=FakeWS([{'type':'auth_required'},{'type':'auth_ok'}])
  def expired():raise PermissionError('expired')
  token=source.DELIVERY_CHECK.set(expired)
  try:
   with patch.object(source,'async_get_clientsession',return_value=Session(ws)),patch.object(source,'source_state',AsyncMock(return_value=state('switch.test_fence','off'))):
    with self.assertRaises(PermissionError):await source.forward(self.hass,'switch','turn_on',{'entity_id':'switch.test_fence'})
  finally:source.DELIVERY_CHECK.reset(token)
  self.assertEqual([x['type'] for x in ws.sent],['auth'])
 async def test132_redirect_does_not_receive_credentials(self):
  m=await self.mirror();ws=FakeWS([],url='http://10.8.0.3:8123/api/websocket')
  with patch.object(source,'async_get_clientsession',return_value=Session(ws)):
   with self.assertRaises(ValueError):await source.request(m,'cloudpelizzon/energy/config/get')
  self.assertEqual(ws.sent,[])
 async def test132_mixed_and_expanded_targets_rejected(self):
  m=await self.mirror();m.forward_commands=True;self.hass.states.async_set('switch.local','off')
  with patch.object(source,'request',AsyncMock()) as send:
   for data in ({'entity_id':['switch.test_fence','switch.local']},{'entity_id':'switch.test_fence','area_id':'all'}):
    with self.assertRaises(PermissionError):await source.forward(self.hass,'switch','turn_on',data)
   send.assert_not_called()
 async def test132_counts_actual_triggers_not_last_state_or_duplicate_codes(self):
  start=datetime(2026,10,19,tzinfo=timezone.utc);end=start+timedelta(hours=12);t=start.timestamp()+3600
  rows=[{'entity_id':'automation.a','when':t+i,'domain':'automation','message':'triggered by state','context_id':str(i)} for i in range(7)]
  rows+=[rows[0],{'entity_id':'automation.a','when':t+10,'message':'turned off'},{'entity_id':'automation.b','when':t,'message':'triggered','domain':'automation','context_id':'b1'},{'entity_id':'automation.a','when':t-90000,'message':'triggered'}]
  counts,hours=source.count_events(rows,['automation.a','automation.b'],start,end,timezone.utc)
  self.assertEqual(counts,{'automation.a':7,'automation.b':1});self.assertEqual(sum(hours),8);self.assertEqual(hours[1],8)
 async def test132_config_only_copies_measurement_fields(self):
  doc={'config':{'installation_id':'do-not-copy','license':'do-not-copy','site':{'name':'Home','house_power_entity':'sensor.power','token':'do-not-copy'},'generation':[{'name':'PV','power_entity':'sensor.pv','power_transform':'absolute','private_key':'do-not-copy'}],'boards':[],'grid':{},'grants':['do-not-copy']},'private_key':'do-not-copy'}
  value=source.measurement_config(doc)
  self.assertNotIn('do-not-copy',json.dumps(value));self.assertEqual(value['generation'][0]['power_transform'],'absolute');self.assertEqual(value['site']['house_power_entity'],'sensor.power')
 async def test132_history_rejects_non_measurement_and_long_windows(self):
  await self.mirror();args={'entity_ids':['sensor.private'],'start_time':'2026-10-19T00:00:00Z','end_time':'2026-10-20T00:00:00Z'}
  with patch.object(source,'request',AsyncMock()) as send:
   with self.assertRaises(ValueError):await source.energy_history(self.hass,args,{'sensor.power'})
   args.update(entity_ids=['sensor.power'],end_time='2027-10-20T00:00:00Z')
   with self.assertRaises(ValueError):await source.energy_history(self.hass,args,{'sensor.power'})
   send.assert_not_called()
 async def test132_history_requests_only_selected_measurements(self):
  m=await self.mirror();args={'entity_ids':['sensor.power'],'start_time':'2026-10-19T00:00:00Z','end_time':'2026-10-20T00:00:00Z'}
  with patch.object(source,'request',AsyncMock(return_value={'sensor.power':[{'s':'1200','lu':1}]})) as send:
   self.assertIn('sensor.power',await source.energy_history(self.hass,args,{'sensor.power'}));self.assertEqual(send.call_args.args[1],'history/history_during_period');self.assertTrue(send.call_args.kwargs['no_attributes'])
