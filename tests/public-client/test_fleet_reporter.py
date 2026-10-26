"""Lifecycle and consent tests with a synthetic HTTP boundary; no live requests."""
import asyncio
import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest

ROOT = Path(sys.argv.pop(1)).resolve()
PACKAGE = 'fixture_fleet101'
for name in ('homeassistant', 'homeassistant.helpers', PACKAGE, PACKAGE+'.public_onboarding'):
    module = types.ModuleType(name)
    module.__path__ = []
    sys.modules[name] = module
for name in ('homeassistant.core', 'homeassistant.helpers.start', 'homeassistant.const', 'homeassistant.helpers.aiohttp_client',
             'homeassistant.helpers.event', 'homeassistant.helpers.storage', 'homeassistant.loader'):
    sys.modules[name] = types.ModuleType(name)
sys.modules['homeassistant.core'].callback=lambda fn:fn
def at_started(hass,fn):
    fn(hass)
    return lambda:None
sys.modules['homeassistant.helpers.start'].async_at_started=at_started
sys.modules['homeassistant.const'].__version__ = '2026.10.2'
sys.modules['homeassistant.helpers.aiohttp_client'].async_get_clientsession = lambda hass: hass.session
sys.modules['homeassistant.helpers.event'].async_track_time_interval = lambda hass, cb, interval: hass.track(cb, interval)
class Store:
    def __init__(self, hass, *args, **kwargs): self.hass = hass
    async def async_load(self): return self.hass.saved
    async def async_save(self,value): self.hass.delivery_status=value
sys.modules['homeassistant.helpers.storage'].Store = Store
async def integration(hass, domain): return types.SimpleNamespace(version='7.0.0-alpha.14')
sys.modules['homeassistant.loader'].async_get_integration = integration
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module
load(PACKAGE+'.public_onboarding.protocol', ROOT/'public_onboarding/protocol.py')
load(PACKAGE+'.owner_profile155', ROOT/'owner_profile155.py')
reporter = load(PACKAGE+'.fleet_reporter', ROOT/'fleet_reporter.py')

class Response:
    status = 200
    headers = {'Content-Type': 'application/json'}
    def __init__(self, hass): self.hass = hass; self.content = self
    async def read(self, limit):
        return json.dumps({'ok': True, 'status': 'registered', 'installation_id': 'a'*32}).encode()
    async def __aenter__(self):
        if self.hass.fail: raise OSError('synthetic_failure')
        await self.hass.gate.wait()
        return self
    async def __aexit__(self, *args): pass
class Hass:
    def __init__(self):
        self.saved = {'installation_id':'a'*32, 'fleet_free_secret':'b'*64, 'unrelated':'preserved'}
        self.requests = []; self.tasks = []; self.unsubscribed = False; self.fail = False
        self.gate = asyncio.Event(); self.gate.set(); self.session = self
    def post(self, url, **kwargs): self.requests.append((url, kwargs)); return Response(self)
    def track(self, cb, interval):
        self.tick = cb
        assert interval.total_seconds() == 60
        return lambda: setattr(self, 'unsubscribed', True)
    def async_create_task(self, coro, name):
        task = asyncio.create_task(coro); self.tasks.append(task); return task
def entry(**changes):
    data = dict(fleet_reporting_consent=True, fleet_registered=True,
                fleet_registration_mode='free', fleet_installation_id='a'*32)
    data.update(changes)
    return types.SimpleNamespace(data=data)

class Tests(unittest.IsolatedAsyncioTestCase):
    async def test_current_version_on_start_and_periodic_checkin(self):
        hass = Hass(); saved = dict(hass.saved); close = reporter.start(hass, entry())
        await hass.tasks[-1]; hass.tick(); await hass.tasks[-1]
        self.assertEqual(len(hass.requests), 2)
        payload = hass.requests[0][1]['json']
        self.assertEqual(payload['cloudpelizzon_version'], '7.0.0-alpha.14')
        self.assertEqual(payload['registration_secret'], 'b'*64)
        self.assertEqual(hass.saved, saved)
        self.assertNotIn('ha_admin_name', payload)
        self.assertFalse(hass.requests[0][1]['allow_redirects']); close()
    async def test_name_checkin_requires_recorded_owner_name_consent(self):
        hass=Hass()
        owner=types.SimpleNamespace(is_active=True,is_owner=True,system_generated=False,name='Nome de teste')
        async def users():return [owner]
        hass.auth=types.SimpleNamespace(async_get_users=users)
        close=reporter.start(hass,entry(fleet_owner_name_consent=True))
        await hass.tasks[-1]
        self.assertEqual(hass.requests[-1][1]['json']['ha_admin_name'],'Nome de teste')
        owner.name='Nome atualizado';hass.tick();await hass.tasks[-1]
        self.assertEqual(hass.requests[-1][1]['json']['ha_admin_name'],'Nome atualizado');close()
    async def test_no_consent_no_requests_or_timer(self):
        for value in (False, None, 'true'):
            hass = Hass(); reporter.start(hass, entry(fleet_reporting_consent=value))()
            self.assertFalse(hass.tasks); self.assertFalse(hasattr(hass, 'tick'))
    async def test_missing_or_mismatched_identity_never_recreated(self):
        for saved in ({}, {'installation_id':'c'*32, 'fleet_free_secret':'b'*64}):
            hass = Hass(); hass.saved = dict(saved); close = reporter.start(hass, entry())
            await hass.tasks[-1]; close()
            self.assertEqual(hass.saved, saved); self.assertFalse(hass.requests)
    async def test_failure_retries_without_breaking_startup(self):
        hass = Hass(); hass.fail = True; close = reporter.start(hass, entry())
        await hass.tasks[-1]; hass.fail = False; hass.tick(); await hass.tasks[-1]
        self.assertEqual(len(hass.requests), 2); close()
    async def test_no_overlapping_requests_and_unload_cancels(self):
        hass = Hass(); hass.gate.clear(); close = reporter.start(hass, entry())
        await asyncio.sleep(0); hass.tick(); self.assertEqual(len(hass.tasks), 1)
        close()
        with self.assertRaises(asyncio.CancelledError): await hass.tasks[-1]
        hass.tick(); self.assertEqual(len(hass.tasks), 1); self.assertTrue(hass.unsubscribed)

if __name__ == '__main__': unittest.main()
