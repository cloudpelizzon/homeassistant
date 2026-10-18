"""Native HA Store/provision/SDK signing; enrollment HTTP boundary is synthetic."""
import json,shutil,types,unittest,uuid
from pathlib import Path
from unittest.mock import patch
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from client81 import enrollment106
from client81.provision import provision
from client81.adapters.solar.identity import load_identity
from client81.adapters.solar.sdk import Client
from client81.public_onboarding.protocol import canonical

class NativeEnrollmentTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.root=Path('/tmp')/('cp-enrollment106-'+uuid.uuid4().hex);self.root.mkdir()
        self.addCleanup(shutil.rmtree,self.root)
        self.hass=HomeAssistant(str(self.root));self.addAsyncCleanup(self.hass.async_stop)
        self.iid=uuid.uuid4().hex
        self.store=Store(self.hass,1,'cloudpelizzon_core.data',private=True,atomic_writes=True)
        await self.store.async_save({'installation_id':self.iid,'fleet_free_secret':'b'*64,'unrelated':42})
        await self.hass.async_add_executor_job(provision,self.root)
        trial_id,key=await self.hass.async_add_executor_job(load_identity,self.root/'.storage/cloudpelizzon_edge')
        self.context={'core_id':self.iid,'trial_id':trial_id,'client':Client(trial_id,key)}
        self.entry=types.SimpleNamespace(data={'fleet_registered':True,'fleet_reporting_consent':True,'fleet_installation_id':self.iid})
        self.posts=[];self.status=200;self.started=False;outer=self
        class Response:
            headers={'Content-Type':'application/json'}
            @property
            def status(self):return outer.status
            @property
            def content(self):return self
            async def read(self,size):return json.dumps({'ok':True,'installation_id':outer.iid,'portal_registered':True,'trial_identity_registered':True,'trial_started':outer.started}).encode()
            async def __aenter__(self):return self
            async def __aexit__(self,*args):pass
        class Session:
            def post(self,url,**kwargs):
                outer.assertEqual(url,'https://api.cloudpelizzon.com.br/v1/installation/enroll')
                outer.assertFalse(kwargs['allow_redirects']);outer.posts.append(kwargs['json']);return Response()
        self.patch=patch.object(enrollment106,'async_get_clientsession',return_value=Session());self.patch.start();self.addCleanup(self.patch.stop)
    async def test106_dual_proof_preserves_store_and_separate_identities(self):
        saved=await self.store.async_load()
        self.assertTrue(await enrollment106.ensure(self.hass,self.entry,self.context))
        self.assertEqual(await self.store.async_load(),saved)
        body=self.posts[0];claim=body['claim']
        self.assertNotEqual(claim['portal_public_key_hex'],claim['trial_public_key_hex'])
        for signature,pub,prefix in [('portal_signature','portal_public_key_hex',b'CP-PORTAL-ENROLL106\n'),('trial_signature','trial_public_key_hex',b'CP-TRIAL-ENROLL106\n')]:
            Ed25519PublicKey.from_public_bytes(bytes.fromhex(claim[pub])).verify(bytes.fromhex(body[signature]),prefix+canonical(claim))
        self.assertEqual(body['registration_secret'],'b'*64)
    async def test106_missing_consent_never_posts(self):
        self.entry.data['fleet_reporting_consent']=False
        with self.assertRaises(PermissionError):await enrollment106.ensure(self.hass,self.entry,self.context)
        self.assertFalse(self.posts)
    async def test106_wrong_core_store_never_posts_or_rotates(self):
        await self.store.async_save({'installation_id':'c'*32,'fleet_free_secret':'b'*64})
        with self.assertRaises(PermissionError):await enrollment106.ensure(self.hass,self.entry,self.context)
        self.assertFalse(self.posts)
    async def test106_denied_enrollment_has_no_activation_fallback(self):
        self.status=403
        with self.assertRaises(PermissionError):await enrollment106.ensure(self.hass,self.entry,self.context)
        self.assertEqual(len(self.posts),1)
    async def test106_ack_cannot_claim_automatic_trial_start(self):
        self.started=True
        with self.assertRaises(PermissionError):await enrollment106.ensure(self.hass,self.entry,self.context)

