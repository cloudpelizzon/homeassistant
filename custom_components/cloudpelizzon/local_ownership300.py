"""Shared local execution consent ledger; independent of Trial and paid rights."""
import json,sqlite3
from contextlib import closing
if __package__:
 from .module_package243 import canonical
 from .tenant_migration246 import safe
else:
 from module_package243 import canonical
 from tenant_migration246 import safe

def actor_guard(user,callback):
 def guard():return callback() is True and user.is_active is True and user.is_admin is True
 guard.actor_id=user.id
 return guard

class OwnerStore:
 def __init__(self,path,sku,iid):self.path=safe(path);self.sku=sku;self.iid=iid
 def save(self,value):
  safe(self.path)
  with closing(sqlite3.connect(self.path)) as db,db:
   db.execute('CREATE TABLE IF NOT EXISTS local_execution_owners300(sku TEXT,iid TEXT,document TEXT NOT NULL,PRIMARY KEY(sku,iid))')
   if value is None:db.execute('DELETE FROM local_execution_owners300 WHERE sku=? AND iid=?',(self.sku,self.iid))
   else:db.execute('INSERT OR REPLACE INTO local_execution_owners300 VALUES(?,?,?)',(self.sku,self.iid,canonical(value).decode()))
 def load(self):
  safe(self.path)
  with closing(sqlite3.connect(self.path)) as db:
   if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='local_execution_owners300'").fetchone():return None
   rows=db.execute('SELECT sku,iid,document FROM local_execution_owners300').fetchall()
  if rows and (len(rows)!=1 or rows[0][:2]!=(self.sku,self.iid)):raise PermissionError('local_execution_owner_scope')
  if not rows:return None
  value=json.loads(rows[0][2])
  if not (type(value) is dict and set(value)=={'owner_id','generation','policy'} and type(value['owner_id']) is str
   and 1<=len(value['owner_id'])<=128 and type(value['generation']) is str and len(value['generation'])==32
   and all(c in '0123456789abcdef' for c in value['generation']) and type(value['policy']) is dict):
   raise PermissionError('local_execution_owner_binding')
  return value
