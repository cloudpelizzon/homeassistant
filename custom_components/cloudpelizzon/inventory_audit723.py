"""Enrich authorized Inventory edits with durable before/after audit metadata."""
import asyncio, functools, inspect, json, logging, sqlite3
from pathlib import Path
from homeassistant.components import websocket_api

_LOGGER = logging.getLogger(__name__)
COMMAND = 'cloudpelizzon/inventory/command'
FIELDS = frozenset(('name category manufacturer model serial asset_tag location location_mode ha_area_id ha_area_name owner department site rack hostname mac ip_addresses primary_ip connection_protocol device_type firmware operating_system port_count vlan service_host service_port purchase_date purchase_value current_value current_value_mode depreciation_percent supplier supplier_contact invoice warranty_start warranty_until support_until lifecycle criticality notes icon_key').split())

def asset(connection, asset_id):
    row = connection.execute('SELECT name,category,manufacturer,model,attributes FROM assets WHERE id=?', (asset_id,)).fetchone()
    if row is None:
        return None
    return {**json.loads(row[4] or '{}'), **dict(zip(('name','category','manufacturer','model'),row[:4]))}

def before_edit(database, asset_id):
    with sqlite3.connect(f'file:{database}?mode=ro', uri=True, timeout=10) as c:
        return asset(c, asset_id), c.execute('SELECT coalesce(max(id),0) FROM events').fetchone()[0]

def finish_edit(database, asset_id, before, last_id, actor, submitted):
    with sqlite3.connect(database, timeout=10) as c:
        after = asset(c, asset_id)
        if before is None or after is None:
            return
        changes = [{'field': key, 'before': before.get(key), 'after': after.get(key), 'recorded': True}
                   for key in sorted(FIELDS & set(submitted)) if before.get(key) != after.get(key)]
        rows = c.execute("SELECT id,detail FROM events WHERE id>? AND asset_id=? AND event='device_edited' ORDER BY id", (last_id,asset_id)).fetchall()
        if not rows:
            _LOGGER.warning('Inventory edit succeeded but its audit event was not found')
            return
        event_id, value = rows[-1]
        detail = json.loads(value or '{}')
        detail['audit'] = {'schema':'cp.inventory.audit.v1','actor':actor,'device':{'id':asset_id,'name':after['name']},'changes':changes,'capture':'server'}
        c.execute('UPDATE events SET detail=? WHERE id=?', (json.dumps(detail,ensure_ascii=False),event_id))

def enrich(database, operation, args, result):
    is_history = operation == 'history' and isinstance(result,list)
    is_report = operation == 'report' and args.get('kind') == 'history' and isinstance(result,dict)
    if not (is_history or is_report):
        return result
    with sqlite3.connect(f'file:{database}?mode=ro',uri=True,timeout=10) as c:
        names = dict(c.execute('SELECT id,name FROM assets'))
        if is_history:
            events = result
        else:
            limit = min(10000,max(1,len(result.get('rows',[]))))
            events = [{'id':i,'at':at,'asset_id':aid,'event':event,'detail':json.loads(detail or '{}')}
                      for i,at,aid,event,detail in c.execute('SELECT id,at,asset_id,event,detail FROM events ORDER BY id DESC LIMIT ?', (limit,))]
        events = [{**e,'asset_name':e.get('detail',{}).get('audit',{}).get('device',{}).get('name') or names.get(e.get('asset_id')) or e.get('asset_name')} for e in events]
        return events if is_history else {**result,'audit_events':events}

class ResultProxy:
    def __init__(self, connection):
        self.connection=connection
        self.results=[]
    def __getattr__(self,key):
        return getattr(self.connection,key)
    def send_result(self,msg_id,result=None):
        self.results.append((msg_id,result))

def install(hass):
    registry=hass.data.get(websocket_api.DOMAIN,{})
    original,schema=registry[COMMAND]
    if getattr(original,'_cp_audit723',False):
        return lambda:None
    raw=inspect.unwrap(original)
    if not inspect.iscoroutinefunction(raw):
        raise RuntimeError('inventory_audit_handler_not_async')
    database=Path(hass.config.path('.storage/cloudpelizzon_inventory/inventory.sqlite3'))
    lock=asyncio.Lock()
    async def run(hass,connection,msg):
        operation=msg.get('operation');args=msg.get('args',{})
        user=connection.user
        permitted=user is not None and user.is_active and user.is_admin
        editing=permitted and operation=='device.edit' and isinstance(args.get('id'),str)
        before=None;last_id=0
        if editing:
            before,last_id=await hass.async_add_executor_job(before_edit,database,args['id'])
        proxy=ResultProxy(connection)
        # Original handler retains all session, license and operation authorization checks.
        await raw(hass,proxy,msg)
        if proxy.results and editing:
            try:
                await hass.async_add_executor_job(finish_edit,database,args['id'],before,last_id,{'id':user.id,'name':user.name or 'Usuário do Home Assistant'},args.get('values',{}))
            except Exception:
                _LOGGER.exception('Unable to enrich the Inventory audit event after a successful edit')
        for msg_id,result in proxy.results:
            try:
                result=await hass.async_add_executor_job(enrich,database,operation,args,result)
            except Exception:
                _LOGGER.exception('Unable to enrich the Inventory history presentation')
            connection.send_result(msg_id,result)
    @functools.wraps(original)
    @websocket_api.async_response
    async def wrapped(hass,connection,msg):
        if msg.get('operation')=='device.edit':
            async with lock:
                await run(hass,connection,msg)
        else:
            await run(hass,connection,msg)
    wrapped._cp_audit723=True
    websocket_api.async_register_command(hass,COMMAND,wrapped,schema)
    def uninstall():
        if registry.get(COMMAND,(None,))[0] is wrapped:
            registry[COMMAND]=(original,schema)
    return uninstall
