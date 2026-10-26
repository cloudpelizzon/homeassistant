"""Shared paid-only authorization for private engines running inside HA.

No module engine, license issuer or payment writer is imported here. The caller
injects the approved package, native SDK and receipt transport. No Trial fallback.
"""
import hashlib,http.client,json,re,secrets,sqlite3
from contextlib import closing
from datetime import datetime,timezone
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

AUTHORITY='3c6f1bfb75285e2077b95c421d18cf34c54d4714bce29e871f74e42b7d53e24b'
FIELDS={'schema','installation_id','sku','operation','challenge','args_sha256','decision','entitlement_type','issued_at','expires_at','license_id','license_revision'}
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()
def require(value,code):
 if not value:raise PermissionError(code)
def binding(iid,sku,operation,args,rid):
 return hashlib.sha256(canonical({'protocol':'cp.cloud.online.v1','installation_id':iid,'sku':sku,'operation':operation,'args':args,'request_id':rid})).hexdigest()
def relay(proof):
 body=canonical({'proof':proof});require(len(body)<=16384,'bounded_signed_request_required')
 connection=http.client.HTTPSConnection('portal.cloudpelizzon.com.br',timeout=12)
 try:
  connection.request('POST','/custom/cloudpelizzon/local_authorization247.php',body,{'Content-Type':'application/json'})
  response=connection.getresponse();raw=response.read(16385)
  require(response.status==200 and len(raw)<=16384,'paid_authority_unavailable')
  value=json.loads(raw);require(type(value) is dict and set(value)=={'receipt'},'native_paid_receipt_required')
  return value['receipt']
 finally:connection.close()
def verify(packet,proof,now,authority=AUTHORITY):
 require(type(packet) is dict and set(packet)=={'claims','signature'},'paid_receipt_required')
 claims=packet['claims']
 require(type(claims) is dict and set(claims)==FIELDS,'paid_receipt_fields_required')
 require(claims['schema']=='cp.paid.effect206.v1' and claims['decision']=='allow' and claims['entitlement_type']=='paid','paid_receipt_required')
 require(all(claims[k]==proof[k] for k in ('installation_id','sku','operation','challenge','args_sha256')),'paid_receipt_binding_required')
 require(type(claims['license_revision']) is int and claims['license_revision']>=1 and type(claims['license_id']) is str and 1<=len(claims['license_id'])<=160,'active_native_license_required')
 start=datetime.fromisoformat(claims['issued_at'].replace('Z','+00:00'));end=datetime.fromisoformat(claims['expires_at'].replace('Z','+00:00'))
 require(start.tzinfo is not None and end.tzinfo is not None and start<=now<end and 0<(end-start).total_seconds()<=5,'fresh_paid_receipt_required')
 Ed25519PublicKey.from_public_bytes(bytes.fromhex(authority)).verify(bytes.fromhex(packet['signature']),canonical(claims))
 return claims

class Gate:
 def __init__(self,client,*,sku,operations,receipt_transport=relay,database,package_ready,authority=AUTHORITY,clock=lambda:datetime.now(timezone.utc)):
  require(re.fullmatch(r'CP-[A-Z0-9-]{2,80}',sku) and operations and callable(package_ready),'approved_module_package_required')
  self.client=client;self.sku=sku;self.operations=frozenset(operations);self.transport=receipt_transport
  self.database=Path(database);self.package_ready=package_ready;self.authority=authority;self.clock=clock;self.closed=False
 def check(self,iid,operation):
  require(not self.closed and self.package_ready() is True and iid==self.client._iid and operation in self.operations,'local_module_scope_required')
 def authorize(self,iid,operation,args,rid):
  self.check(iid,operation)
  require(type(args) is dict and type(rid) is str and re.fullmatch(r'[A-Za-z0-9_-]{16,128}',rid),'bound_operation_request_required')
  frozen=json.loads(canonical(args));require(len(canonical(frozen))<=65536,'bounded_module_arguments_required')
  cap,_=self.client._control('capability',{'sku':self.sku,'operation':operation})
  require(type(cap) is dict and cap.get('ok') is True and cap.get('operation')==operation
   and isinstance(cap.get('token'),str) and cap['token'].startswith('cpp1.') and len(cap['token'])<=8192,'paid_capability_required')
  now=self.clock()
  proof=self.client._sign({'installation_id':iid,'sku':self.sku,'operation':operation,
   'challenge':secrets.token_hex(32),'args_sha256':binding(iid,self.sku,operation,frozen,rid),
   'token':cap['token'],'nonce':secrets.token_hex(32),'timestamp':int(now.timestamp())})
  require(type(proof) is dict and proof.get('installation_id')==iid and proof.get('sku')==self.sku
   and proof.get('operation')==operation and proof.get('args_sha256')==binding(iid,self.sku,operation,frozen,rid),'native_signed_request_required')
  packet=self.transport(proof)
  claims=verify(packet,proof,self.clock(),self.authority)
  self.check(iid,operation)
  # Same receipt cannot authorize another local attempt, even after restart.
  require(not any(p.is_symlink() for p in (self.database,*self.database.parents)),'private_local_database_required')
  with closing(sqlite3.connect(self.database,timeout=3)) as con,con:
   con.execute('CREATE TABLE IF NOT EXISTS cp_local_receipts246(sku TEXT NOT NULL,iid TEXT NOT NULL,challenge TEXT NOT NULL,expires_at TEXT NOT NULL,PRIMARY KEY(sku,iid,challenge))')
   con.execute('DELETE FROM cp_local_receipts246 WHERE expires_at<?',(self.clock().astimezone(timezone.utc).isoformat(),))
   try:con.execute('INSERT INTO cp_local_receipts246 VALUES(?,?,?,?)',(self.sku,iid,claims['challenge'],datetime.fromisoformat(claims['expires_at'].replace('Z','+00:00')).astimezone(timezone.utc).isoformat()))
   except sqlite3.IntegrityError:raise PermissionError('paid_receipt_already_consumed') from None
  return claims
 async def allowed(self,iid,operation,args,rid):
  try:self.authorize(iid,operation,args,rid);return True
  except Exception:return False
 def close(self):self.closed=True
