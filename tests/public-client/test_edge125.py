import asyncio,copy,threading,unittest
from datetime import datetime,timedelta,timezone
from client81.public_automation.edge124 import Edge,policy

class SDK:
    def __init__(self):self.calls=[];self.responses=[];self.effects_rows=[];self.hook=None
    def worker_session(self,args,**kw):
        self.calls.append(('session',copy.deepcopy(args),threading.get_ident()))
        if self.hook:self.hook()
        return {'prepared':True,'policy':args['policy'],'trial_started':False} if args['action']=='prepare' else {'closed':True}
    def worker_poll(self,args,**kw):
        self.calls.append(('poll',copy.deepcopy(args),threading.get_ident()))
        return self.responses.pop(0) if self.responses else {'connected':True,'proof_requests':[],'faults':[]}
    def authorize_native(self,args,**kw):self.calls.append(('proof',args,threading.get_ident()));return {'receipt':{'synthetic':True}}
    def effects(self,args,**kw):
        self.calls.append(('effects',args,threading.get_ident()))
        if args.get('stage')=='confirm':
            expires=(datetime.now(timezone.utc)+timedelta(seconds=5)).isoformat()
            return {'expires_at':expires,'receipt':{'claims':{'expires_at':expires}}}
        return {'commands':self.effects_rows}

class Relay:
    def __init__(self,gateway,service):self.service=service;self.gateway=gateway
    async def deliver(self,descriptor):
        await self.gateway({'stage':'confirm'},'a'*32)
        await self.service('light.turn_on',{'entity_id':'light.synthetic'})
        return {'outcome':'success','acknowledged':True}

class EdgeTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.sdk=SDK();self.options={'reads':[],'targets':[]};self.calls=[];self.reads=[]
        async def service(domain,name,data):self.calls.append((domain,name,data,threading.get_ident()))
        def snapshot(reads):self.reads.append(reads);return {name:{'state':'off','attributes':{}} for name in reads}
        def save(value):self.options=copy.deepcopy(value)
        self.edge=Edge(self.sdk,executor=asyncio.to_thread,snapshot=snapshot,read_policy=lambda:self.options,save_policy=save,
            service=service,relay_factory=lambda targets,gateway,service:Relay(gateway,service))
    async def asyncTearDown(self):self.edge.close()
    async def test_prepare_never_calls_trial_activation_or_device_service(self):
        await self.edge.prepare();self.assertEqual([r[0] for r in self.sdk.calls],['session']);self.assertFalse(self.calls)
    async def test_new_permissions_require_explicit_confirmation(self):
        with self.assertRaises(PermissionError):await self.edge.prepare(new_policy={'reads':['sensor.a'],'targets':[]})
        self.assertFalse(self.sdk.calls);self.assertFalse(self.reads)
    async def test_authorization_rechecked_after_network_before_local_consent(self):
        valid=True
        def revoke():
            nonlocal valid
            valid=False
        self.sdk.hook=revoke
        with self.assertRaises(PermissionError):await self.edge.prepare(new_policy={'reads':[],'targets':['light.synthetic']},confirmed=True,authorized=lambda:valid)
        self.assertEqual(self.options,{'reads':[],'targets':[]});self.assertFalse(self.edge.connected)
    async def test_unapproved_states_are_never_read(self):
        await self.edge.prepare(new_policy={'reads':['sensor.a'],'targets':[]},confirmed=True)
        self.assertEqual(self.reads,[['sensor.a']])
    async def test_synchronous_sdk_runs_off_event_loop(self):
        await self.edge.prepare();await self.edge.cycle()
        self.assertTrue(all(row[2]!=threading.get_ident() for row in self.sdk.calls))
    async def test_proof_handoff_is_answered_before_next_poll(self):
        self.sdk.responses=[{'connected':True,'proof_requests':[{'ticket':'a'*32,'args':{'synthetic':True},'request_id':'b'*32}],'faults':[]}]
        await self.edge.cycle();self.assertEqual([row[0] for row in self.sdk.calls],['poll','proof','poll'])
        self.assertEqual(self.sdk.calls[-1][1]['proof_responses'][0]['receipt'],{'synthetic':True})
    async def test_delivery_returns_to_HA_event_loop(self):
        await self.edge.prepare(new_policy={'reads':[],'targets':['light.synthetic']},confirmed=True)
        self.sdk.effects_rows=[{'synthetic':True}];await self.edge.cycle()
        self.assertEqual(self.calls,[('light','turn_on',{'entity_id':'light.synthetic'},threading.get_ident())])
    async def test_permission_change_invalidates_old_delivery(self):
        await self.edge.prepare(new_policy={'reads':[],'targets':['light.synthetic']},confirmed=True)
        token=self.edge.generation;approved=copy.deepcopy(self.options);await self.edge.cycle()
        await self.edge.prepare(new_policy={'reads':[],'targets':[]},confirmed=True)
        with self.assertRaises(PermissionError):await self.edge.dispatch(token,approved,'light.turn_on',{'entity_id':'light.synthetic'})
        self.assertFalse(self.calls)
    async def test_runtime_close_invalidates_pending_device_dispatch(self):
        token=self.edge.generation;self.edge.close()
        with self.assertRaises(PermissionError):await self.edge.dispatch(token,self.options,'light.turn_on',{'entity_id':'light.synthetic'})
        self.assertFalse(self.calls)
    async def test_receipt_expired_while_waiting_for_HA_loop_cannot_dispatch(self):
        await self.edge.prepare(new_policy={'reads':[],'targets':['light.synthetic']},confirmed=True)
        await self.edge.cycle()
        with self.assertRaisesRegex(PermissionError,'grant_expired'):
            await self.edge.dispatch(self.edge.generation,self.options,'light.turn_on',{'entity_id':'light.synthetic'},datetime.now(timezone.utc)-timedelta(seconds=1))
        self.assertFalse(self.calls)
    async def test_empty_targets_never_requests_delivery_queue(self):
        await self.edge.prepare();await self.edge.cycle();self.assertNotIn('effects',[r[0] for r in self.sdk.calls])
    async def test_native_failure_prevents_delivery(self):
        self.sdk.responses=[{'connected':True,'proof_requests':[],'faults':['synthetic timeout']}]
        with self.assertRaises(PermissionError):await self.edge.cycle()
        self.assertFalse(self.calls)
    async def test_arbitrary_service_permission_is_rejected(self):
        with self.assertRaises(ValueError):policy({'reads':[],'targets':['lock.front']})

if __name__=='__main__':unittest.main()
