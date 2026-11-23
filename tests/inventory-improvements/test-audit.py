import asyncio,importlib.util,json,sqlite3,sys,tempfile,types
from pathlib import Path
p=Path(__file__).parent
ws=types.ModuleType('homeassistant.components.websocket_api');ws.DOMAIN='websocket_api';ws.async_response=lambda f:f
ws.async_register_command=lambda h,k,f,s:h.data[ws.DOMAIN].__setitem__(k,(f,s))
sys.modules['homeassistant']=types.ModuleType('homeassistant');sys.modules['homeassistant.components']=types.ModuleType('homeassistant.components');sys.modules['homeassistant.components.websocket_api']=ws
spec=importlib.util.spec_from_file_location('audit',p/'inventory_audit723.py');audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
root=p/'test-storage';folder=root/'.storage/cloudpelizzon_inventory';folder.mkdir(parents=True,exist_ok=True);db=folder/'inventory.sqlite3'
if db.exists():db.unlink()
with sqlite3.connect(db) as c:
 c.executescript('CREATE TABLE assets(id TEXT PRIMARY KEY,name TEXT,category TEXT,manufacturer TEXT,model TEXT,attributes TEXT);CREATE TABLE events(id INTEGER PRIMARY KEY,at INTEGER,asset_id TEXT,event TEXT,detail TEXT);')
 c.execute('INSERT INTO assets VALUES(?,?,?,?,?,?)',('tv','TV Samsung 55','television','Samsung','Q60',json.dumps({'location':None})))
 c.execute('INSERT INTO events VALUES(1,1,?,?,?)',('tv','device_edited',json.dumps({'fields':['location']})))
async def original(h,connection,msg):
 if not connection.user.is_admin:connection.send_error(msg['id'],'unauthorized','Denied');return
 op=msg['operation']
 if op=='device.edit':
  with sqlite3.connect(db) as c:
   attrs=json.loads(c.execute('SELECT attributes FROM assets WHERE id=?',('tv',)).fetchone()[0]);attrs.update(msg['args']['values']);c.execute('UPDATE assets SET attributes=? WHERE id=?',(json.dumps(attrs),'tv'));c.execute('INSERT INTO events(at,asset_id,event,detail) VALUES(2,?,?,?)',('tv','device_edited',json.dumps({'fields':list(msg['args']['values'])})))
  connection.send_result(msg['id'],{'ok':True})
 elif op=='history':
  with sqlite3.connect(db) as c:result=[{'id':i,'at':at,'asset_id':aid,'event':event,'detail':json.loads(detail)} for i,at,aid,event,detail in c.execute('SELECT * FROM events ORDER BY id DESC')]
  connection.send_result(msg['id'],result)
class Hass:
 def __init__(self):self.data={ws.DOMAIN:{audit.COMMAND:(original,{})}};self.config=types.SimpleNamespace(path=lambda s:str(root/s))
 async def async_add_executor_job(self,f,*args):return await asyncio.to_thread(f,*args)
class Connection:
 def __init__(self,admin=True):self.user=types.SimpleNamespace(id='user1',name='Admin',is_admin=admin,is_active=True);self.results=[];self.errors=[]
 def send_result(self,*args):self.results.append(args)
 def send_error(self,*args):self.errors.append(args)
async def test():
 h=Hass();close=audit.install(h);wrapped=h.data[ws.DOMAIN][audit.COMMAND][0];connection=Connection()
 await wrapped(h,connection,{'id':10,'operation':'device.edit','args':{'id':'tv','values':{'location':'Sala','model':'Q60'}}})
 with sqlite3.connect(db) as c:d=json.loads(c.execute('SELECT detail FROM events ORDER BY id DESC LIMIT 1').fetchone()[0])
 assert d['audit']['actor']['name']=='Admin';assert d['audit']['changes']==[{'field':'location','before':None,'after':'Sala','recorded':True}]
 denied=Connection(False);await wrapped(h,denied,{'id':11,'operation':'device.edit','args':{'id':'tv','values':{'location':'Não autorizado'}}});assert denied.errors and not denied.results
 await wrapped(h,connection,{'id':12,'operation':'history','args':{}});events=connection.results[-1][1];assert events[0]['asset_name']=='TV Samsung 55';assert 'audit' not in events[-1]['detail']
 close();assert h.data[ws.DOMAIN][audit.COMMAND][0] is original
 print('PASS: authenticated actor, exact before/after, unchanged fields omitted, authorization retained, legacy events unmodified, enrichment and rollback.')
asyncio.run(test())
