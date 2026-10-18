"""Public WS lifecycle/auth tests; SDK boundary is synthetic, no activation."""
from pathlib import Path
import shutil
import types
import unittest
from uuid import uuid4
from unittest.mock import AsyncMock, patch
from homeassistant.core import HomeAssistant
from homeassistant.components import websocket_api
from client81 import public_trials as trial


class TrialCommandTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.root=Path('/tmp')/('cp-public-ws83-'+uuid4().hex)
        self.root.mkdir()
        self.addCleanup(shutil.rmtree,self.root)
        self.hass=HomeAssistant(str(self.root))
        self.addAsyncCleanup(self.hass.async_stop)
        self.user=types.SimpleNamespace(id='fixture-admin',is_active=True,is_admin=True)
        # A bare native HomeAssistant does not initialize the auth manager.
        # These tests explicitly inject users; they do not exercise OAuth.
        self.hass.auth=types.SimpleNamespace(async_get_user=AsyncMock(return_value=self.user))
        self.results=[];self.errors=[];self.calls=[]
        self.connection=types.SimpleNamespace(user=self.user,
            send_result=lambda i,r:self.results.append((i,r)),
            send_error=lambda *a:self.errors.append(a))
        outer=self
        class Client:
            def activate(self,sku,*,confirmed=False):
                outer.calls.append((sku,confirmed))
                return {'first_activation':True,'claims':{'sku':sku,'phase':'trial_active',
                    'blocks_at':'fixture-deadline','removal_due_at':'fixture-removal',
                    'customer_id':'private-not-returned','nonce':'not-returned'}}
        self.client=Client()
        self.close=trial.register(self.hass,self.client)
        self.addCleanup(self.close)
        self.message={'id':1,'type':trial.COMMAND,'sku':'CP-SOLAR'}

    async def run_command(self):
        await trial.dispatch(self.hass,self.connection,self.message)

    async def test83_explicit_admin_request_returns_minimal_result(self):
        await self.run_command()
        self.assertEqual(self.calls,[('CP-SOLAR',True)])
        self.assertFalse(self.errors)
        self.assertEqual(set(self.results[0][1]),{'first_activation','sku','phase','blocks_at','removal_due_at'})

    async def test83_nonadmin_never_calls_sdk(self):
        self.user.is_admin=False
        await self.run_command()
        self.assertFalse(self.calls);self.assertEqual(len(self.errors),1)

    async def test83_inactive_user_never_calls_sdk(self):
        self.user.is_active=False
        await self.run_command()
        self.assertFalse(self.calls);self.assertTrue(self.errors)

    async def test83_deleted_user_never_calls_sdk(self):
        self.hass.auth.async_get_user.return_value=None
        await self.run_command()
        self.assertFalse(self.calls);self.assertTrue(self.errors)

    async def test83_unknown_sku_never_calls_sdk(self):
        self.message['sku']='CP-OTHER'
        await self.run_command()
        self.assertFalse(self.calls);self.assertTrue(self.errors)

    async def test83_customer_or_profile_override_denied(self):
        self.message['profile']='extended'
        await self.run_command()
        self.assertFalse(self.calls);self.assertTrue(self.errors)

    async def test83_revocation_while_awaiting_withholds_response(self):
        self.hass.auth.async_get_user.side_effect=[self.user,None]
        await self.run_command()
        self.assertEqual(len(self.calls),1)
        self.assertFalse(self.results);self.assertTrue(self.errors)

    async def test83_closed_runtime_never_calls_sdk(self):
        self.close()
        await self.run_command()
        self.assertFalse(self.calls);self.assertTrue(self.errors)

    async def test83_original_schema_and_owned_unload_reload(self):
        registry=self.hass.data[websocket_api.DOMAIN]
        handler,schema=registry[trial.COMMAND]
        self.assertEqual(schema(self.message),self.message)
        self.close()
        self.assertNotIn(trial.COMMAND,registry)
        self.close=trial.register(self.hass,self.client)
        self.assertIn(trial.COMMAND,registry)
        self.close()

    async def test83_foreign_registry_handler_is_preserved(self):
        registry=self.hass.data[websocket_api.DOMAIN]
        self.close()
        foreign=(object(),object());registry[trial.COMMAND]=foreign
        with self.assertRaisesRegex(ValueError,'trial_command_conflict'):
            trial.register(self.hass,self.client)
        self.assertIs(registry[trial.COMMAND],foreign)
        registry.pop(trial.COMMAND)

    async def test83_replaced_handler_not_removed_by_close(self):
        registry=self.hass.data[websocket_api.DOMAIN]
        foreign=(object(),object());registry[trial.COMMAND]=foreign
        self.close()
        self.assertIs(registry[trial.COMMAND],foreign)
        registry.pop(trial.COMMAND)

    async def test83_sdk_failure_has_no_automatic_retry(self):
        with patch.object(self.client,'activate',side_effect=TimeoutError('fixture')) as activate:
            await self.run_command()
            self.assertEqual(activate.call_count,1)
        self.assertFalse(self.results);self.assertTrue(self.errors)

    async def test104_security_not_ready_never_calls_activation(self):
        self.message['sku']='CP-SECURITY'
        await self.run_command()
        self.assertFalse(self.calls);self.assertFalse(self.results)
        self.assertEqual(self.errors[0][1],'trial_module_not_ready')

    async def test104_automation_not_ready_never_calls_activation(self):
        self.message['sku']='CP-AUTOMATION'
        await self.run_command()
        self.assertFalse(self.calls);self.assertFalse(self.results)
        self.assertEqual(self.errors[0][1],'trial_module_not_ready')
