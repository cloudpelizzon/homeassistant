"""Real HA manager/registry/state tests; all source traffic is synthetic."""
import asyncio,json,types,unittest
from unittest.mock import AsyncMock,patch
from homeassistant import config_entries
from homeassistant.helpers import device_registry as dr,entity_registry as er
from homeassistant.helpers.storage import Store
import aiohttp
from native_setup import NativeSetupTests
from client81.homolog_mirror import Mirror,start_saved
from client81.homolog_mirror import options,policy

BASE='http://10.8.0.2:8123';SOURCE=BASE+'/api/websocket'
class FakeWS:
 def __init__(self,rows,url=SOURCE):self.rows=list(rows);self.sent=[];self._response=types.SimpleNamespace(url=url)
 async def __aenter__(self):return self
 async def __aexit__(self,*a):pass
 async def send_json(self,row):self.sent.append(row)
 async def receive_json(self):
  if not self.rows:raise ConnectionError('synthetic end')
  return self.rows.pop(0)
 async def receive(self):return types.SimpleNamespace(type=aiohttp.WSMsgType.TEXT,data=json.dumps(await self.receive_json()))
class Session:
 def __init__(self,ws):self.ws=ws
 def ws_connect(self,url,**kw):
  if url!=SOURCE:raise AssertionError('unexpected source')
  return self.ws

def state(eid,value,attrs=None):return {'entity_id':eid,'state':value,'attributes':attrs or {}}
def result(i,data):return {'type':'result','id':i,'success':True,'result':data}
def event(eid,value):return {'type':'event','event':{'data':{'entity_id':eid,'new_state':state(eid,value)}}}

