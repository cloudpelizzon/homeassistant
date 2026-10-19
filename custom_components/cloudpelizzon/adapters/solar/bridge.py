"""Public Solar UI transport. No discovery heuristics, integration or energy math.

The execution callback must be the publisher's authenticated Gateway Client.
This module is not a licensing authority and never starts a trial.
"""
import asyncio
from datetime import datetime,timezone
import functools,json,re,time,uuid

COMMANDS={
    'cloudpelizzon/energy/status':'solar.dashboard.read',
    'cloudpelizzon/energy/config/get':'solar.config.read',
    'cloudpelizzon/energy/discover':'solar.entities.discover',
    'cloudpelizzon/energy/config/save':'solar.config.write',
}
ATTRIBUTES=frozenset({'device_class','unit_of_measurement','state_class','friendly_name'})

def detached(value):
    raw=json.dumps(value,ensure_ascii=False,allow_nan=False,separators=(',',':'))
    if len(raw.encode())>49152:raise ValueError('public_request_limit')
    return json.loads(raw)

def unique(pairs):
    result={}
    for key,value in pairs:
        if key in result:raise ValueError('duplicate_config_field')
        result[key]=value
    return result

class SolarBridge:
    def __init__(self,execute,snapshot,*,clock=time.time):
        self._execute=execute;self._snapshot=snapshot;self._clock=clock;self._lock=asyncio.Lock();self.closed=False

    @classmethod
    def from_client(cls,hass,client,read_entities):
        if (not isinstance(read_entities,(tuple,list)) or len(read_entities)>1000
            or len(set(read_entities))!=len(read_entities)
            or any(not isinstance(e,str) or not re.fullmatch(r'sensor\.[a-z0-9_]+',e) for e in read_entities)):
            raise ValueError('explicit_measurement_allowlist_required')
        approved=list(read_entities)
        def snapshot():
            result={}
            for eid in approved:
                row=hass.states.get(eid)
                if row is not None:
                    result[eid]={'state':row.state,'attributes':{k:v for k,v in row.attributes.items() if k in ATTRIBUTES}}
            return detached(result)
        async def execute(operation,args,request_id):
            call=functools.partial(client.execute,'CP-SOLAR',operation,args,request_id=request_id)
            return await hass.async_add_executor_job(call)
        bridge=cls(execute,snapshot);bridge._approved_read_entities=approved
        return bridge

    def close(self):self.closed=True

    async def _request(self,operation,extra=None):
        if self.closed:raise PermissionError('adapter_unloaded')
        values=self._snapshot()
        if not isinstance(values,dict):raise ValueError('snapshot_invalid')
        args=detached({'states':values,'observed_at':int(self._clock()),**(extra or {})})
        result=await self._execute(operation,args,uuid.uuid4().hex)
        if self.closed:raise PermissionError('adapter_unloaded')
        if not isinstance(result,dict):raise ValueError('server_response_invalid')
        return detached(result)

    async def handle(self,command,payload=None,*,admin=False):
        if command not in COMMANDS:raise PermissionError('unsupported_solar_command')
        payload={} if payload is None else detached(payload)
        expected={'config_json'} if command.endswith('/config/save') else set()
        if not isinstance(payload,dict) or set(payload)!=expected:raise ValueError('solar_payload_invalid')
        if command.endswith(('/discover','/config/save')) and admin is not True:raise PermissionError('admin_required')
        extra=None
        if expected:
            text=payload['config_json']
            if not isinstance(text,str) or len(text.encode())>32768:raise ValueError('config_json_invalid')
            config=json.loads(text,object_pairs_hook=unique,parse_constant=lambda _:(_ for _ in ()).throw(ValueError('nonfinite_config')))
            if not isinstance(config,dict):raise ValueError('config_object_required')
            from .config_validation import validate_measurement_bindings
            validate_measurement_bindings(config)
            extra={'config':config}
        async with self._lock:
            result=await self._request(COMMANDS[command],extra)
            if command.endswith('/config/save'):
                return {'ok':True,'reload_required':True,'config':result}
            if command.endswith('/status'):
                if result.get('sku')!='CP-SOLAR' or not isinstance(result.get('health'),dict):raise ValueError('solar_status_invalid')
                # Presentation after authenticated operation success, never a grant.
                return {**result,'version':'1.0.0','license':{'allowed':True,'sku':'CP-SOLAR','status':'online_authorized'}}
            if command.endswith('/config/get') and (not isinstance(result.get('config'),dict) or not isinstance(result.get('normalized_entities'),dict)):
                raise ValueError('solar_config_invalid')
            if command.endswith('/discover') and (not isinstance(result.get('power'),list) or not isinstance(result.get('energy'),list)):
                raise ValueError('solar_discovery_invalid')
            return result

    async def evaluate(self):
        async with self._lock:
            result=await self._request('solar.sensors.evaluate')
            if not isinstance(result.get('metrics'),dict):raise ValueError('solar_metrics_invalid')
            return result
