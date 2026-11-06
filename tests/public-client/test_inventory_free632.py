from pathlib import Path
import sys,types,asyncio,json,importlib.util,copy
H=Path(__file__).resolve().parents[2]
for n in ('homeassistant','homeassistant.components','homeassistant.helpers','homeassistant.components.websocket_api','homeassistant.helpers.device_registry','homeassistant.helpers.area_registry','homeassistant.helpers.storage','voluptuous'):sys.modules[n]=types.ModuleType(n)
class Storage:
 def __init__(self,*a,**k):self.value=None;self.fail=False
 async def async_load(self):return self.value
 async def async_save(self,v):
  if self.fail:raise OSError('fixture write failure')
  self.value=copy.deepcopy(v)
sys.modules['homeassistant.helpers.storage'].Store=Storage
sys.modules['homeassistant.helpers.device_registry'].async_get=lambda h:types.SimpleNamespace(devices={})
sys.modules['homeassistant.helpers.area_registry'].async_get=lambda h:types.SimpleNamespace(areas={})
s=importlib.util.spec_from_file_location('free632',H/'custom_components/cloudpelizzon/inventory_free632.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
async def run():
 state=m.LimitedInventory(types.SimpleNamespace());await state.load()
 assert state.capabilities()['mode']=='free' and not state.capabilities()['trial_available']
 for n in range(10):await state.command('device.create',{'device':{'name':'Equipamento de teste '+str(n),'category':'other'}})
 try:await state.command('device.create',{'device':{'name':'Décimo primeiro'}})
 except PermissionError:pass
 else:raise AssertionError('limit bypass')
 assert len(state.assets)==10
 for op in ('scan.start','settings.save','map.link','house.save','report','maintenance.rule.save','catalog.model','backup','license.install'):
  try:await state.command(op,{})
  except PermissionError:pass
  else:raise AssertionError('commercial operation allowed: '+op)
 aid=next(iter(state.assets));await state.command('device.archive',{'id':aid});assert len(state.assets)==9
 async def revoked():raise PermissionError('revoked')
 try:await state.command('device.create',{'device':{'name':'Denied'}},authorize=revoked)
 except PermissionError:pass
 else:raise AssertionError('revoked session mutated store')
 assert len(state.assets)==9
 state.store.fail=True
 try:await state.command('device.create',{'device':{'name':'Unsaved'}})
 except OSError:pass
 else:raise AssertionError('failed write accepted')
 assert len(state.assets)==9

asyncio.run(run())
result={'passed':True,'limit_enforced_in_backend':True,'premium_operations_denied':True,'revoked_actor_denied_before_mutation':True,'failed_writes_rolled_back':True,'no_trial_or_private_engine':True}
print(json.dumps(result))
