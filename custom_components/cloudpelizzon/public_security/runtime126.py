"""Native HA wiring for the public signed state/relay transport."""
import json,os,stat
from pathlib import Path
from ..homolog_mirror.policy import deny_read_only_targets
from .edge126 import Edge,policy
from .relay126 import RelayClient

def create(hass,entry,context):
    def current():
        if hass.config_entries.async_get_entry(entry.entry_id) is not entry:raise PermissionError('entry_changed')
        return entry
    def read():return policy(dict(current().options.get('security_runtime126',{'reads':[],'effects':[],'notification':None})))
    def save(value):
        found=current();hass.config_entries.async_update_entry(found,options={**found.options,'security_runtime126':value})
    def snapshot(entities):
        current();result={}
        for entity in entities:
            value=hass.states.get(entity)
            if value is None:continue
            row={'state':value.state,'attributes':{k:v for k,v in value.attributes.items() if k in ('device_class','friendly_name','entity_id')}}
            if entity.startswith(('person.','device_tracker.','binary_sensor.')):
                from datetime import datetime,timezone
                stamp=value.attributes.get('mirror_observation_timestamp')
                mirrored=value.attributes.get('mirror_source')=='production_observer'
                try:reported=datetime.fromisoformat(stamp.replace('Z','+00:00')) if stamp else getattr(value,'last_reported',value.last_updated);age=(datetime.now(timezone.utc)-reported).total_seconds()
                except (ValueError,TypeError,AttributeError):age=999999
                if age<0 or mirrored and not stamp:age=999999
                row['attributes']['observation_age_seconds']=str(max(0,min(age,999999)))
            if 'entity_id' in row['attributes']:row['attributes']['entity_id']=[e for e in row['attributes']['entity_id'] if e in entities]
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
    folder=Path(hass.config.path('.storage/cloudpelizzon_relay126')).absolute()
    def relay(targets,gateway,call_service):
        # Called only from the executor; never block HA's event loop on SQLite.
        if folder.resolve()!=folder or folder.is_symlink():raise ValueError('relay_folder_alias')
        folder.mkdir(mode=0o755 if os.name=='nt' else 0o700,parents=True,exist_ok=True)
        info=folder.stat()
        if os.name=='posix' and (info.st_uid!=os.geteuid() or info.st_mode&0o077):raise ValueError('relay_folder_permissions')
        return RelayClient(context['trial_id'],folder/'security.sqlite3',allowed_entities=targets,gateway=gateway,call_service=call_service)
    # Read-only refresh of approved mirrored presence entities. HA may report
    # an unchanged home/not_home state without emitting state_changed.
    observed={'at':0.,'ids':()}
    async def refresh_observations(approved):
        import asyncio,time
        ids=tuple(eid for eid in approved['reads'] if eid.startswith(('person.','device_tracker.')) and hass.states.get(eid) and hass.states.get(eid).attributes.get('mirror_source')=='production_observer')
        if not ids or observed['ids']==ids and time.monotonic()-observed['at']<30:return
        from ..homolog_mirror.source132 import observer,source_state
        try:mirror=observer(hass)
        except PermissionError:return
        slots=asyncio.Semaphore(3)
        async def read(eid):
            async with slots:
                try:row=await source_state(mirror,eid)
                except (OSError,ValueError,PermissionError,TimeoutError):return
                current();mirror.apply(row)
        await asyncio.gather(*(read(eid) for eid in ids))
        observed.update(at=time.monotonic(),ids=ids)
    edge=Edge(context['client'],executor=hass.async_add_executor_job,snapshot=snapshot,read_policy=read,save_policy=save,service=service,relay_factory=relay,before_snapshot=refresh_observations)
    edge.start(lambda coro:hass.async_create_background_task(coro,'CloudPelizzon security connection'))
    return edge
