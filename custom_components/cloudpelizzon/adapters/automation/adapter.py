"""Thin HA adapter. Network, signing and SQLite stay off the HA event loop."""
import asyncio,functools,hashlib,json,re,uuid
from .const import checked_options,PREFIXES,AUTOMATION_MANAGEMENT
from .lib.cloudpelizzon_client import ClientError
from .lib.cloudpelizzon_relay import RelayClient

class AdapterError(Exception):pass

def detached(value):return json.loads(json.dumps(value,sort_keys=True,ensure_ascii=False,allow_nan=False))

class Adapter:
    @classmethod
    async def async_create(cls,hass,iid,client,folder,options,*,relay_factory=RelayClient):
        self=cls();self.hass=hass;self.iid=iid;self.client=client;self.options=checked_options(dict(options))
        self.closed=False;self.lock=asyncio.Lock();self.context=None
        database=folder/('relay-'+hashlib.sha256(iid.encode()).hexdigest()+'.sqlite3')
        create=functools.partial(relay_factory,iid,database,allowed_entities=self.options['allowed_entities'],gateway=self._gateway,call_service=self._call_ha)
        self.relay=await hass.async_add_executor_job(create)
        return self

    def close(self):self.closed=True

    def snapshot(self):
        # Only explicitly selected entities and these measurement attributes leave HA.
        values={}
        for entity in self.options['read_entities']:
            item=self.hass.states.get(entity)
            if item is not None:
                attributes={k:item.attributes[k] for k in ('device_class','unit_of_measurement','state_class') if k in item.attributes}
                values[entity]={'state':item.state,'attributes':detached(attributes)}
        return values

    def _sync(self,method,*args,**kwargs):
        if self.closed:raise AdapterError('client_unloaded')
        return getattr(self.client,method)(*args,**kwargs)

    async def _gateway(self,args,rid):
        # Called only within the private executor loop used by RelayClient.deliver.
        return self._sync('effects',args,request_id=rid)

    async def _call_ha(self,service,data):
        future=asyncio.run_coroutine_threadsafe(self._dispatch_ha(service,data),self.hass.loop)
        await asyncio.wrap_future(future)

    async def _dispatch_ha(self,service,data):
        if self.closed or not self.options['delivery_enabled']:raise AdapterError('delivery_disabled')
        from .lib.cloudpelizzon_relay.protocol import SAFE
        if service not in SAFE:raise AdapterError('service_not_allowed')
        targets=data.get('entity_id');targets=[targets] if isinstance(targets,str) else targets
        if (not isinstance(targets,list) or not targets or any(e not in self.options['allowed_entities'] for e in targets)):
            raise AdapterError('target_not_allowed')
        for entity in targets:
            state=self.hass.states.get(entity)
            if state is None or state.state in ('unknown','unavailable'):raise AdapterError('target_unavailable')
        domain,name=service.split('.')
        if not self.hass.services.has_service(domain,name):raise AdapterError('service_unavailable')
        await self.hass.services.async_call(domain,name,detached(data),blocking=True,context=self.context)

    async def _http(self,method,*args,**kwargs):
        return await self.hass.async_add_executor_job(functools.partial(self._sync,method,*args,**kwargs))

    async def action(self,name,data,context=None):
        async with self.lock:
            if self.closed:raise AdapterError('client_unloaded')
            data=detached(data);rid=data.get('request_id') or uuid.uuid4().hex
            if not isinstance(rid,str) or not re.fullmatch('[A-Za-z0-9_-]{16,128}',rid):raise AdapterError('request_id_invalid')
            self.context=context
            try:
                if name=='status':return await self._http('status')
                if name=='request':
                    sku=data['sku'];op=data['operation']
                    if (sku not in PREFIXES or not isinstance(op,str) or not op.startswith(PREFIXES[sku])
                        or sku=='CP-AUTOMATION' and op not in AUTOMATION_MANAGEMENT):raise AdapterError('unsupported_operation')
                    return await self._http('execute',sku,op,data.get('args',{}),request_id=rid)
                if name=='preview':
                    args={'preview_only':True,'code':data['code'],'revision':data['revision'],'states':self.snapshot(),
                        'input':data.get('input',{'kind':'manual','variables':{}}),'allowed_entities':self.options['allowed_entities']}
                    return await self._http('preview',args,request_id=rid)
                if name=='run_manual':
                    if not self.options['delivery_enabled']:raise AdapterError('delivery_disabled')
                    args={'code':data['code'],'revision':data['revision'],'states':self.snapshot(),
                        'variables':data.get('variables',{}),'execution_mode':'manual'}
                    # Enqueue only; delivery requires a separate deliberate deliver_pending action.
                    return await self._http('run_manual',args,request_id=rid)
                if name=='deliver_pending':
                    if not self.options['delivery_enabled']:raise AdapterError('delivery_disabled')
                    packet=await self._http('effects',{'stage':'pending'},request_id=rid)
                    if (not isinstance(packet,dict) or set(packet)!={'commands'} or not isinstance(packet['commands'],list)
                        or len(packet['commands'])>20):raise AdapterError('pending_response_invalid')
                    results=[]
                    for item in packet['commands']:
                        if self.closed:raise AdapterError('client_unloaded')
                        # All relay SQLite/signature checks run in this worker thread.
                        result=await self.hass.async_add_executor_job(lambda:asyncio.run(self.relay.deliver(item)))
                        results.append(result)
                    return {'results':results}
                raise AdapterError('unsupported_action')
            except asyncio.CancelledError:
                # The executor may still receive an in-flight HTTP response.
                # Pause delivery until reload so it cannot dispatch without its actor context.
                if name=='deliver_pending':self.closed=True
                raise
            except AdapterError:raise
            except (ClientError,PermissionError):raise AdapterError('cloud_denied_or_unavailable') from None
            except Exception:raise AdapterError('request_failed_or_inconclusive') from None
            finally:self.context=None
