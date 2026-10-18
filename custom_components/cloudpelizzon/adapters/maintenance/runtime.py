"""Public Maintenance lifecycle: HTTPS transport, no local engine or storage."""
import asyncio
from pathlib import Path
from .identity import load_identity
from .sdk import Client
from .bridge import MaintenanceBridge,VERSION
from .journal import receipt
from . import api, voice, notifications
class Controller:
    def __init__(self,hass,entry,iid,client,folder):
        self.hass=hass;self.entry=entry;self.iid=iid;self.client=client;self.folder=folder
        self.bridge=MaintenanceBridge.from_client(hass,client);self.closed=False;self.unload_ws=None;self.unload_voice=None;self.notifications=None
        self.status_validated=False;self.last_allowed=False;self.last_error=None;self.runtime=None
    async def record(self):
        data={'schema':'cp.maintenance.runtime56.v1','installation_id':self.iid,'entry_id':self.entry.entry_id,
            'source':'private_cloud_gateway','closed':self.closed,'signed_status_validated':self.status_validated,
            'last_operation_allowed':self.last_allowed,'last_error_type':self.last_error,
            'local_store_opened':False,'history_read_enabled':False,'notification_delivery_enabled':bool(self.notifications and self.notifications.enabled),'delivery_calls_attempted':self.notifications.delivery_attempts if self.notifications else 0}
        await self.hass.async_add_executor_job(receipt,self.folder,data)
    async def handle(self,command,payload=None,*,admin=False):
        if self.closed:raise PermissionError('maintenance_runtime_closed')
        try:
            result=await (self.notifications.handle(command,payload,admin=admin) if self.notifications and command.startswith(notifications.PREFIX) else self.bridge.handle(command,payload,admin=admin));self.last_allowed=result.get('allowed',True) is not False;self.last_error=None;return result
        except asyncio.CancelledError:raise
        except Exception as error:self.last_allowed=False;self.last_error=type(error).__name__;raise
        finally:await self.record()
    async def probe(self):
        # Status is verified for diagnostics only; execution needs a separate
        # fresh capability and proof. A denial/outage never starts a local fallback.
        try:
            await self.hass.async_add_executor_job(self.client.status);self.status_validated=True
            await self.handle('cloudpelizzon/maintenance/get_state')
        except asyncio.CancelledError:raise
        except Exception as error:self.last_allowed=False;self.last_error=type(error).__name__;await self.record()
    def close(self):
        if self.closed:return
        self.closed=True;self.bridge.close()
        if self.notifications:self.notifications.close()
        if self.unload_voice:self.unload_voice();self.unload_voice=None
        if self.unload_ws:self.unload_ws();self.unload_ws=None;self.unload_voice=None
        if self.runtime is not None:
            for key in ('cloudpelizzon_maintenance',):
                if self.hass.data.get(key) is self.runtime:self.hass.data.pop(key,None)
            platform=self.hass.data.get('cloudpelizzon',{})
            if isinstance(platform,dict) and platform.get('maintenance') is self.runtime:platform.pop('maintenance',None)
async def async_setup_runtime(hass,entry):
    platform=hass.data.get('cloudpelizzon',{})
    if not isinstance(platform,dict) or not isinstance(platform.get('core'),dict):raise RuntimeError('core_unavailable')
    folder=Path(hass.config.path('.storage/cloudpelizzon_edge')).absolute()
    iid,key=await hass.async_add_executor_job(load_identity,folder)
    controller=Controller(hass,entry,iid,Client(iid,key),folder)
    try:
        controller.unload_ws=api.register(hass,controller)
        controller.unload_voice=voice.register(hass,controller.client)
        controller.notifications=await notifications.create(hass,entry,iid,controller.client,folder,controller.bridge)
        runtime={entry.entry_id:{'sku':'CP-MAINTENANCE','version':VERSION,'remote_controller':controller,'notification_engine':controller.notifications}}
        controller.runtime=runtime;entry.async_on_unload(controller.close)
        await controller.probe()
        await controller.notifications.async_start()
    except BaseException:controller.close();raise
    return runtime
