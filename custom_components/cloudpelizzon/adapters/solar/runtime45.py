"""Public HA lifecycle/transport. Proprietary Solar rules run on the server."""
import asyncio,json,logging,os,stat,time,uuid
from datetime import timedelta
from pathlib import Path
from homeassistant.core import callback
from homeassistant.helpers.event import async_call_later,async_track_state_change_event,async_track_time_interval
from .identity import load_identity
from .sdk import Client
from .bridge import SolarBridge
from .mirror import SolarMirror
from . import api
from ...operation_gate216 import OperationGate

LOGGER=logging.getLogger(__name__)
READINESS='solar_runtime45.json'

def permissions(folder):
    path=folder/'solar_permissions45.json'
    if not path.exists():return []
    if path.is_symlink():raise ValueError('permission_symlink')
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    with os.fdopen(fd,'rb') as stream:
        info=os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1 or info.st_uid!=os.geteuid() or info.st_mode&0o077 or info.st_size>16384:raise ValueError('permission_file_untrusted')
        row=json.loads(stream.read(16385))
    if not isinstance(row,dict) or set(row)!={'schema','read_entities'} or row['schema']!='cp.solar.permissions.v1':raise ValueError('permission_schema')
    return row['read_entities']

def receipt(folder,data):
    if folder.resolve()!=folder.absolute() or folder.stat().st_uid!=os.geteuid() or folder.stat().st_mode&0o077:raise ValueError('identity_folder_untrusted')
    path=folder/READINESS
    if path.exists():
        info=path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1 or info.st_uid!=os.geteuid() or info.st_mode&0o077:raise ValueError('readiness_file_untrusted')
    temp=folder/('.solar45-'+uuid.uuid4().hex)
    fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        os.fchmod(fd,0o600)
        with os.fdopen(fd,'wb') as stream:stream.write(json.dumps(data,sort_keys=True).encode());stream.flush();os.fsync(stream.fileno())
        os.replace(temp,path)
    finally:temp.unlink(missing_ok=True)

def save_permissions(folder,selected):
    if folder.is_symlink() or folder.resolve()!=folder.absolute():raise ValueError('permission_folder_alias')
    path=folder/'solar_permissions45.json'
    if path.is_symlink():raise ValueError('permission_symlink')
    temp=folder/('.solar-permissions-'+uuid.uuid4().hex)
    fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        with os.fdopen(fd,'w') as stream:
            json.dump({'schema':'cp.solar.permissions.v1','read_entities':selected},stream);stream.flush();os.fsync(stream.fileno())
        os.replace(temp,path)
    finally:temp.unlink(missing_ok=True)

