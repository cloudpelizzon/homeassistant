"""Public Security transport lifecycle, deadlines and explicit consent."""
import asyncio,copy,threading,unittest
from datetime import datetime,timedelta,timezone
from client81.public_security.edge126 import Edge
from client81.public_security.wire126 import policy

EMPTY={'reads':[],'effects':[],'notification':None}
ALLOW={'reads':['binary_sensor.synthetic'],'effects':[['cover','open_cover','cover.synthetic']],'notification':None}

class SDK:
 def __init__(self):self.calls=[];self.hook=None;self.rows=[];self.shadow=False
 def security_session(self,args,**kwargs):
  self.calls.append(('session',copy.deepcopy(args),threading.get_ident()))
  if self.hook:self.hook()
  return {'prepared':True,'policy':args['policy'],'trial_started':False} if args['action']=='prepare' else {'closed':True}
 def security(self,action,args,**kwargs):
  self.calls.append((action,copy.deepcopy(args),threading.get_ident()))
  if action=='feed':return {'connected':True,'faults':[],'shadow_mode':self.shadow}
  if action=='manual':return {'queued':['a'*32],'physical_execution_authorized':False}
  if args.get('stage')=='confirm':
   expiry=(datetime.now(timezone.utc)+timedelta(seconds=5)).isoformat()
   return {'expires_at':expiry,'receipt':{'claims':{'expires_at':expiry}}}
  return {'commands':self.rows}

class Relay:
 def __init__(self,network,service):self.network=network;self.service=service
 async def deliver(self,descriptor):
  await self.network({'stage':'confirm'},'b'*32)
  await self.service('cover.open_cover',{'entity_id':'cover.synthetic'})
  return {'outcome':'success','acknowledged':True}

class SecurityEdgeTests(unittest.IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  self.sdk=SDK();self.options=copy.deepcopy(EMPTY);self.calls=[];self.reads=[]
  def snapshot(rows):self.reads.append(rows);return {name:{'state':'off'} for name in rows}
  def save(value):self.options=copy.deepcopy(value)
  async def service(domain,name,data):self.calls.append((domain,name,data,threading.get_ident()))
  self.edge=Edge(self.sdk,executor=asyncio.to_thread,snapshot=snapshot,read_policy=lambda:self.options,save_policy=save,
   service=service,relay_factory=lambda allowed,network,service:Relay(network,service))
 async def asyncTearDown(self):self.edge.close()
 async def test_prepare_never_activates_trial_or_calls_device(self):
  await self.edge.prepare();self.assertEqual([r[0] for r in self.sdk.calls],['session']);self.assertEqual(self.calls,[])
 async def test_new_permissions_require_explicit_consent(self):
  with self.assertRaises(PermissionError):await self.edge.prepare(new_policy=ALLOW)
  self.assertEqual(self.sdk.calls,[])
 async def test_only_selected_read_entities_are_sampled(self):
  await self.edge.prepare(new_policy=ALLOW,confirmed=True);self.assertEqual(self.reads,[['binary_sensor.synthetic']])
 async def test_SDK_is_off_HA_loop_and_dispatch_returns_to_HA_loop(self):
  await self.edge.prepare(new_policy=ALLOW,confirmed=True);self.sdk.rows=[{'command_id':'a'*32}]
  await self.edge.cycle();self.assertTrue(all(r[2]!=threading.get_ident() for r in self.sdk.calls))
  self.assertEqual(self.calls,[('cover','open_cover',{'entity_id':'cover.synthetic'},threading.get_ident())])
 async def test_shadow_mode_does_not_poll_physical_queue(self):
  await self.edge.prepare(new_policy=ALLOW,confirmed=True);self.sdk.shadow=True;await self.edge.cycle()
  self.assertFalse(any(r[0]=='effects' for r in self.sdk.calls));self.assertEqual(self.calls,[])
 async def test_authorization_revoked_during_prepare_cannot_save_permissions(self):
  authorized=True
  def revoke():
   nonlocal authorized
   authorized=False
  self.sdk.hook=revoke
  with self.assertRaises(PermissionError):await self.edge.prepare(new_policy=ALLOW,confirmed=True,authorized=lambda:authorized)
  self.assertEqual(self.options,EMPTY)
 async def test_receipt_expiry_is_rechecked_on_HA_loop(self):
  await self.edge.prepare(new_policy=ALLOW,confirmed=True);await self.edge.cycle()
  with self.assertRaisesRegex(PermissionError,'grant_expired'):
   await self.edge.dispatch(self.edge.generation,self.options,'cover.open_cover',{'entity_id':'cover.synthetic'},datetime.now(timezone.utc)-timedelta(seconds=1))
  self.assertEqual(self.calls,[])
 async def test_different_service_for_approved_entity_is_denied(self):
  await self.edge.prepare(new_policy=ALLOW,confirmed=True);await self.edge.cycle()
  with self.assertRaises(PermissionError):await self.edge.dispatch(self.edge.generation,self.options,'cover.close_cover',{'entity_id':'cover.synthetic'},datetime.now(timezone.utc)+timedelta(seconds=1))
  self.assertEqual(self.calls,[])
 async def test_permission_removal_invalidates_old_dispatch_generation(self):
  await self.edge.prepare(new_policy=ALLOW,confirmed=True);await self.edge.cycle();old=self.edge.generation;approved=copy.deepcopy(self.options)
  await self.edge.prepare(new_policy=EMPTY,confirmed=True)
  with self.assertRaises(PermissionError):await self.edge.dispatch(old,approved,'cover.open_cover',{'entity_id':'cover.synthetic'},datetime.now(timezone.utc)+timedelta(seconds=1))
  self.assertEqual(self.calls,[])
 async def test_manual_returns_only_after_signed_relay_delivery(self):
  await self.edge.prepare(new_policy=ALLOW,confirmed=True);self.sdk.rows=[{'command_id':'a'*32}]
  result=await self.edge.manual('cover.open_cover',{'entity_id':'cover.synthetic'},authorized=lambda:True)
  self.assertEqual(result,{'delivered':True});self.assertEqual(len(self.calls),1)
 async def test_notification_requires_exact_approved_destination(self):
  with self.assertRaises(ValueError):policy({'reads':[],'effects':[],'notification':['notify','synthetic']})

if __name__=='__main__':unittest.main()
