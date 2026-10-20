"""Real HA command registration, synthetic HTTP only; never sends sales email."""
import asyncio
import json
from pathlib import Path
import shutil
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from homeassistant.core import HomeAssistant
from homeassistant.components import websocket_api
from client81 import commercial as commercial


class CommercialTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.root = Path('/tmp')/('cp-commercial157-'+uuid4().hex)
        self.root.mkdir()
        self.addCleanup(shutil.rmtree, self.root)
        self.hass = HomeAssistant(str(self.root))
        self.addAsyncCleanup(self.hass.async_stop)
        self.user = SimpleNamespace(id='synthetic-user', is_active=True)
        self.hass.auth = SimpleNamespace(async_get_user=AsyncMock(return_value=self.user))
        self.results, self.errors, self.posts = [], [], []
        self.connection = SimpleNamespace(user=self.user,
            send_result=lambda *args:self.results.append(args), send_error=lambda *args:self.errors.append(args))
        self.msg = {'id':1,'type':commercial.COMMAND,'sku':'CP-SOLAR','name':'Synthetic',
                    'phone':'0000000000','email':'synthetic@example.invalid','subject':'Synthetic test','message':'No real contact'}
        self.ack = {'ok':True,'status':'registered','sku':'CP-SOLAR','request_id':'REQ-012345ABCDEF',
                    'email_status':'sent','dolibarr_status':'linked_existing','whatsapp_url':'https://wa.me/55000000000?text=test'}
        self.status = 201
        self.close = commercial.register(self.hass, 'a'*32)
        self.addCleanup(self.close)
        self.saved = {'installation_id':'a'*32,'fleet_free_secret':'b'*64}
        owner = self
        class Response:
            headers = {'Content-Type':'application/json'}
            @property
            def status(self):return owner.status
            @property
            def content(self):return self
            async def read(self, size):return json.dumps(owner.ack).encode()[:size]
            async def __aenter__(self):return self
            async def __aexit__(self,*args):return False
        class Session:
            def post(self,url,**kwargs):
                owner.posts.append((url,kwargs))
                return Response()
        for context in (
            patch.object(commercial.Store,'async_load',AsyncMock(side_effect=lambda:self.saved)),
            patch.object(commercial,'async_get_integration',AsyncMock(return_value=SimpleNamespace(version='fixture'))),
            patch.object(commercial,'async_get_clientsession',return_value=Session()),
        ):
            context.start();self.addCleanup(context.stop)

    async def run_command(self):
        await commercial.dispatch(self.hass,self.connection,self.msg)

    async def test_registered_schema_and_expired_module_can_contact(self):
        registry=self.hass.data[websocket_api.DOMAIN]
        self.assertEqual(registry[commercial.COMMAND][1](self.msg),self.msg)
        # No status bridge / trial ledger exists in this fixture.
        await self.run_command()
        self.assertFalse(self.errors);self.assertEqual(self.results[0][1]['request_id'],'REQ-012345ABCDEF')
        url,args=self.posts[0]
        self.assertEqual(url,commercial.URL);self.assertFalse(args['allow_redirects'])
        self.assertEqual(args['json']['installation_id'],'a'*32)
        self.assertEqual(args['json']['registration_secret'],'b'*64)
        self.assertNotIn('registration_secret',self.results[0][1])

    async def test_unknown_sku_empty_and_oversized_never_send(self):
        for field,value in (('sku','unknown'),('message',''),('name','x'*161)):
            original=self.msg[field];self.msg[field]=value
            await self.run_command();self.msg[field]=original
        self.assertFalse(self.posts);self.assertEqual(len(self.errors),3)

    async def test_client_cannot_override_identity(self):
        self.msg['installation_id']='c'*32
        await self.run_command();self.assertFalse(self.posts)

    async def test_inactive_deleted_and_missing_session_never_send(self):
        self.user.is_active=False;await self.run_command()
        self.user.is_active=True;self.hass.auth.async_get_user.return_value=None
        await self.run_command()
        self.connection.user=None;await self.run_command()
        self.assertFalse(self.posts);self.assertFalse(self.results)

    async def test_missing_or_mismatched_saved_identity_never_send(self):
        for saved in (None,{'installation_id':'c'*32,'fleet_free_secret':'b'*64}):
            self.saved=saved;await self.run_command()
        self.assertFalse(self.posts)

    async def test_rejected_or_missing_protocol_never_claims_success(self):
        self.status=403;await self.run_command()
        self.status=201;self.ack.pop('request_id');await self.run_command()
        self.assertEqual(len(self.posts),2);self.assertFalse(self.results)
        self.assertFalse(self.hass.data[commercial.KEY]['busy'])

    async def test_email_failure_keeps_registered_receipt_and_blocks_unsafe_url(self):
        self.ack.update(email_status='failed',whatsapp_url='javascript:alert(1)',private_secret='not-public')
        await self.run_command()
        result=self.results[0][1]
        self.assertEqual(result['email_status'],'failed');self.assertNotIn('whatsapp_url',result)
        self.assertNotIn('private_secret',result)

    async def test_busy_duplicate_does_not_send(self):
        self.hass.data[commercial.KEY]['busy']=True
        await self.run_command()
        self.assertFalse(self.posts);self.assertEqual(self.errors[0][1],'commercial_busy')

    async def test_unload_and_foreign_handler_preserved(self):
        registry=self.hass.data[websocket_api.DOMAIN]
        self.close();self.assertNotIn(commercial.COMMAND,registry)
        foreign=(object(),object());registry[commercial.COMMAND]=foreign
        self.close();self.assertIs(registry[commercial.COMMAND],foreign)
        with self.assertRaises(ValueError):commercial.register(self.hass,'a'*32)
        await self.run_command();self.assertFalse(self.posts)

    async def test_cancelled_request_propagates_without_retry(self):
        with patch.object(commercial.Store,'async_load',side_effect=asyncio.CancelledError):
            with self.assertRaises(asyncio.CancelledError):await self.run_command()
        self.assertFalse(self.posts);self.assertFalse(self.hass.data[commercial.KEY]['busy'])
