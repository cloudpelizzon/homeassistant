from pathlib import Path
import sys,types,asyncio,json,importlib.util,copy
H=Path(__file__).resolve().parents[2]
for n in ('homeassistant','homeassistant.components','homeassistant.helpers','homeassistant.components.websocket_api','homeassistant.helpers.device_registry','homeassistant.helpers.area_registry','homeassistant.helpers.storage','homeassistant.helpers.entity_registry','voluptuous'):sys.modules[n]=types.ModuleType(n)
class Storage:
 def __init__(self,*a,**k):self.value=None;self.fail=False
 async def async_load(self):return self.value
 async def async_save(self,v):
  if self.fail:raise OSError('fixture write failure')
  self.value=copy.deepcopy(v)
sys.modules['homeassistant.helpers.storage'].Store=Storage
sys.modules['homeassistant.helpers.device_registry'].async_get=lambda h:types.SimpleNamespace(devices={})
sys.modules['homeassistant.helpers.area_registry'].async_get=lambda h:types.SimpleNamespace(areas={})
sys.modules['homeassistant.helpers.entity_registry'].async_get=lambda h:types.SimpleNamespace(entities={})
pkg=types.ModuleType('free_fixture646');pkg.__path__=[str(H/'custom_components/cloudpelizzon')];sys.modules[pkg.__name__]=pkg
s=importlib.util.spec_from_file_location('free_fixture646.free632',H/'custom_components/cloudpelizzon/inventory_free632.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
async def run():
 state=m.LimitedInventory(types.SimpleNamespace());await state.load()
 assert state.capabilities()['mode']=='free' and not state.capabilities()['trial_available']
 for n in range(10):await state.command('device.create',{'device':{'name':'Equipamento de teste '+str(n),'category':'other'}})
 try:await state.command('device.create',{'device':{'name':'Décimo primeiro'}})
 except PermissionError:pass
 else:raise AssertionError('limit bypass')
 assert len(state.assets)==10
 ids=list(state.assets);room={'id':'sala','name':'Sala','width':4,'depth':3}
 draft={'positions':{ids[0]:{'x':250,'y':80}},'links':[{'source':ids[0],'target':ids[1],'medium':'wifi'}],'rooms':[room],'placements':{ids[0]:{'room':'sala','x':20,'y':30}}}
 async def save_map(value,revision=None):return await state.command('free.map.save',{'revision':state.revision if revision is None else revision,'map':value})
 await save_map(draft);assert state.free_map()['map']==draft
 stale=state.revision-1
 for bad,revision in [(draft,stale),({**draft,'rooms':[dict(room,id=str(i)) for i in range(4)]},None),({**draft,'positions':{'foreign':{'x':0,'y':0}}},None),({**draft,'positions':{ids[0]:{'x':float('nan'),'y':0}}},None),({**draft,'links':draft['links']*2},None),({**draft,'placements':{ids[0]:{'room':'foreign','x':0,'y':0}}},None)]:
  before=copy.deepcopy(state.free_map())
  try:await save_map(bad,revision)
  except ValueError:pass
  else:raise AssertionError('invalid manual map accepted')
  assert state.free_map()==before
 restored=m.LimitedInventory(types.SimpleNamespace());restored.store.value=copy.deepcopy(state.store.value);await restored.load();assert restored.free_map()==state.free_map()
 for op in ('scan.start','settings.save','house.save','report','maintenance.rule.save','catalog.model','backup','license.install','documents.upload.start','documents.list'):
  try:await state.command(op,{})
  except PermissionError:pass
  else:raise AssertionError('commercial operation allowed: '+op)
 aid=next(iter(state.assets));await state.command('device.archive',{'id':aid});assert len(state.assets)==9
 assert aid not in state.map['placements'] and not state.map['links'] and aid not in state.map['positions']
 async def revoked():raise PermissionError('revoked')
 try:await state.command('device.create',{'device':{'name':'Denied'}},authorize=revoked)
 except PermissionError:pass
 else:raise AssertionError('revoked session mutated store')
 assert len(state.assets)==9
 state.store.fail=True
 before=copy.deepcopy(state.free_map())
 try:await save_map({**state.map,'rooms':[]})
 except OSError:pass
 else:raise AssertionError('map write failure accepted')
 assert state.free_map()==before
 state.store.fail=True
 try:await state.command('device.create',{'device':{'name':'Unsaved'}})
 except OSError:pass
 else:raise AssertionError('failed write accepted')
 assert len(state.assets)==9

asyncio.run(run())
result={'passed':True,'limit_enforced_in_backend':True,'premium_operations_denied':True,'revoked_actor_denied_before_mutation':True,'failed_writes_rolled_back':True,'no_trial_or_private_engine':True}
print(json.dumps(result))
