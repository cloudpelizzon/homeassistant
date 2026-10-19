"""Native measurement selection and read-only camera transport regressions."""
import json,types,unittest
from unittest.mock import AsyncMock,patch
from native_setup import NativeSetupTests
from native_mirror130 import MirrorTests,SOURCE
from client81.homolog_mirror import Mirror
from client81.camera import ObservationCamera
from client81.adapters.solar.runtime45 import Controller,permissions
class UsabilityTests(unittest.IsolatedAsyncioTestCase):
 asyncSetUp=MirrorTests.asyncSetUp
 cleanup=NativeSetupTests.cleanup
 start=NativeSetupTests.start
 finish=NativeSetupTests.finish
 entry=MirrorTests.entry
 def client(self):
  outer=self;calls=[]
  class Client:
   def execute(self,sku,operation,args,request_id):
    calls.append((sku,operation,args))
    if operation=='solar.entities.discover':
     rows=[{'entity_id':k,'name':v['attributes'].get('friendly_name',k)} for k,v in args['states'].items()]
     return {'power':[r for r in rows if args['states'][r['entity_id']]['attributes'].get('device_class')=='power'],'energy':[r for r in rows if args['states'][r['entity_id']]['attributes'].get('device_class')=='energy'],'suggestions':{}}
    return {'configured':True}
  return Client(),calls
 async def test131_detection_reads_new_measurements_only_after_admin_request(self):
  entry=await self.entry();client,calls=self.client();folder=self.root/'.storage/cloudpelizzon_edge'
  controller=Controller(self.hass,entry,'synthetic',client,folder,[]);self.addCleanup(controller.close)
  self.hass.states.async_set('sensor.production_pv','1700',{'device_class':'power','unit_of_measurement':'W'})
  self.hass.states.async_set('sensor.production_energy','5',{'device_class':'energy','unit_of_measurement':'kWh'})
  self.hass.states.async_set('sensor.cloudpelizzon_normalized','1200',{'device_class':'power'})
  self.assertEqual(calls,[])
  with self.assertRaises(PermissionError):await controller.handle('cloudpelizzon/energy/discover',admin=False)
  self.assertEqual(calls,[])
  result=await controller.handle('cloudpelizzon/energy/discover',admin=True)
  self.assertEqual(result['power'][0]['entity_id'],'sensor.production_pv');self.assertEqual(len(result['power']),1)
  self.assertEqual(controller.selected,());self.assertEqual(permissions(folder),[])
  with patch.object(controller,'refresh',AsyncMock()):
   await controller.handle('cloudpelizzon/energy/config/save',{'config_json':json.dumps({'site':{'house_power_entity':'sensor.production_pv'},'generation':[{'energy_entity':'sensor.production_energy'}]})},admin=True)
  self.assertEqual(set(permissions(folder)),{'sensor.production_pv','sensor.production_energy'})
  self.assertEqual(set(controller.bridge._approved_read_entities),set(controller.selected))
 async def test131_large_measurement_discovery_uses_bounded_batches(self):
  entry=await self.entry();client,calls=self.client();controller=Controller(self.hass,entry,'synthetic',client,self.root/'.storage/cloudpelizzon_edge',[]);self.addCleanup(controller.close)
  for i in range(205):self.hass.states.async_set('sensor.power_'+str(i),'1',{'device_class':'power','unit_of_measurement':'W'})
  result=await controller.handle('cloudpelizzon/energy/discover',admin=True)
  self.assertEqual(len(result['power']),205);self.assertEqual(len(calls),3);self.assertTrue(all(len(c[2]['states'])<=100 for c in calls))
 async def test131_owned_registry_restoration_is_not_a_local_collision(self):
  entry=await self.entry();mirror=Mirror(self.hass,entry,'synthetic',SOURCE)
  mirror.apply({'entity_id':'sensor.restored_probe','state':'1','attributes':{}})
  self.hass.states.async_set('sensor.restored_probe','unavailable',{'restored':True})
  reload=Mirror(self.hass,entry,'synthetic',SOURCE);reload.apply({'entity_id':'sensor.restored_probe','state':'2','attributes':{}})
  self.assertEqual(self.hass.states.get('sensor.restored_probe').state,'2');self.assertNotIn('sensor.restored_probe',reload.blocked)
 async def test131_camera_image_get_keeps_source_token_on_backend(self):
  entry=await self.entry();mirror=Mirror(self.hass,entry,'synthetic-source-secret',SOURCE)
  camera=ObservationCamera(mirror,'camera.synthetic','idle',{'friendly_name':'Synthetic camera'});camera.hass=self.hass
  calls=[]
  class Content:
   async def iter_chunked(self,n):yield b'chunk1';yield b'chunk2'
  class Response:
   status=200;headers={'Content-Type':'image/jpeg'};content=Content()
   async def __aenter__(self):return self
   async def __aexit__(self,*a):pass
  class Session:
   def get(self,url,**kw):calls.append((url,kw));return Response()
  import client81.camera as module
  with patch.object(module,'async_get_clientsession',return_value=Session()):
   self.assertEqual(await camera.async_camera_image(),b'chunk1chunk2');self.assertEqual(await camera.async_camera_image(),b'chunk1chunk2')
  self.assertEqual(len(calls),1);self.assertEqual(calls[0][0],SOURCE.split('/api/')[0]+'/api/camera_proxy/camera.synthetic')
  self.assertIs(calls[0][1]['allow_redirects'],False);self.assertEqual(calls[0][1]['headers']['Authorization'],'Bearer synthetic-source-secret')
  self.assertNotIn('synthetic-source-secret',json.dumps(camera.extra_state_attributes));self.assertEqual(int(camera.supported_features),0)
 async def test131_camera_redirect_does_not_follow_source_credentials(self):
  entry=await self.entry();mirror=Mirror(self.hass,entry,'synthetic',SOURCE);camera=ObservationCamera(mirror,'camera.synthetic','idle',{});camera.hass=self.hass
  class Response:
   status=302;headers={'Location':'http://10.8.0.3/steal','Content-Type':'text/html'}
   async def __aenter__(self):return self
   async def __aexit__(self,*a):pass
  get=unittest.mock.Mock(return_value=Response())
  import client81.camera as module
  with patch.object(module,'async_get_clientsession',return_value=types.SimpleNamespace(get=get)):
   self.assertIsNone(await camera.async_camera_image())
  self.assertEqual(get.call_count,1);self.assertIs(get.call_args.kwargs['allow_redirects'],False)
