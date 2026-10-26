"""Public Lighting lifecycle and signed-result boundaries, without an engine or live device."""
import json,types,unittest,tempfile
from pathlib import Path
from datetime import datetime,timedelta,timezone
from unittest.mock import AsyncMock,patch
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from homeassistant.core import HomeAssistant
from homeassistant.components import websocket_api
from client81.public_lighting import attach
from client81.public_lighting import native_ws,wire
from client81.lighting_controls240 import reviewed_current330

class LightingTests(unittest.IsolatedAsyncioTestCase):
 async def test499_attach_then_profile_has_one_owned_control_registration(self):
  from client81 import profile_client229,lighting_controls240
  with tempfile.TemporaryDirectory(dir='/tmp') as folder:
   hass=HomeAssistant(folder);hass.data[websocket_api.DOMAIN]={}
   client=types.SimpleNamespace(_iid='synthetic-lighting',activate=lambda *a:self.fail('no activation'))
   context={'client':client,'core_id':'a'*32,'trial_id':'synthetic-lighting'}
   bridge=types.SimpleNamespace(fetch_verified=AsyncMock(),installed={'CP-SOLAR'})
   close_transport=await attach(hass,context,bridge)
   self.assertNotIn(lighting_controls240.COMMAND,hass.data[websocket_api.DOMAIN])
   close_profile=profile_client229.register(hass,context)
   self.assertIn(lighting_controls240.COMMAND,hass.data[websocket_api.DOMAIN])
   close_profile();self.assertNotIn(lighting_controls240.COMMAND,hass.data[websocket_api.DOMAIN])
   self.assertIn(native_ws.SNAPSHOT,hass.data[websocket_api.DOMAIN])
   close_transport();await hass.async_stop()

 async def test499_foreign_control_conflict_leaves_no_profile_or_partial_handlers(self):
  from client81 import profile_client229,lighting_controls240
  with tempfile.TemporaryDirectory(dir='/tmp') as folder:
   hass=HomeAssistant(folder);hass.data[websocket_api.DOMAIN]={}
   client=types.SimpleNamespace(_iid='synthetic-lighting')
   context={'client':client,'core_id':'a'*32,'trial_id':'synthetic-lighting'}
   bridge=types.SimpleNamespace(fetch_verified=AsyncMock(),installed={'CP-SOLAR'})
   close_transport=await attach(hass,context,bridge)
   name=lighting_controls240.ROOMS333+'/images337';foreign=(object(),None)
   hass.data[websocket_api.DOMAIN][name]=foreign;before=dict(hass.data[websocket_api.DOMAIN])
   with self.assertRaises(ValueError):profile_client229.register(hass,context)
   self.assertNotIn(profile_client229.KEY,hass.data)
   self.assertEqual(hass.data[websocket_api.DOMAIN],before)
   hass.data[websocket_api.DOMAIN].pop(name)
   close_profile=profile_client229.register(hass,context);close_profile();close_transport()
   await hass.async_stop()

 async def test499_full_runtime_registration_chain_starts_and_unloads_without_activation(self):
  from client81 import runtime,profile_client229,lighting_controls240,module_registration298
  with tempfile.TemporaryDirectory(dir='/tmp') as folder:
   hass=HomeAssistant(folder);hass.data[websocket_api.DOMAIN]={}
   hass.config_entries=types.SimpleNamespace(async_forward_entry_setups=AsyncMock(),async_unload_platforms=AsyncMock(return_value=True))
   callbacks=[];entry=types.SimpleNamespace(domain='cloudpelizzon',entry_id='synthetic-entry',options={},data={},async_on_unload=callbacks.append)
   client=types.SimpleNamespace(_iid='synthetic-lighting',status=lambda:self.fail('no remote status'),activate=lambda *a:self.fail('no activation'))
   context={'client':client,'core_id':'a'*32,'trial_id':'synthetic-lighting'}
   handoff=types.SimpleNamespace(close=lambda:None)
   patches=[patch.object(runtime,'load_context',AsyncMock(return_value=context)),patch.object(runtime,'onboarding',AsyncMock(return_value=handoff)),patch.object(runtime,'automation_ui',AsyncMock(return_value=lambda:None)),patch.object(runtime,'security_ui',AsyncMock(return_value=lambda:None)),patch.object(runtime.frontend,'register',AsyncMock(return_value=lambda:None)),patch.object(module_registration298,'register',AsyncMock(return_value=lambda:None)),patch.object(runtime.fleet_reporter,'start',return_value=lambda:None)]
   for p in patches:p.start()
   try:
    manager=runtime.Runtime(hass,entry,factories={});await manager.start()
    self.assertIn(profile_client229.KEY,hass.data)
    self.assertIn(lighting_controls240.COMMAND,hass.data[websocket_api.DOMAIN])
    await manager.unload()
    self.assertNotIn(runtime.DOMAIN,hass.data);self.assertNotIn(profile_client229.KEY,hass.data)
    self.assertNotIn(lighting_controls240.COMMAND,hass.data[websocket_api.DOMAIN])
   finally:
    for p in reversed(patches):p.stop()
    await hass.async_stop()

 async def test_public_attach_and_owned_unload_without_activation(self):
  with tempfile.TemporaryDirectory(dir='/tmp') as folder:
   hass=HomeAssistant(folder);hass.data[websocket_api.DOMAIN]={}
   client=types.SimpleNamespace(_iid='synthetic-lighting',activate=lambda *a: self.fail('activation must be explicit'))
   original=AsyncMock();bridge=types.SimpleNamespace(fetch_verified=original,installed={'CP-SOLAR'})
   close=await attach(hass,{'client':client},bridge)
   self.assertIn(native_ws.KEY,hass.data);self.assertIn('CP-LIGHTING',bridge.installed)
   self.assertIn(native_ws.SNAPSHOT,hass.data[websocket_api.DOMAIN])
   close();close();self.assertNotIn(native_ws.KEY,hass.data)
   self.assertNotIn(native_ws.SNAPSHOT,hass.data[websocket_api.DOMAIN]);self.assertIs(bridge.fetch_verified,original)
   await hass.async_stop()

 async def test_context_binding_requires_fresh_signed_profile(self):
  client=object();transport=types.SimpleNamespace(port=types.SimpleNamespace(client=client))
  core='a'*32;iid='synthetic-lighting';now=__import__('time').time()
  display=types.SimpleNamespace(closed=False,context={'client':client,'trial_id':iid,'core_id':core},cached={'installation_id':iid,'core_id':core,'issued_at':now-1,'expires_at':now+5})
  hass=types.SimpleNamespace(data={'cloudpelizzon_profile229':display})
  self.assertTrue(reviewed_current330(hass,transport,iid))
  display.cached['core_id']='b'*32;self.assertFalse(reviewed_current330(hass,transport,iid))
  display.cached['core_id']=core;display.cached['expires_at']=now-1;self.assertFalse(reviewed_current330(hass,transport,iid))

 def result(self):
  self.key=Ed25519PrivateKey.generate();self.now=datetime.now(timezone.utc)
  env={'installation_id':'synthetic-lighting','operation':'lighting.config.read','args':{'actor_id':'synthetic-admin','parameters':{}},'request_id':'a'*32,'nonce':'b'*32}
  c={'schema':'cp.lighting.result.v1','sku':'CP-LIGHTING',**{k:env[k] for k in ('installation_id','operation','request_id','nonce')},'args_sha256':wire.binding(env['installation_id'],env['operation'],env['args'],env['request_id']),'issued_at':self.now.isoformat(),'expires_at':(self.now+timedelta(seconds=4)).isoformat(),'result':{'revision':0}}
  return env,{'claims':c,'signature':self.key.sign(wire.PREFIX+wire.canonical(c)).hex()}

 def test_fresh_bound_result_is_verified(self):
  env,packet=self.result();self.assertEqual(wire.verify_result(packet,env,self.key.public_key(),self.now),{'revision':0})

 def test_changed_parameters_or_actor_are_denied(self):
  env,packet=self.result();env['args']['actor_id']='other-user'
  with self.assertRaises(PermissionError):wire.verify_result(packet,env,self.key.public_key(),self.now)

 def test_expired_result_is_denied(self):
  env,packet=self.result()
  with self.assertRaises(PermissionError):wire.verify_result(packet,env,self.key.public_key(),self.now+timedelta(seconds=6))

 def test_unknown_signer_is_denied(self):
  env,packet=self.result()
  with self.assertRaises(Exception):wire.verify_result(packet,env,Ed25519PrivateKey.generate().public_key(),self.now)
