"""Explicit admin permission and per-rule activation commands; no local engine."""
from .editor import Bridge as EditorBridge
from .bridge import CODE,STATUS
ACTIVATE='cloudpelizzon/automation/activate'
DEACTIVATE='cloudpelizzon/automation/deactivate'
PERMISSIONS='cloudpelizzon/automation/permissions'
APPROVE='cloudpelizzon/automation/permissions/save'
CONTRACTS=frozenset((ACTIVATE,DEACTIVATE,PERMISSIONS,APPROVE))

class Bridge(EditorBridge):
    def connect(self,edge):self.edge=edge
    def close(self):
        super().close()
        if hasattr(self,'edge'):self.edge.close()
    async def handle(self,command,args,*,authorized):
        self.check(authorized)
        if command not in CONTRACTS:
            value=await super().handle(command,args,authorized=authorized)
            if command==STATUS:value.update(execution_available=self.edge.connected,execution_error=self.edge.fault)
            return value
        expected={ACTIVATE:{'code','revision'},DEACTIVATE:{'code','revision'},PERMISSIONS:set(),APPROVE:{'policy','confirmed'}}
        if type(args) is not dict or set(args)!=expected[command]:raise ValueError('arguments_invalid')
        if command==PERMISSIONS:return {'policy':self.edge.check(),'connected':self.edge.connected,'fault':self.edge.fault}
        if command==APPROVE:
            if args['confirmed'] is not True:raise PermissionError('explicit_consent_required')
            return await self.edge.prepare(new_policy=args['policy'],confirmed=True,authorized=authorized)
        if type(args['code']) is not str or not CODE.fullmatch(args['code']) or type(args['revision']) is not int or args['revision']<1:raise ValueError('rule_identity')
        async with self.lock:
            if command==ACTIVATE:
                await self.edge.prepare(authorized=authorized);self.check(authorized)
            value=await self.request('automation.rules.activate' if command==ACTIVATE else 'automation.rules.deactivate',args,authorized)
            if value.get('code')!=args['code'] or value.get('revision')!=args['revision'] or value.get('active') is not (command==ACTIVATE):raise PermissionError('activation_response_binding')
            self.edge.refresh_status=True
            return value
