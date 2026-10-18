"""Public candidate transport for the original Security API; no local engine."""
import copy,functools,json,uuid
ALIASES={'seguranca_armar_parcial': {'operation': 'security.alarm.arm_home', 'reason': 'Armamento parcial solicitado'}, 'seguranca_armar_total': {'operation': 'security.alarm.arm_away', 'reason': 'Armamento total solicitado'}, 'seguranca_desarmar': {'operation': 'security.alarm.disarm', 'reason': 'Desarme solicitado'}, 'seguranca_disparar': {'operation': 'security.alarm.trigger', 'reason': 'Violação de segurança'}, 'seguranca_panico': {'operation': 'security.alarm.panic', 'reason': 'Pânico manual'}, 'security_arm_home': {'operation': 'security.alarm.arm_home', 'reason': 'Armamento parcial solicitado'}, 'security_arm_away': {'operation': 'security.alarm.arm_away', 'reason': 'Armamento total solicitado'}, 'security_disarm': {'operation': 'security.alarm.disarm', 'reason': 'Desarme solicitado'}, 'security_trigger': {'operation': 'security.alarm.trigger', 'reason': 'Violação de segurança'}, 'security_panic': {'operation': 'security.alarm.panic', 'reason': 'Pânico manual'}}

def detached(value):
    raw=json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)
    if len(raw.encode())>48000:raise ValueError('security_payload_limit')
    return json.loads(raw)

class SecurityBridge:
    def __init__(self,execute,*,shadow_control=False):
        self.execute=execute;self.shadow_control=shadow_control is True;self.closed=False
    @classmethod
    def from_client(cls,hass,client,*,shadow_control=False):
        async def execute(op,args,rid):
            return await hass.async_add_executor_job(functools.partial(client.execute,'CP-SECURITY',op,args,request_id=rid))
        return cls(execute,shadow_control=shadow_control)
    async def handle(self,action,payload=None,*,authenticated=False,admin=False,request_id=None):
        if self.closed or authenticated is not True:raise PermissionError('security_session_required')
        if payload is None:payload={}
        if not isinstance(payload,dict):raise ValueError('security_payload_object_required')
        args=detached(payload)
        if action in ('configuration.get','dashboard.get'):
            if args:raise ValueError('unexpected_arguments')
            operation='security.config.read' if action=='configuration.get' else 'security.dashboard.read'
        elif action=='configuration.set':
            if admin is not True:raise PermissionError('security_admin_required')
            operation='security.config.write';args={'changes':args}
        elif action in ALIASES:
            if admin is not True:raise PermissionError('security_admin_required')
            if not self.shadow_control:raise PermissionError('shadow_control_opt_in_required')
            spec=ALIASES[action];operation=spec['operation']
            allowed={'motivo','origem'}|({'imediato'} if operation=='security.alarm.trigger' else set())
            if set(args)-allowed:raise ValueError('unexpected_arguments')
            if 'imediato' in args and type(args['imediato']) is not bool:raise ValueError('invalid_immediate')
            args={'reason':args.get('motivo',spec['reason']),'source':args.get('origem','homeassistant'),
                **({'immediate':args.get('imediato',False)} if operation=='security.alarm.trigger' else {})}
        else:raise ValueError('unsupported_security_action')
        response=await self.execute(operation,args,request_id or uuid.uuid4().hex)
        if self.closed:raise PermissionError('security_runtime_closed')
        if not isinstance(response,dict):raise ValueError('invalid_private_response')
        return detached(response)
    def close(self):self.closed=True
