"""Public Security-engine management transport. No catalog or rule execution."""
import functools,json,uuid
READ='cloudpelizzon/security/engines/list'
UPDATE='cloudpelizzon/security/engines/update'
CONTRACTS={READ:'security.engines.read',UPDATE:'security.engines.update'}
def detached(value,limit=12288):
    if type(value) is not dict:raise ValueError('object_required')
    raw=json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
    if len(raw)>limit:raise ValueError('payload_limit')
    return json.loads(raw)
class EngineBridge:
    def __init__(self,execute):self.execute=execute;self.closed=False
    @classmethod
    def from_client(cls,hass,client):
        async def execute(op,args,rid):
            return await hass.async_add_executor_job(functools.partial(client.execute,'CP-SECURITY',op,args,request_id=rid))
        return cls(execute)
    async def handle(self,command,args=None,*,active=False,admin=False):
        if self.closed or active is not True:raise PermissionError('active_session_required')
        if command not in CONTRACTS:raise ValueError('command_denied')
        args=detached({} if args is None else args)
        if command==READ:
            if args:raise ValueError('unexpected_arguments')
        else:
            if admin is not True:raise PermissionError('administrator_required')
            if args.keys()-{'code','enabled','config'} or type(args.get('code')) is not str or not 1<=len(args['code'])<=32:raise ValueError('invalid_update')
            if not {'enabled','config'}&args.keys():raise ValueError('empty_update')
            if 'enabled' in args and type(args['enabled']) is not bool:raise ValueError('invalid_enabled')
            if 'config' in args and type(args['config']) is not dict:raise ValueError('invalid_config')
        result=await self.execute(CONTRACTS[command],args,uuid.uuid4().hex)
        if self.closed:raise PermissionError('transport_unloaded')
        result=detached(result,limit=60000)
        if set(result)!={'version','engines','global','events'} or type(result['engines']) is not list:raise ValueError('invalid_response')
        return result
    def close(self):self.closed=True