class Controller:
    def __init__(self,hass,entry,iid,client,folder,selected):
        self.hass=hass;self.entry=entry;self.iid=iid;self.folder=folder;self.client=client;self.selected=tuple(selected);self.closed=False
        self.install_gate216=OperationGate()
        self.bridge=SolarBridge.from_client(hass,client,selected)
        async def status():return await hass.async_add_executor_job(client.status)
        self.mirror=SolarMirror(self.bridge,status,schedule=lambda delay,cb:async_call_later(hass,delay,lambda _:cb()))
        self.unload_ws=None;self.removers=[];self.task=None;self.entities={};self.add=None;self.lock=asyncio.Lock();self.last_second=None
        self.boot=uuid.uuid4().hex;self.last_error=None;self.last_success=False;self.sample_lock=asyncio.Lock()
    def close(self):
        if self.closed:return
        self.closed=True;self.mirror.close()
        if self.task and not self.task.done():self.task.cancel()
        for remove in self.removers:remove()
        self.removers=[]
        if self.unload_ws:self.unload_ws();self.unload_ws=None
    async def _record(self):
        data={'schema':'cp.solar.runtime45.v1','boot_id':self.boot,'installation_id':self.iid,
              'closed':self.closed,'read_entity_count':len(self.selected),'sensor_platform_bound':self.add is not None,
              'last_remote_success':self.last_success,'last_error_type':self.last_error,'entity_count':len(self.entities),
              'source':'private_local_HA' if getattr(self.bridge,'_local216',False) else 'private_cloud_gateway','device_commands':0}
        await self.hass.async_add_executor_job(receipt,self.folder,data)
    async def refresh(self):
        async with self.install_gate216.operation():
            return await self._refresh_before216()
    async def _refresh_before216(self):
        async with self.sample_lock:
            if self.closed:raise PermissionError('runtime_closed')
            current=int(self.bridge._clock())
            if self.last_second is not None:
                if current<self.last_second-2:self.mirror.invalidate();raise ValueError('local_clock_regressed')
                if current<=self.last_second:await asyncio.sleep(min(1.1,max(.05,self.last_second+1-self.bridge._clock()+.02)))
            try:
                await self.mirror.refresh();self.last_second=int(self.bridge._clock())
                if self.add is not None:
                    from .sensor import SolarSensor
                    new=[SolarSensor(self.mirror,row) for eid,row in self.mirror.entities.items() if eid not in self.entities]
                    for entity in new:self.entities[entity.entity_id]=entity
                    if new:self.add(new)
                self.last_success=True;self.last_error=None
            except asyncio.CancelledError:raise
            except Exception as error:
                self.last_success=False;self.last_error=type(error).__name__;self.mirror.invalidate();raise
            finally:await self._record()
    def candidates(self):
        # Classification only; vendor discovery/ranking remains on the server.
        result=[]
        for row in self.hass.states.async_all('sensor'):
            unit=str(row.attributes.get('unit_of_measurement','')).lower()
            kind=row.attributes.get('device_class')
            if (kind in ('power','energy') or unit in ('w','kw','mw','wh','kwh','mwh')) and not row.entity_id.startswith(('sensor.cloudpelizzon_','sensor.cp_energy_')):
                result.append(row.entity_id)
        if len(result)>1000:raise ValueError('select_measurements_limit')
        return result
    async def handle(self,command,payload=None,*,admin=False):
        async with self.install_gate216.operation():
            return await self._handle_before216(command,payload,admin=admin)
    async def _handle_before216(self,command,payload=None,*,admin=False):
        if command.endswith('/discover'):
            if admin is not True:raise PermissionError('admin_required')
            candidates=self.candidates();merged={'power':[],'energy':[],'suggestions':{}}
            for index in range(0,max(1,len(candidates)),100):
                temporary=SolarBridge.from_client(self.hass,self.client,candidates[index:index+100])
                try:result=await temporary.handle(command,payload,admin=admin)
                finally:temporary.close()
                merged['power'].extend(result['power']);merged['energy'].extend(result['energy'])
                merged['suggestions'].update(result.get('suggestions',{}))
            return merged
        if command.endswith('/config/save'):
            if admin is not True:raise PermissionError('admin_required')
            config=json.loads((payload or {}).get('config_json','{}'))
            available=set(self.candidates());chosen=set()
            def collect(value):
                if isinstance(value,str) and value in available:chosen.add(value)
                elif isinstance(value,dict):
                    for item in value.values():collect(item)
                elif isinstance(value,list):
                    for item in value:collect(item)
            collect(config)
            temporary=SolarBridge.from_client(self.hass,self.client,sorted(chosen))
            try:result=await temporary.handle(command,payload,admin=admin)
            finally:temporary.close()
            await self.hass.async_add_executor_job(save_permissions,self.folder,sorted(chosen))
            self.selected=tuple(sorted(chosen));self.bridge._approved_read_entities[:]=self.selected
            self.watch()
            try:await self.refresh()
            except Exception:LOGGER.warning('Solar configuration saved; remote measurements temporarily unavailable')
            return result
        return await self.bridge.handle(command,payload,admin=admin)
    def watch(self):
        for remove in self.removers:remove()
        self.removers=[]
        if self.add is not None and self.selected:
            self.removers.append(async_track_state_change_event(self.hass,list(self.selected),self.schedule))
            self.removers.append(async_track_time_interval(self.hass,self.schedule,timedelta(seconds=3)))
    @callback
    def schedule(self,*_):
        if self.closed or self.install_gate216.paused or self.task and not self.task.done():return
        async def run():
            # Coalesce sensor bursts; only the latest snapshot is evaluated.
            now=self.bridge._clock()
            delay=max(0,3-(now-getattr(self,'_last_poll229',now-3)))
            if delay:await asyncio.sleep(delay)
            self._last_poll229=self.bridge._clock()
            try:await self.refresh()
            except asyncio.CancelledError:raise
            except Exception:LOGGER.warning('Solar remote measurements unavailable; local values invalidated')
        self.task=self.hass.async_create_background_task(run(),'cloudpelizzon-solar-remote45')
    def bind(self,add_entities):
        if self.add is not None:raise ValueError('sensor_platform_already_bound')
        self.add=add_entities
        # No implicit device reading: only the explicit local permission list.
        self.watch()

async def async_setup_runtime(hass,entry):
    folder=Path(hass.config.path('.storage/cloudpelizzon_edge')).absolute()
    iid,key=await hass.async_add_executor_job(load_identity,folder)
    selected=await hass.async_add_executor_job(permissions,folder)
    controller=Controller(hass,entry,iid,Client(iid,key),folder,selected)
    try:
        controller.unload_ws=api.register(hass,controller)
        entry.async_on_unload(controller.close)
        await controller._record()
    except BaseException:controller.close();raise
    return {'entry_id':entry.entry_id,'sku':'CP-SOLAR','version':'1.0.0','remote_controller':controller,'manager':controller}
