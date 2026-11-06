"""Public HA boundary. Commercial proof is verified by the compiled guard."""
from datetime import datetime,timedelta,timezone
import asyncio,hashlib,json,secrets,sqlite3
from pathlib import Path
def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()
class Gate:
 def __init__(self,namespace,*,sku,iid,database,ready=lambda:True):
  self.namespace=namespace;self.sku=sku;self.iid=iid;self.database=Path(database);self.ready=ready;self.closed=False
  self.clock=lambda:datetime.now(timezone.utc)
 def authorize(self,iid,operation,args,rid):
  if self.closed or not self.ready() or iid!=self.iid or not isinstance(args,dict) or not isinstance(rid,str):raise PermissionError('native_runtime_scope')
  c=self.namespace.guard.verify(self.sku,iid,operation)
  now=self.clock();expiry=now+timedelta(seconds=5)
  if c['expires_at'] is not None:expiry=min(expiry,datetime.fromtimestamp(c['expires_at'],timezone.utc))
  challenge=secrets.token_hex(32)
  with sqlite3.connect(self.database) as db:
   db.execute('CREATE TABLE IF NOT EXISTS local_authorizations627(challenge TEXT PRIMARY KEY,sku TEXT NOT NULL,expires INTEGER NOT NULL)')
   db.execute('DELETE FROM local_authorizations627 WHERE expires<?',(int(now.timestamp()),))
   db.execute('INSERT INTO local_authorizations627 VALUES(?,?,?)',(challenge,self.sku,int(expiry.timestamp())))
  return {'schema':'cp.local.effect627.v1','entitlement_type':'paid','decision':'allow','installation_id':iid,'sku':self.sku,'operation':operation,'challenge':challenge,'args_sha256':hashlib.sha256(canonical({'args':args,'request_id':rid})).hexdigest(),'issued_at':now.isoformat(),'expires_at':expiry.isoformat(),'license_id':c['license_id'],'license_revision':c['license_revision'],'authorization_mode':'offline_vendor_signed_entitlement'}
 async def allowed(self,iid,operation,args,rid):
  return await asyncio.to_thread(self.authorize,iid,operation,args,rid) is not None
 def close(self):self.closed=True
