"""Public SDK boundary tests. No server engine, issuer code or customer data."""
import copy,importlib.util,json,sys,types,unittest,uuid
from datetime import datetime,timedelta,timezone
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization

def load_sdk(root):
    import importlib
    module=importlib.import_module('client81.adapters.automation.lib.cloudpelizzon_client.client')
    if Path(module.__file__).resolve()!=Path(root/'client.py').resolve():raise AssertionError('candidate_sdk_required')
    return module
root=Path(__file__).resolve().parent/'client81/adapters/automation/lib/cloudpelizzon_client'
if not root.is_dir():root=Path(sys.argv[1])
sdk=load_sdk(root)
from client81.adapters.automation.lib.cloudpelizzon_client.native_wire85 import binding,canonical

class TransportTests(unittest.TestCase):
    def setUp(self):
        self.now=datetime(2026,10,18,tzinfo=timezone.utc);self.key=Ed25519PrivateKey.generate()
        self.authority=Ed25519PrivateKey.generate();self.iid='synthetic-public-transport87'
        pub=self.authority.public_key().public_bytes(serialization.Encoding.Raw,serialization.PublicFormat.Raw)
        self.requests=[];self.change=None;self.saved=None;self.failure=False
        self.client=sdk.Client(self.iid,self.key,transport=self.transport,clock=lambda:self.now,authority=pub)
        # Capability acquisition is an explicit boundary; no live enrollment or issuer.
        self.client._control=lambda action,extra:({'ok':True,'operation':extra['operation'],'token':'cpt1.synthetic-only'},'0'*64)
    def args(self):return {'worker_id':'a'*32,'code':'CUS-00000001','revision':1,'activation_generation':1,'kind':'run',
        'body':{'stage':'run','code':'CUS-00000001','revision':1,'activation_generation':1,'event_id':'b'*32,'variables':{}}}
    def receipt(self,body):
        c={'schema':'cp.trial.effect.v1','installation_id':self.iid,'sku':'CP-AUTOMATION',
            'operation':'automation.rules.execute','challenge':body['proof']['challenge'],
            'args_sha256':binding(self.iid,body['args'],body['request_id']),'decision':'allow','entitlement_type':'trial',
            'issued_at':self.now.isoformat(),'expires_at':(self.now+timedelta(seconds=5)).isoformat(),
            'blocks_at':(self.now+timedelta(days=1)).isoformat(),'trial_id':'synthetic-trial87'}
        return {'claims':c,'signature':self.authority.sign(canonical(c)).hex()}
    def transport(self,path,body):
        self.requests.append(copy.deepcopy((path,body)))
        prefix=b'CP-GATEWAY-EXECUTE-V3\n' if body['v']==3 else b'CP-GATEWAY-EXECUTE-V2\n'
        self.key.public_key().verify(bytes.fromhex(body['signature']),prefix+sdk.canonical({k:v for k,v in body.items() if k!='signature'}))
        for proof in body.get('proofs',[body.get('proof')]):
            self.key.public_key().verify(bytes.fromhex(proof['request_signature']),sdk.canonical({k:v for k,v in proof.items() if k!='request_signature'}))
        if self.failure:raise TimeoutError('synthetic timeout')
        result={'receipt':self.receipt(body)} if path=='/v1/automation/authorize' else {'active':body['operation'].endswith('.activate')}
        if self.change:self.change(result,body)
        return 200,{'ok':True,'operation':body['operation'],'request_id':body['request_id'],'result':result}
    def authorize(self):return self.client.authorize_native(self.args(),request_id=uuid.uuid4().hex)
    def resign(self,packet):packet['signature']=self.authority.sign(canonical(packet['claims'])).hex()
    def deny_change(self,change):
        self.change=change
        with self.assertRaisesRegex(sdk.ClientError,'native_receipt_not_verified'):self.authorize()
    def test_activate_uses_two_distinct_proofs(self):
        self.client.execute('CP-AUTOMATION','automation.rules.activate',{'code':'CUS-00000001','revision':1},request_id=uuid.uuid4().hex)
        path,body=self.requests[-1];self.assertEqual(path,'/v1/execute');self.assertEqual(body['v'],3)
        self.assertEqual(len(body['proofs']),2)
        self.assertNotEqual(body['proofs'][0]['nonce'],body['proofs'][1]['nonce'])
        self.assertNotEqual(body['proofs'][0]['challenge'],body['proofs'][1]['challenge'])
    def test_deactivate_uses_one_proof(self):
        self.client.execute('CP-AUTOMATION','automation.rules.deactivate',{'code':'CUS-00000001','revision':1},request_id=uuid.uuid4().hex)
        self.assertEqual(self.requests[-1][1]['v'],2);self.assertIn('proof',self.requests[-1][1])
    def test_native_authorize_uses_exact_route_and_receipt(self):
        self.assertEqual(set(self.authorize()),{'receipt'})
        self.assertEqual(self.requests[-1][0],'/v1/automation/authorize')
        self.assertEqual(self.requests[-1][1]['v'],2)
    def test_wrong_signature_is_denied(self):
        self.deny_change(lambda result,body:result['receipt'].update(signature='0'*128))
    def test_other_installation_is_denied(self):
        def change(result,body):
            result['receipt']['claims']['installation_id']='another-installation';self.resign(result['receipt'])
        self.deny_change(change)
    def test_wrong_args_binding_is_denied(self):
        def change(result,body):
            result['receipt']['claims']['args_sha256']='0'*64;self.resign(result['receipt'])
        self.deny_change(change)
    def test_wrong_challenge_is_denied(self):
        def change(result,body):
            result['receipt']['claims']['challenge']='0'*64;self.resign(result['receipt'])
        self.deny_change(change)
    def test_exact_receipt_expiry_is_denied(self):
        def change(result,body):self.now+=timedelta(seconds=5)
        self.deny_change(change)
    def test_extended_receipt_is_denied(self):
        def change(result,body):
            result['receipt']['claims']['expires_at']=(self.now+timedelta(seconds=6)).isoformat();self.resign(result['receipt'])
        self.deny_change(change)
    def test_prior_receipt_cannot_authorize_next_request(self):
        previous=copy.deepcopy(self.authorize()['receipt'])
        self.deny_change(lambda result,body:result.update(receipt=previous))
    def test_timeout_is_not_retried(self):
        self.failure=True
        with self.assertRaisesRegex(sdk.ClientError,'transport_failed'):self.authorize()
        self.assertEqual(len(self.requests),1)
    def test_no_mutation_of_caller_arguments(self):
        args=self.args();before=copy.deepcopy(args)
        self.client.authorize_native(args,request_id=uuid.uuid4().hex)
        self.assertEqual(args,before)

if __name__=='__main__':
    sys.argv=[sys.argv[0]];unittest.main(verbosity=2)
