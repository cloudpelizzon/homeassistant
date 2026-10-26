"""Public Lighting lifecycle and signed-result boundaries, without an engine or live device."""
import json,types,unittest,tempfile
from pathlib import Path
from datetime import datetime,timedelta,timezone
from unittest.mock import AsyncMock
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from homeassistant.core import HomeAssistant
from homeassistant.components import websocket_api
from client81.public_lighting import attach
from client81.public_lighting import native_ws,wire
from client81.lighting_controls240 import reviewed_current330

class LightingTests(unittest.IsolatedAsyncioTestCase):
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
