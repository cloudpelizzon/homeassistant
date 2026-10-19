import asyncio,importlib.util,sys,unittest
from datetime import datetime,timedelta,timezone
from pathlib import Path
spec=importlib.util.spec_from_file_location('mirror143',Path(sys.argv.pop(1))/'adapters/solar/mirror.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class MirrorTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.now=datetime(2026,10,19,tzinfo=timezone.utc);self.tick=0.;self.callbacks=[];self.cancelled=[];self.fail=False;self.during=None
        owner=self
        class Bridge:
            async def evaluate(self):
                if owner.during:owner.during()
                if owner.fail:raise PermissionError('synthetic_denial')
                return {'entities':[{'entity_id':'sensor.cloudpelizzon_energy_fixture','unique_id':'cp_energy_fixture','name':'Fixture','icon':'mdi:flash','kind':'power','value':100,'attributes':{'module':'CP-SOLAR'}}]}
            def close(self):pass
        async def status():return {'issued_at':self.now.isoformat(),'expires_at':(self.now+timedelta(seconds=5)).isoformat(),'modules':{'CP-SOLAR':{'phase':'licensed','paid_confirmed':True}}}
        def schedule(delay,cb):
            self.callbacks.append(cb);index=len(self.callbacks)-1
            return lambda:self.cancelled.append(index)
        self.m=mod.SolarMirror(Bridge(),status,clock=lambda:self.now,monotonic=lambda:self.tick,schedule=schedule)
    async def test_refresh_keeps_still_valid_row(self):
        await self.m.refresh();self.now+=timedelta(seconds=2);self.tick+=2
        self.during=lambda:self.assertIsNotNone(self.m.row('sensor.cloudpelizzon_energy_fixture'))
        await self.m.refresh();self.assertIn(0,self.cancelled)
    async def test_old_expiry_cannot_invalidate_new_receipt(self):
        await self.m.refresh();self.now+=timedelta(seconds=2);self.tick+=2;await self.m.refresh()
        self.callbacks[0]();self.assertTrue(self.m.valid());self.callbacks[1]();self.assertFalse(self.m.valid())
    async def test_failure_invalidates_immediately(self):
        await self.m.refresh();self.fail=True
        with self.assertRaises(PermissionError):await self.m.refresh()
        self.assertFalse(self.m.valid())
    async def test_no_extension_of_original_deadline(self):
        await self.m.refresh();self.now+=timedelta(seconds=5);self.tick+=5
        self.assertFalse(self.m.valid());self.assertIsNone(self.m.row('sensor.cloudpelizzon_energy_fixture'))
if __name__=='__main__':unittest.main()
