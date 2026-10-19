"""Native HA wiring for the public signed state/relay transport."""
import json,os,stat
from pathlib import Path
from ..homolog_mirror.policy import deny_read_only_targets
from .edge124 import Edge,policy
from ..adapters.automation.lib.cloudpelizzon_relay import RelayClient

def create(hass,entry,context):
    def current():
        if hass.config_entries.async_get_entry(entry.entry_id) is not entry:raise PermissionError('entry_changed')
        return entry
    def read():return policy(dict(current().options.get('automation_runtime124',{'reads':[],'targets':[]})))
    def save(value):
        found=current();hass.config_entries.async_update_entry(found,options={**found.options,'automation_runtime124':value})
    def snapshot(entities):
        current();result={}
        for entity in entities:
            value=hass.states.get(entity)
            if value is None:continue
            row={'state':value.state,'attributes':{k:v for k,v in value.attributes.items() if k not in ('access_token','entity_picture','password','token','api_key')}}
            # Unsupported attributes are omitted, never serialized as Python repr.
            try:raw=json.dumps(row,allow_nan=False)
            except (TypeError,ValueError):row['attributes']={};raw=json.dumps(row,allow_nan=False)
            if len(raw.encode())>8192:raise ValueError('entity_snapshot_limit')
            result[entity]=row
        return result
    async def service(domain,name,data):
        current();deny_read_only_targets(hass,data)
        from ..homolog_mirror.source132 import forward
        if await forward(hass,domain,name,data):return
        await hass.services.async_call(domain,name,data,blocking=True)
    folder=Path(hass.config.path('.storage/cloudpelizzon_relay124')).absolute()
    def relay(targets,gateway,call_service):
        # Called only from the executor; never block HA's event loop on SQLite.
        if folder.resolve()!=folder or folder.is_symlink():raise ValueError('relay_folder_alias')
        folder.mkdir(mode=0o755 if os.name=='nt' else 0o700,parents=True,exist_ok=True)
        info=folder.stat()
        if os.name=='posix' and (info.st_uid!=os.geteuid() or info.st_mode&0o077):raise ValueError('relay_folder_permissions')
        return RelayClient(context['trial_id'],folder/'automation.sqlite3',allowed_entities=targets,gateway=gateway,call_service=call_service)
    edge=Edge(context['client'],executor=hass.async_add_executor_job,snapshot=snapshot,read_policy=read,save_policy=save,service=service,relay_factory=relay)
    edge.start(lambda coro:hass.async_create_background_task(coro,'CloudPelizzon automation connection'))
    return edge
