"""Actual HA flow/config-entry manager and Store; Fleet HTTP remains synthetic."""
import asyncio
import json
import os
from pathlib import Path
import shutil
import types
import unittest
from uuid import uuid4
from unittest.mock import AsyncMock, patch

from homeassistant import config_entries, loader
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers.storage import Store
from homeassistant.helpers import issue_registry
from client81.config_flow import CloudPelizzonConfigFlow
from client81 import setup as setup81
from client81.adapters.solar.identity import load_identity

HERE=Path(__file__).resolve().parent


class NativeSetupTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.root=HERE/('native-setup81-'+uuid4().hex)
        self.root.mkdir(mode=0o755)
        self.addCleanup(self.cleanup)
        self.hass=HomeAssistant(str(self.root))
        loader.async_setup(self.hass)
        self.hass.config_entries=config_entries.ConfigEntries(self.hass,{})
        await issue_registry.async_load(self.hass)
        await self.hass.config_entries.async_initialize()
        await self.hass.async_start()
        self.addAsyncCleanup(self.hass.async_stop)
        self.posts=[];self.fail=False;self.bad_ack=False
        outer=self
        class Response:
            status=200;headers={'Content-Type':'application/json'}
            @property
            def content(self):return self
            async def read(self,n):
                iid='wrong' if outer.bad_ack else outer.posts[-1]['installation_id']
                return json.dumps({'ok':True,'status':'registered','installation_id':iid}).encode()[:n]
            async def __aenter__(self):
                if outer.fail:raise TimeoutError('synthetic Fleet timeout')
                return self
            async def __aexit__(self,*args):pass
        class Session:
            def post(self,url,**kwargs):
                outer.assertEqual(url,'https://downloads.cloudpelizzon.com.br/fleet-gateway/api/v1/activate')
                outer.assertIs(kwargs['allow_redirects'],False)
                outer.posts.append(dict(kwargs['json']))
                return Response()
        self.owner155=types.SimpleNamespace(is_active=True,is_owner=True,system_generated=False,name='Administrador sintético')
        self.owner_lookup155=AsyncMock(return_value=[self.owner155])
        self.entry_setup=AsyncMock(return_value=True)
        patches=[patch.object(self.hass,'auth',types.SimpleNamespace(async_get_users=self.owner_lookup155),create=True),
                 patch.object(config_entries,'_async_get_flow_handler',AsyncMock(return_value=CloudPelizzonConfigFlow)),
                 patch.object(config_entries,'_support_single_config_entry_only',AsyncMock(return_value=True)),
                 patch.object(self.hass.config_entries,'async_setup',self.entry_setup),
                 patch.object(setup81,'async_get_integration',AsyncMock(return_value=types.SimpleNamespace(version='7.0.0-alpha.3'))),
                 patch.object(setup81,'async_get_clientsession',return_value=Session())]
        for p in patches:p.start();self.addCleanup(p.stop)
    def cleanup(self):
        base=HERE.resolve();root=self.root.resolve()
        assert root!=base and root.is_relative_to(base)
        shutil.rmtree(root,ignore_errors=True)
    async def start(self,data=None):
        return await self.hass.config_entries.flow.async_init('cloudpelizzon',
                context={'source':config_entries.SOURCE_USER},data=data)
    async def finish(self,result,data):
        return await self.hass.config_entries.flow.async_configure(result['flow_id'],user_input=data)
    async def test81_no_consent_no_keys_or_network(self):
        result=await self.start()
        self.assertEqual(result['type'],FlowResultType.FORM)
        self.assertEqual({str(key) for key in result['data_schema'].schema},{'consent'})
        result=await self.finish(result,{'consent':False})
        self.assertEqual(result['errors'],{'base':'consent_required'})
        self.assertEqual(self.posts,[])
        self.assertFalse((self.root/'.storage/cloudpelizzon_edge').exists())
    async def test81_create_entry_in_native_manager_and_private_store(self):
        result=await self.start({'consent':True})
        self.assertEqual(result['type'],FlowResultType.CREATE_ENTRY)
        entries=self.hass.config_entries.async_entries('cloudpelizzon')
        self.assertEqual(len(entries),1)
        self.assertIs(result['result'],entries[0])
        self.assertTrue(entries[0].data['fleet_registered'])
        self.assertEqual(self.posts[-1]['ha_admin_name'],'Administrador sintético')
        self.assertTrue(entries[0].data['fleet_owner_name_consent'])
        self.assertEqual(entries[0].data['fleet_enrollment_schema'],4)
        self.assertNotIn('registration_secret',entries[0].data)
        self.assertEqual(self.entry_setup.await_count,1)
        data=await Store(self.hass,1,'cloudpelizzon_core.data').async_load()
        iid,key=await self.hass.async_add_executor_job(load_identity,self.root/'.storage/cloudpelizzon_edge')
        self.assertNotEqual(data['installation_id'],iid)
        self.assertEqual(data['installation_id'],self.posts[-1]['installation_id'])
        self.assertEqual(len(data['fleet_free_secret']),64)
        for name in ('.storage/cloudpelizzon_edge/installation.pem',
                     '.storage/cloudpelizzon_edge/identity.json',
                     '.cp-trial-phase2-enrollment/installation_private.pem',
                     '.storage/cloudpelizzon_core.data'):
            self.assertEqual((self.root/name).stat().st_mode&0o777,0o600,name)
    async def test81_retry_does_not_rotate_identities(self):
        result=await self.start();self.fail=True
        result=await self.finish(result,{'consent':True})
        self.assertEqual(result['errors'],{'base':'cannot_connect'})
        before={str(p.relative_to(self.root)):p.read_bytes() for p in
            (self.root/'.storage/cloudpelizzon_edge').iterdir() if p.is_file()}
        first=dict(self.posts[-1]);self.fail=False
        result=await self.finish(result,{'consent':True})
        self.assertEqual(result['type'],FlowResultType.CREATE_ENTRY)
        self.assertEqual(first,self.posts[-1])
        after={str(p.relative_to(self.root)):p.read_bytes() for p in
            (self.root/'.storage/cloudpelizzon_edge').iterdir() if p.is_file()}
        self.assertEqual(before,after)
    async def test81_duplicate_entry_denied_by_native_manager(self):
        result=await self.start({'consent':True})
        self.assertEqual(result['type'],FlowResultType.CREATE_ENTRY)
        count=len(self.posts)
        duplicate=await self.start({'consent':True})
        self.assertEqual(duplicate['type'],FlowResultType.ABORT)
        self.assertEqual(len(self.hass.config_entries.async_entries('cloudpelizzon')),1)
        self.assertEqual(len(self.posts),count)
    async def test81_wrong_fleet_identity_cannot_create_entry(self):
        self.bad_ack=True
        result=await self.start({'consent':True})
        self.assertEqual(result['type'],FlowResultType.FORM)
        self.assertEqual(result['errors'],{'base':'registration_rejected'})
        self.assertEqual(self.hass.config_entries.async_entries('cloudpelizzon'),[])
    async def test81_corrupt_core_identity_is_not_overwritten(self):
        store=Store(self.hass,1,'cloudpelizzon_core.data',private=True)
        await store.async_save({'installation_id':'synthetic-invalid-id','preserve':42})
        result=await self.start({'consent':True})
        self.assertEqual(result['errors'],{'base':'identity_invalid'})
        self.assertEqual(self.posts,[])
        self.assertEqual(await store.async_load(),{'installation_id':'synthetic-invalid-id','preserve':42})

    async def test155_missing_owner_stops_before_identity_and_network(self):
        self.owner_lookup155.return_value=[]
        result=await self.start({'consent':True})
        self.assertEqual(result['errors'],{'base':'owner_name_required'})
        self.assertEqual(self.posts,[])
        self.assertFalse((self.root/'.storage/cloudpelizzon_core.data').exists())
    async def test155_empty_owner_name_stops_before_registration(self):
        self.owner155.name=' \n\t '
        result=await self.start({'consent':True})
        self.assertEqual(result['errors'],{'base':'owner_name_required'})
        self.assertEqual(self.posts,[])
    async def test155_lookup_failure_can_retry_with_same_form(self):
        self.owner_lookup155.side_effect=RuntimeError('synthetic lookup unavailable')
        result=await self.start({'consent':True})
        self.assertEqual(result['errors'],{'base':'owner_name_required'})
        self.assertEqual(self.posts,[])
        self.owner_lookup155.side_effect=None
        self.owner155.name='  Nome\n de teste  '
        result=await self.finish(result,{'consent':True})
        self.assertEqual(result['type'],FlowResultType.CREATE_ENTRY)
        self.assertEqual(self.posts[-1]['ha_admin_name'],'Nome de teste')

    async def legacy_entry498(self):
        created=await self.start({'consent':True})
        entry=created['result']
        self.hass.config_entries.async_update_entry(entry,data={},options={'preserve498':{'enabled':False}})
        shutil.rmtree(self.root/'.storage/cloudpelizzon_edge')
        store=Store(self.hass,1,'cloudpelizzon_core.data',private=True)
        saved=await store.async_load()
        saved.update(module_trials={'CP-SOLAR':{'started_at':123,'expires_at':456}},preserve498={'cadastro':'synthetic'})
        await store.async_save(saved)
        return entry,saved

    async def reauth498(self,entry):
        return await self.hass.config_entries.flow.async_init('cloudpelizzon',
            context={'source':config_entries.SOURCE_REAUTH,'entry_id':entry.entry_id},data=dict(entry.data))

    async def test498_legacy_reauth_requires_consent_without_identity_or_network(self):
        entry,saved=await self.legacy_entry498();count=len(self.posts)
        result=await self.reauth498(entry)
        self.assertEqual(result['step_id'],'reauth_confirm')
        result=await self.finish(result,{'consent':False})
        self.assertEqual(result['errors'],{'base':'consent_required'})
        self.assertEqual(len(self.posts),count)
        self.assertFalse((self.root/'.storage/cloudpelizzon_edge').exists())
        self.assertEqual(await Store(self.hass,1,'cloudpelizzon_core.data').async_load(),saved)
        self.assertEqual(dict(entry.data),{})

    async def test498_legacy_reauth_keeps_entry_options_core_trials_and_cadastros(self):
        entry,saved=await self.legacy_entry498();eid=entry.entry_id
        with patch.object(self.hass.config_entries,'async_reload',AsyncMock(return_value=True)) as reload:
            result=await self.reauth498(entry)
            result=await self.finish(result,{'consent':True})
        self.assertEqual(result['type'],FlowResultType.ABORT)
        self.assertEqual(result['reason'],'reauth_successful')
        self.assertIs(self.hass.config_entries.async_get_entry(eid),entry)
        self.assertEqual(len(self.hass.config_entries.async_entries('cloudpelizzon')),1)
        self.assertEqual(entry.options['preserve498'],{'enabled':False})
        self.assertEqual(entry.data['fleet_installation_id'],saved['installation_id'])
        after=await Store(self.hass,1,'cloudpelizzon_core.data').async_load()
        for key,value in saved.items():self.assertEqual(after[key],value)
        reload.assert_awaited_once_with(eid)

    async def test498_missing_legacy_core_cannot_generate_replacement(self):
        entry,saved=await self.legacy_entry498();count=len(self.posts)
        await Store(self.hass,1,'cloudpelizzon_core.data').async_save({})
        result=await self.reauth498(entry)
        result=await self.finish(result,{'consent':True})
        self.assertEqual(result['errors'],{'base':'identity_invalid'})
        self.assertEqual(len(self.posts),count)
        self.assertFalse((self.root/'.storage/cloudpelizzon_edge').exists())
        self.assertEqual(await Store(self.hass,1,'cloudpelizzon_core.data').async_load(),{})

    async def test498_setup_requests_native_reauth_before_runtime_effects(self):
        import client81
        from homeassistant.exceptions import ConfigEntryAuthFailed
        entry,saved=await self.legacy_entry498()
        with patch.object(client81,'Runtime') as runtime:
            with self.assertRaises(ConfigEntryAuthFailed):
                await client81.async_setup_entry(self.hass,entry)
        runtime.assert_not_called()

    async def test498_registration_failure_preserves_legacy_entry_and_can_retry(self):
        entry,saved=await self.legacy_entry498();self.fail=True
        result=await self.reauth498(entry)
        result=await self.finish(result,{'consent':True})
        self.assertEqual(result['errors'],{'base':'cannot_connect'})
        self.assertEqual(dict(entry.data),{})
        before=(self.root/'.storage/cloudpelizzon_edge/installation.pem').read_bytes()
        self.fail=False
        with patch.object(self.hass.config_entries,'async_reload',AsyncMock(return_value=True)):
            result=await self.finish(result,{'consent':True})
        self.assertEqual(result['reason'],'reauth_successful')
        self.assertEqual((self.root/'.storage/cloudpelizzon_edge/installation.pem').read_bytes(),before)
        self.assertEqual(entry.data['fleet_installation_id'],saved['installation_id'])