class MirrorTests(unittest.IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  await NativeSetupTests.asyncSetUp(self)
  dr.async_setup(self.hass)
  await dr.async_load(self.hass)
  await er.async_load(self.hass)
 cleanup=NativeSetupTests.cleanup
 start=NativeSetupTests.start
 finish=NativeSetupTests.finish
 async def entry(self):return (await self.start({'consent':True}))['result']
 async def test130_native_options_form(self):
  entry=await self.entry();r=await self.hass.config_entries.options.async_init(entry.entry_id)
  self.assertEqual(r['type'],'form');self.assertEqual(r['step_id'],'init')
 async def test130_options_store_token_locally_preserve_other_options(self):
  entry=await self.entry();self.hass.config_entries.async_update_entry(entry,options={'maintenance_delivery':{'enabled':False}})
  before=dict(entry.data);r=await self.hass.config_entries.options.async_init(entry.entry_id)
  ws=FakeWS([{'type':'auth_required'},{'type':'auth_ok'},result(1,[]),result(2,[]),result(3,[])])
  with patch.object(options,'async_get_clientsession',return_value=Session(ws)),patch.object(options,'start_saved',AsyncMock()):
   r=await self.hass.config_entries.options.async_configure(r['flow_id'],{'enabled':True,'source_url':BASE,'token':'synthetic-only'})
  self.assertEqual(r['type'],'create_entry');self.assertEqual(dict(entry.data),before);self.assertEqual(dict(entry.options),{'maintenance_delivery':{'enabled':False}})
  saved=await Store(self.hass,1,policy.STORE,private=True).async_load();self.assertEqual(saved['token'],'synthetic-only');self.assertEqual((self.root/'.storage'/policy.STORE).stat().st_mode&0o777,0o600)
  self.assertEqual([m['type'] for m in ws.sent],['auth','get_states','config/device_registry/list','config/entity_registry/list'])
 async def test130_invalid_origin_does_not_save_or_send_token(self):
  entry=await self.entry();r=await self.hass.config_entries.options.async_init(entry.entry_id)
  with patch.object(options,'async_get_clientsession') as session:
   r=await self.hass.config_entries.options.async_configure(r['flow_id'],{'enabled':True,'source_url':'https://example.com','token':'synthetic-only'})
  self.assertEqual(r['type'],'form');session.assert_not_called();self.assertIsNone(await Store(self.hass,1,policy.STORE,private=True).async_load())
 async def test130_real_device_entity_and_collision(self):
  entry=await self.entry();mirror=Mirror(self.hass,entry,'synthetic-only',SOURCE)
  dev=dr.async_get(self.hass).async_get_or_create(config_entry_id=entry.entry_id,identifiers={(policy.DOMAIN,'fake-device')},name='Synthetic inverter')
  mirror.mapping={'sensor.synthetic_solar':{'device_id':dev.id}}
  mirror.apply(state('sensor.synthetic_solar','1250',{'device_class':'power','unit_of_measurement':'W'}))
  self.assertEqual(self.hass.states.get('sensor.synthetic_solar').state,'1250')
  reg=er.async_get(self.hass).async_get('sensor.synthetic_solar');self.assertEqual(reg.device_id,dev.id)
  self.hass.states.async_set('switch.local','on');mirror.apply(state('switch.local','off'));self.assertEqual(self.hass.states.get('switch.local').state,'on')
  mirror.offline();self.assertEqual(self.hass.states.get('sensor.synthetic_solar').state,'unavailable')
  reload=Mirror(self.hass,entry,'synthetic-only',SOURCE);reload.apply(state('sensor.synthetic_solar','2300'));self.assertEqual(self.hass.states.get('sensor.synthetic_solar').state,'2300')
 async def test130_subscribe_snapshot_buffer_and_event_stream(self):
  entry=await self.entry();mirror=Mirror(self.hass,entry,'synthetic-only',SOURCE)
  ws=FakeWS([{'type':'auth_required'},{'type':'auth_ok'},result(1,None),result(2,[]),result(3,[]),event('sensor.synthetic_solar','2300'),result(4,[state('sensor.synthetic_solar','1200')]),event('sensor.synthetic_solar','3300')])
  import client81.homolog_mirror as module
  with patch.object(module,'async_get_clientsession',return_value=Session(ws)):
   with self.assertRaises(ConnectionError):await mirror.connect()
  self.assertEqual(self.hass.states.get('sensor.synthetic_solar').state,'3300')
  self.assertEqual([m['type'] for m in ws.sent],['auth','subscribe_events','config/device_registry/list','config/entity_registry/list','get_states'])
 async def test130_redirect_does_not_receive_credentials(self):
  ws=FakeWS([],url='http://10.8.0.3:8123/api/websocket')
  with patch.object(options,'async_get_clientsession',return_value=Session(ws)):
   with self.assertRaises(ValueError):await options.verify(self.hass,SOURCE,'synthetic-only')
  self.assertEqual(ws.sent,[])
 async def test130_no_mirror_config_no_source_connection(self):
  entry=await self.entry()
  import client81.homolog_mirror as module
  with patch.object(module,'async_get_clientsession') as session:await start_saved(self.hass,entry)
  session.assert_not_called()
 async def test130_write_commands_and_credentials_excluded(self):
  for kind in ('call_service','fire_event','config/automation/update','execute_script'):
   with self.assertRaises(ValueError):policy.outgoing(kind,id=10)
  row=policy.clean(state('camera.front','idle',{'access_token':'fake','entity_picture':'/secret'}));self.assertNotIn('access_token',row[2]);self.assertNotIn('entity_picture',row[2])
  self.assertIsNone(policy.clean(state('sensor.cloudpelizzon_trial','active')))
  self.assertIsNone(policy.clean(state('sensor.feedback','1',{'cloudpelizzon_read_only':True})))
  entry=await self.entry();mirror=Mirror(self.hass,entry,'synthetic-only',SOURCE);mirror.owned={f'sensor.limit_{i}' for i in range(10000)}
  mirror.apply(state('sensor.over_limit','1'));self.assertIsNone(self.hass.states.get('sensor.over_limit'))

 async def test130_saved_mirror_lifecycle_and_identity_guard(self):
  entry=await self.entry()
  import client81.homolog_mirror as module
  saved={'enabled':True,'source_base':BASE,'token':'synthetic-only','target_core':entry.data['fleet_installation_id']}
  await Store(self.hass,1,policy.STORE,private=True).async_save(saved)
  began=asyncio.Event()
  async def wait_forever(_self):began.set();await asyncio.Event().wait()
  with patch.object(Mirror,'run',wait_forever):
   await start_saved(self.hass,entry);await asyncio.wait_for(began.wait(),1)
   mirror=self.hass.data[policy.DOMAIN][entry.entry_id];self.assertFalse(mirror.task.done())
   await module.stop(self.hass,entry);self.assertTrue(mirror.task.cancelled())
  saved['target_core']='0'*32;await Store(self.hass,1,policy.STORE,private=True).async_save(saved)
  with patch.object(module,'async_get_clientsession') as session:await start_saved(self.hass,entry)
  session.assert_not_called();self.assertNotIn(entry.entry_id,self.hass.data[policy.DOMAIN])

 async def test130_signed_runtime_denies_read_only_targets_before_HA_service(self):
  entry=await self.entry();self.hass.states.async_set('switch.synthetic_mirror','on',{'cloudpelizzon_read_only':True})
  from client81.public_security import runtime126
  from client81.public_automation import runtime124
  for module in (runtime126,runtime124):
   with patch.object(module,'Edge') as edge,patch.object(self.hass.services,'async_call',AsyncMock()) as service:
    module.create(self.hass,entry,{'client':object(),'trial_id':'synthetic-only'})
    dispatch=edge.call_args.kwargs['service']
    with self.assertRaises(PermissionError):await dispatch('switch','turn_off',{'entity_id':['switch.synthetic_mirror']})
    service.assert_not_awaited()
