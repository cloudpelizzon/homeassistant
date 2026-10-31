"""Read-only lifecycle observations; no HA, customer data or live requests."""
import asyncio
from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path
import sys
import types
import unittest

ROOT = Path(sys.argv.pop(1)).resolve()
PACKAGE = 'tracking591_fixture'
for name in (PACKAGE, PACKAGE+'.public_core'):
    module = types.ModuleType(name)
    module.__path__ = []
    sys.modules[name] = module


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


metadata = load(PACKAGE+'.public_core.metadata', ROOT/'public_core/metadata.py')
load(PACKAGE+'.public_core.projection', ROOT/'public_core/projection.py')
tracking = load(PACKAGE+'.module_tracking591', ROOT/'module_tracking591.py')


def claim():
    now = datetime.now(timezone.utc)
    return {'schema':'cp.r16.lifecycle.signed.v1', 'installation_id':'trial-fixture',
            'nonce':'not-exported', 'issued_at':now.isoformat(),
            'expires_at':(now+timedelta(seconds=5)).isoformat(),
            'modules':{sku:{'phase':'not_started', 'paid_confirmed':False,
                            'blocks_at':None, 'removal_due_at':None}
                       for sku in metadata.MODULES}}


class Tests(unittest.IsolatedAsyncioTestCase):
    def hass(self):
        return types.SimpleNamespace(config_entries=types.SimpleNamespace(
            async_entries=lambda:[types.SimpleNamespace(domain='cloudpelizzon_solar')]))

    async def test_all_catalog_modules_separate_installed_and_trial(self):
        value=claim()
        async def fetch():return value
        result=await tracking.collect(self.hass(), {'trial_id':'trial-fixture','fetch_verified':fetch})
        self.assertEqual({r['sku'] for r in result['modules']}, set(metadata.MODULES))
        solar=next(r for r in result['modules'] if r['sku']=='CP-SOLAR')
        self.assertTrue(solar['installed']);self.assertEqual(solar['phase'],'not_started')
        self.assertNotIn('activated_at',str(result));self.assertNotIn('nonce',str(result))
        self.assertTrue(result['status_verified'])

    async def test_exact_identity_and_invalid_signature_transport_are_unknown(self):
        for kind in ('mismatch','error','expired'):
            async def fetch():
                if kind=='error':raise PermissionError('status_not_verified')
                value=claim()
                if kind=='mismatch':value['installation_id']='someone-else'
                if kind=='expired':value['expires_at']='2020-01-01T00:00:00Z'
                return value
            result=await tracking.collect(self.hass(),{'trial_id':'trial-fixture','fetch_verified':fetch})
            self.assertFalse(result['status_verified'])
            self.assertTrue(all(r['phase']=='unknown' and r['blocks_at'] is None for r in result['modules']))

    async def test_authority_deadlines_preserved_and_no_start_inferred(self):
        value=claim();deadline=(datetime.now(timezone.utc)+timedelta(days=2)).isoformat()
        value['modules']['CP-SOLAR'].update(phase='trial_active',blocks_at=deadline)
        async def fetch():return value
        result=await tracking.collect(self.hass(),{'trial_id':'trial-fixture','fetch_verified':fetch})
        self.assertEqual(next(r for r in result['modules'] if r['sku']=='CP-SOLAR')['blocks_at'],deadline)

    async def test_cancellation_propagates(self):
        async def fetch():raise asyncio.CancelledError()
        with self.assertRaises(asyncio.CancelledError):
            await tracking.collect(self.hass(),{'trial_id':'trial-fixture','fetch_verified':fetch})


if __name__=='__main__':unittest.main()
