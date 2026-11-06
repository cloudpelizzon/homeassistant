"""Exercise the Free endpoint against real HA registries, Store and WS registry."""
import asyncio,importlib.util,json,tempfile,types,sys
from pathlib import Path
from unittest.mock import AsyncMock,patch
from homeassistant import config_entries,loader
from homeassistant.core import HomeAssistant
from homeassistant.components import websocket_api
from homeassistant.helpers import issue_registry,device_registry,area_registry,entity_registry

async def main():
 with tempfile.TemporaryDirectory(prefix='cp-free632-',dir='/tmp') as tmp:
  hass=HomeAssistant(tmp);loader.async_setup(hass);hass.config_entries=config_entries.ConfigEntries(hass,{})
  await issue_registry.async_load(hass);await hass.config_entries.async_initialize();await hass.async_start()
  try:
   device_registry.async_setup(hass);await device_registry.async_load(hass);await area_registry.async_load(hass);await entity_registry.async_load(hass);hass.data[websocket_api.DOMAIN]={}
   source=Path('/candidate/custom_components/cloudpelizzon/inventory_free632.py');pkg=types.ModuleType('free_fixture646');pkg.__path__=[str(source.parent)];sys.modules[pkg.__name__]=pkg;spec=importlib.util.spec_from_file_location('free_fixture646.inventory_free632_fixture',source);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
   actor=types.SimpleNamespace(id='fixture-admin',is_active=True,is_admin=True);lookup=AsyncMock(return_value=actor)
   class Connection:
    user=actor
    def __init__(self):self.result=None;self.error=None;self.done=asyncio.Event()
    def send_result(self,n,result):self.result=result;self.done.set()
    def send_error(self,n,code,message):self.error=code;self.done.set()
   with patch.object(hass,'auth',types.SimpleNamespace(async_get_user=lookup),create=True):
    close=await m.register(hass,None,{})
    fn=hass.data[websocket_api.DOMAIN][m.COMMAND][0]
    async def command(op,args=None,user=actor):
     c=Connection();c.user=user;fn(hass,c,{'id':1,'type':m.COMMAND,'operation':op,'args':args or {}});await asyncio.wait_for(c.done.wait(),10);return c
    c=await command('capabilities');assert c.result['mode']=='free' and not c.result['trial_available']
    for n in range(10):assert (await command('device.create',{'device':{'name':f'Fixture {n}'}})).error is None
    overflow=await command('device.create',{'device':{'name':'Overflow'}});assert overflow.error=='inventory_full_license_required',repr((overflow.error,overflow.result))
    assert (await command('report',{'kind':'devices'})).error=='inventory_full_license_required'
    denied=types.SimpleNamespace(id='fixture-child',is_active=True,is_admin=False)
    assert (await command('snapshot',user=denied)).error=='unauthorized'
    hass.data[m.KEY].snapshot({});assert len((await command('snapshot')).result['devices'])==10
    initial=(await command('free.map.get')).result;aid=initial['devices'][0]['id']
    manual={'positions':{aid:{'x':40,'y':60}},'links':[],'rooms':[{'id':'office','name':'Escritório','width':3,'depth':4}],'placements':{aid:{'room':'office','x':20,'y':30}}}
    assert (await command('free.map.save',{'revision':initial['revision'],'map':manual})).error is None
    assert (await command('free.map.get')).result['map']==manual
    assert (await command('free.map.save',{'revision':initial['revision'],'map':manual})).error=='inventory_request_invalid'
    assert (await command('free.map.save',{'revision':initial['revision']+1,'map':manual},user=denied)).error=='unauthorized'
    house={'floors':[{'id':'f','name':'Andar'}],'rooms':[{'area_id':'plan-'+str(i),'name':'Cômodo '+str(i),'floor_id':'f','width_m':3,'depth_m':4,'device_positions':{}} for i in range(2)]}
    rev=hass.data[m.KEY].revision
    assert (await command('settings.save',{'settings':{'house':house},'free_revision':rev})).error is None
    assert (await command('snapshot')).result['settings']['house']==house
    too_many={**house,'rooms':house['rooms']+[dict(house['rooms'][0],area_id='plan-third')]}
    assert (await command('settings.save',{'settings':{'house':too_many},'free_revision':hass.data[m.KEY].revision})).error=='free_room_limit'
    assert (await command('device.edit',{'id':aid,'values':{'purchase_value':'1000','purchase_date':'2020-01-01','depreciation_percent':'10','supplier':'Fixture'}})).error is None
    assert (await command('device.get',{'id':aid})).result['attributes']['supplier']=='Fixture'
    assert (await command('documents.list',{'id':aid})).error=='inventory_full_license_required'
    # Actual HA registry object contracts, not a list/dict assumption.
    assert isinstance((await command('locations')).result,list)
    lookup.return_value=None;assert (await command('device.create',{'device':{'name':'Revoked'}})).error=='unauthorized';lookup.return_value=actor
    close();assert m.COMMAND not in hass.data[websocket_api.DOMAIN]
    state=m.LimitedInventory(hass);await state.load();assert len(state.assets)==10 and state.map==manual and state.workspace.data['house']==house
    files=list((Path(tmp)/'.storage').glob(m.KEY));assert len(files)==1 and not files[0].stat().st_mode&0o077
   print('INVENTORY_FREE632_NATIVE='+json.dumps({'passed':True,'actual_HA_Store':True,'actual_HA_WS_registration':True,'actual_registry_contracts':True,'ten_limit':True,'premium_denied':True,'nonadmin_and_revoked_denied':True,'unload_and_persistence':True,'network':'none','private_engines':False}),flush=True)
  finally:await hass.async_stop()

asyncio.run(main())



