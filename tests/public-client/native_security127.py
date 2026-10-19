"""Native HA registrations and lifecycle; synthetic SDK, no devices/network."""
import asyncio,copy,shutil,threading,types,unittest,uuid
from pathlib import Path
from aiohttp import web
from homeassistant import loader
from homeassistant.core import HomeAssistant
from homeassistant.components import websocket_api
from homeassistant.components.http import KEY_HASS
from client81.security import create
from client81.public_security import api126 as api
from client81.adapters.security.configuration import api as configuration
from client81.adapters.security.engines import api as engines
from client81.adapters.security.engines.bridge import READ as ENGINE_READ

class NativeSecurityTests(unittest.IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  self.root=Path('/tmp')/('security-public127-'+uuid.uuid4().hex);self.root.mkdir()
  self.hass=HomeAssistant(str(self.root));loader.async_setup(self.hass);await self.hass.async_start()
  app=web.Application();app[KEY_HASS]=self.hass
  self.hass.http=types.SimpleNamespace(app=app,register_view=lambda view:view.register(self.hass,app,app.router))
  self.entry=types.SimpleNamespace(entry_id='synthetic127',options={'preserve':True})
  self.previous=self.hass.config_entries
  def update(entry,**changes):entry.options=changes['options']
  self.hass.config_entries=types.SimpleNamespace(async_get_entry=lambda entry_id:self.entry if entry_id==self.entry.entry_id else None,async_update_entry=update)
  outer=self;self.calls=[]
  class SDK:
   def status(self):return {'modules':{'CP-SECURITY':{'phase':'not_started','paid_confirmed':False}}}
   def security_session(self,args,**kwargs):
    outer.calls.append(('session',copy.deepcopy(args),threading.get_ident()))
    return {'prepared':True,'policy':args['policy'],'trial_started':False} if args['action']=='prepare' else {'closed':True}
   def security(self,action,args,**kwargs):
    outer.calls.append((action,copy.deepcopy(args),threading.get_ident()))
    if action=='engines.read':return {'version':1,'engines':[],'global':{},'events':[]}
    if action=='config.read':return {'configuracao':{'geral':{'modo_sombra':True}},'resumo':{}}
    raise AssertionError('unexpected_synthetic_action')
  self.context={'client':SDK(),'trial_id':'synthetic-security-public127'}
  self.close=await create(self.hass,self.entry,self.context);self.edge=self.context['security_edge']
 async def asyncTearDown(self):
  self.close();await asyncio.gather(self.edge.task,return_exceptions=True)
  self.hass.config_entries=self.previous;await self.hass.async_stop()
  assert self.root.parent==Path('/tmp') and self.root.name.startswith('security-public127-');shutil.rmtree(self.root)
 async def invoke(self,command,args=None,admin=True):
  connection=types.SimpleNamespace(user=types.SimpleNamespace(is_active=True,is_admin=admin),result=None,error=None)
  connection.send_result=lambda i,value:setattr(connection,'result',value)
  connection.send_error=lambda *value:setattr(connection,'error',value)
  message={'id':1,'type':command,**(args or {})};schema=self.hass.data[websocket_api.DOMAIN][command][1]
  if schema is not False:message=schema(message)
  await (engines.dispatch if command==ENGINE_READ else api.dispatch)(self.hass,connection,message)
  return connection
 async def test_default_permissions_are_empty_and_no_trial_is_started(self):
  result=await self.invoke(api.READ);self.assertIsNone(result.error)
  self.assertEqual(result.result['policy'],{'reads':[],'effects':[],'notification':None});self.assertEqual(self.calls,[])
 async def test_confirmed_permissions_preserve_other_options_and_use_executor(self):
  policy={'reads':['binary_sensor.synthetic'],'effects':[['cover','open_cover','cover.synthetic']],'notification':None}
  result=await self.invoke(api.SAVE,{'policy':policy,'confirmed':True});self.assertIsNone(result.error)
  self.assertTrue(self.entry.options['preserve']);self.assertEqual(self.entry.options['security_runtime126'],policy)
  self.assertTrue(all(row[2]!=threading.get_ident() for row in self.calls))
 async def test_nonadmin_cannot_grant_permissions_or_send_command(self):
  result=await self.invoke(api.SAVE,{'policy':{'reads':[],'effects':[],'notification':None},'confirmed':True},admin=False)
  self.assertIsNotNone(result.error);self.assertNotIn('security_runtime126',self.entry.options)
  result=await self.invoke(api.MANUAL,{'service':'cover.open_cover','data':{'entity_id':'cover.synthetic'}},admin=False)
  self.assertIsNotNone(result.error);self.assertEqual(self.calls,[])
 async def test_engine_bridge_uses_security_channel(self):
  result=await self.invoke(ENGINE_READ);self.assertIsNone(result.error);self.assertEqual(result.result['engines'],[])
  self.assertEqual([row[0] for row in self.calls],['engines.read'])
 async def test_configuration_bridge_uses_security_channel(self):
  bridge=self.hass.data[configuration.KEY]['bridge']
  result=await bridge.handle('configuration.get',authenticated=True,admin=True)
  self.assertTrue(result['configuracao']['geral']['modo_sombra']);self.assertEqual([row[0] for row in self.calls],['config.read'])
 async def test_owned_unload_removes_routes_and_invalidates_pending_dispatch(self):
  token=self.edge.generation;self.close()
  for name in (api.READ,api.SAVE,api.MANUAL,ENGINE_READ):self.assertNotIn(name,self.hass.data[websocket_api.DOMAIN])
  with self.assertRaises(PermissionError):await self.edge.dispatch(token,{'reads':[],'effects':[],'notification':None},'cover.open_cover',{'entity_id':'cover.synthetic'})
