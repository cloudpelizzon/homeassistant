"""Native service target wiring, real state verification and unique event counts."""
import json,types,unittest
from datetime import datetime,timezone
from unittest.mock import AsyncMock,patch
from native_source132 import SourceTests
from native_mirror130 import FakeWS,Session,SOURCE,state,result
from client81.homolog_mirror import source132 as source
from homeassistant.core import HomeAssistant

class DeliveryTests(unittest.IsolatedAsyncioTestCase):
 asyncSetUp=SourceTests.asyncSetUp
 cleanup=SourceTests.cleanup
 start=SourceTests.start
 finish=SourceTests.finish
 entry=SourceTests.entry
 mirror=SourceTests.mirror
 async def test133_accepted_request_without_state_change_is_not_success(self):
  m=await self.mirror();m.forward_commands=True
  with patch.object(source,'request',AsyncMock(return_value={})) as send,patch.object(source,'source_state',AsyncMock(return_value=state('switch.test_fence','off'))),patch.object(source,'STATE_VERIFY_SECONDS',0):
   with self.assertRaises(PermissionError):await source.forward(self.hass,'switch','turn_on',{'entity_id':'switch.test_fence'})
  self.assertEqual(send.await_count,1);self.assertEqual(m.last_command['outcome'],'no_state_change');self.assertEqual(m.last_command['after'],'off')
 async def test133_unavailable_source_does_not_receive_a_command(self):
  m=await self.mirror();m.forward_commands=True
  with patch.object(source,'request',AsyncMock()) as send,patch.object(source,'source_state',AsyncMock(return_value=state('switch.test_fence','unavailable'))):
   with self.assertRaises(PermissionError):await source.forward(self.hass,'switch','turn_on',{'entity_id':'switch.test_fence'})
   send.assert_not_called()
  self.assertEqual(m.last_command['outcome'],'source_unavailable')
 async def test133_already_on_refreshes_observation_without_actuation(self):
  m=await self.mirror();m.forward_commands=True
  with patch.object(source,'request',AsyncMock()) as send,patch.object(source,'source_state',AsyncMock(return_value=state('switch.test_fence','on'))):
   self.assertTrue(await source.forward(self.hass,'switch','turn_on',{'entity_id':'switch.test_fence'}));send.assert_not_called()
  self.assertEqual(m.last_command['outcome'],'already_in_state');self.assertEqual(self.hass.states.get('switch.test_fence').state,'on')
 async def test133_native_HA_targets_switch_gate_alarm_and_house_mode(self):
  m=await self.mirror();m.forward_commands=True;production=HomeAssistant(str(self.root/'source'))
  self.addAsyncCleanup(production.async_stop);calls=[]
  cases=[('switch','turn_on','switch.test_fence','off','on',{}),('cover','open_cover','cover.test_gate','closed','open',{}),('alarm_control_panel','alarm_disarm','alarm_control_panel.test_alarm','armed_away','disarmed',{}),('input_select','select_option','input_select.test_mode','Casa','Ausente',{'option':'Ausente'})]
  for domain,name,eid,before,after,extra in cases:
   production.states.async_set(eid,before);m.apply(state(eid,before))
   async def effect(call,desired=after):
    calls.append((call.domain,call.service,dict(call.data)));production.states.async_set(call.data['entity_id'],desired)
   production.services.async_register(domain,name,effect)
   class NativeWS(FakeWS):
    async def receive_json(self):
     if self.rows:return await super().receive_json()
     q=self.sent[-1]
     await production.services.async_call(q['domain'],q['service'],q['service_data'],target=q['target'],blocking=True)
     return result(1,{})
   ws=NativeWS([{'type':'auth_required'},{'type':'auth_ok'}])
   async def read(mirror,target):return production.states.get(target).as_dict()
   token=source.DELIVERY_CHECK.set(lambda:None)
   try:
    with patch.object(source,'async_get_clientsession',return_value=Session(ws)),patch.object(source,'source_state',read):
     self.assertTrue(await source.forward(self.hass,domain,name,{'entity_id':eid,**extra}))
   finally:source.DELIVERY_CHECK.reset(token)
   self.assertEqual(production.states.get(eid).state,after);self.assertEqual(m.last_command['outcome'],'state_verified');self.assertEqual(calls[-1][2]['entity_id'],eid)
  self.assertEqual(len(calls),4)
 async def test133_daily_uses_source_timezone_and_one_count_per_context(self):
  m=await self.mirror();m.apply(state('automation.synthetic','on'))
  start=datetime(2026,10,19,3,tzinfo=timezone.utc).timestamp();now=datetime(2026,10,19,15,tzinfo=timezone.utc)
  rows=[{'entity_id':'automation.synthetic','domain':'automation','context_id':'same-run','message':'triggered','when':start+3600},{'entity_id':'automation.synthetic','domain':'automation','context_id':'same-run','message':'triggered','when':start+3601},{'entity_id':'automation.synthetic','domain':'automation','context_id':'yesterday','message':'triggered','when':start-1},{'entity_id':'automation.synthetic','domain':'automation','message':'triggered','when':start+3602}]
  async def read(mirror,kind,**kw):
   if kind=='get_config':return {'time_zone':'America/Sao_Paulo'}
   self.assertEqual(datetime.fromisoformat(kw['start_time']).timestamp(),start)
   return rows
  from homeassistant.util import dt as dt_util
  with patch.object(source,'request',read),patch.object(dt_util,'utcnow',return_value=now):value=await source.daily(self.hass)
  self.assertEqual(value['counts'],{'automation.synthetic':1});self.assertEqual(value['hours'][1],1);self.assertEqual(value['entity_hours']['automation.synthetic'][1],1);self.assertEqual(value['time_zone'],'America/Sao_Paulo')
