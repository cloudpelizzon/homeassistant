"""Native original Maintenance command schemas; private engine transport only."""
import asyncio,inspect
import probatio
from homeassistant.components import websocket_api
from .bridge import CONTRACTS
SCHEMAS={'cloudpelizzon/maintenance/category/create':{probatio.Required('type'): 'cloudpelizzon/maintenance/category/create', probatio.Required('name'): str, probatio.Optional('icon', default='🛠️'): str, probatio.Optional('color', default='#35b9ff'): str, probatio.Optional('header_image', default=''): str},
'cloudpelizzon/maintenance/category/delete':{probatio.Required('type'): 'cloudpelizzon/maintenance/category/delete', probatio.Required('category_id'): str},
'cloudpelizzon/maintenance/category/update':{probatio.Required('type'): 'cloudpelizzon/maintenance/category/update', probatio.Required('category_id'): str, probatio.Optional('name'): str, probatio.Optional('icon'): str, probatio.Optional('color'): str, probatio.Optional('header_image'): str},
'cloudpelizzon/maintenance/compat/get_snapshot':{probatio.Required('type'): 'cloudpelizzon/maintenance/compat/get_snapshot'},
'cloudpelizzon/maintenance/compat/save_snapshot':{probatio.Required('type'): 'cloudpelizzon/maintenance/compat/save_snapshot', probatio.Required('snapshot'): dict},
'cloudpelizzon/maintenance/complete':{probatio.Required('type'): 'cloudpelizzon/maintenance/complete', probatio.Required('maintenance_id'): str, probatio.Optional('execution_date', default=''): str, probatio.Optional('executor', default=''): str, probatio.Optional('provider', default=''): str, probatio.Optional('notes', default=''): str, probatio.Optional('material_cost', default=0): probatio.Coerce(float), probatio.Optional('labor_cost', default=0): probatio.Coerce(float)},
'cloudpelizzon/maintenance/create':{probatio.Required('type'): 'cloudpelizzon/maintenance/create', probatio.Required('name'): str, probatio.Optional('category', default='Outros'): str, probatio.Optional('cycle_days'): int, probatio.Optional('priority', default='Importante'): str, probatio.Optional('criticality'): str, probatio.Optional('estimated_material', default=0): probatio.Coerce(float), probatio.Optional('estimated_labor', default=0): probatio.Coerce(float), probatio.Optional('image', default=''): str},
'cloudpelizzon/maintenance/delete':{probatio.Required('type'): 'cloudpelizzon/maintenance/delete', probatio.Required('maintenance_id'): str},
'cloudpelizzon/maintenance/favorite/toggle':{probatio.Required('type'): 'cloudpelizzon/maintenance/favorite/toggle', probatio.Required('maintenance_id'): str},
'cloudpelizzon/maintenance/finance/create':{probatio.Required('type'): 'cloudpelizzon/maintenance/finance/create', probatio.Optional('maintenance_id', default=''): str, probatio.Required('name'): str, probatio.Required('category'): str, probatio.Required('date'): str, probatio.Optional('executor', default=''): str, probatio.Optional('provider', default=''): str, probatio.Optional('products', default=''): str, probatio.Optional('products_cost', default=0): probatio.Coerce(float), probatio.Optional('labor_cost', default=0): probatio.Coerce(float), probatio.Optional('market_labor', default=0): probatio.Coerce(float), probatio.Optional('saving', default=0): probatio.Coerce(float), probatio.Optional('notes', default=''): str},
'cloudpelizzon/maintenance/finance/delete':{probatio.Required('type'): 'cloudpelizzon/maintenance/finance/delete', probatio.Required('record_id'): str},
'cloudpelizzon/maintenance/finance/update':{probatio.Required('type'): 'cloudpelizzon/maintenance/finance/update', probatio.Required('record_id'): str, probatio.Optional('name'): str, probatio.Optional('category'): str, probatio.Optional('date'): str, probatio.Optional('executor'): str, probatio.Optional('provider'): str, probatio.Optional('products'): str, probatio.Optional('products_cost'): probatio.Coerce(float), probatio.Optional('labor_cost'): probatio.Coerce(float), probatio.Optional('market_labor'): probatio.Coerce(float), probatio.Optional('saving'): probatio.Coerce(float), probatio.Optional('notes'): str},
'cloudpelizzon/maintenance/get_state':{probatio.Required('type'): 'cloudpelizzon/maintenance/get_state'},
'cloudpelizzon/maintenance/history/import_legacy':{probatio.Required('type'): 'cloudpelizzon/maintenance/history/import_legacy'},
'cloudpelizzon/maintenance/notifications/check_now':{probatio.Required('type'): 'cloudpelizzon/maintenance/notifications/check_now'},
'cloudpelizzon/maintenance/notifications/status':{probatio.Required('type'): 'cloudpelizzon/maintenance/notifications/status'},
'cloudpelizzon/maintenance/notifications/test':{probatio.Required('type'): 'cloudpelizzon/maintenance/notifications/test', probatio.Optional('title', default='🛠️ Teste CloudPelizzon Manutenção'): str, probatio.Optional('message', default='Os avisos automáticos de manutenção estão funcionando corretamente.'): str, probatio.Optional('criticality', default='Importante'): str},
'cloudpelizzon/maintenance/profile/get':{probatio.Required('type'): 'cloudpelizzon/maintenance/profile/get'},
'cloudpelizzon/maintenance/profile/update':{probatio.Required('type'): 'cloudpelizzon/maintenance/profile/update', probatio.Optional('profile_type'): str, probatio.Optional('name'): str, probatio.Optional('logo'): str, probatio.Optional('address'): str, probatio.Optional('cityState'): str, probatio.Optional('document'): str, probatio.Optional('contact'): str, probatio.Optional('phone'): str, probatio.Optional('email'): str, probatio.Optional('additional'): str},
'cloudpelizzon/maintenance/settings/update':{probatio.Required('type'): 'cloudpelizzon/maintenance/settings/update', probatio.Optional('title'): str, probatio.Optional('subtitle'): str, probatio.Optional('warning_days'): probatio.Coerce(int), probatio.Optional('history_months'): probatio.Coerce(int), probatio.Optional('auto_refresh_seconds'): probatio.Coerce(int), probatio.Optional('notifications'): dict},
'cloudpelizzon/maintenance/undo_execution':{probatio.Required('type'): 'cloudpelizzon/maintenance/undo_execution', probatio.Required('execution_id'): str},
'cloudpelizzon/maintenance/update':{probatio.Required('type'): 'cloudpelizzon/maintenance/update', probatio.Required('maintenance_id'): str, probatio.Optional('name'): str, probatio.Optional('category'): str, probatio.Optional('cycle_days'): int, probatio.Optional('priority'): str, probatio.Optional('criticality'): str, probatio.Optional('estimated_material'): probatio.Coerce(float), probatio.Optional('estimated_labor'): probatio.Coerce(float), probatio.Optional('image'): str, probatio.Optional('enabled'): bool, probatio.Optional('last_execution'): str}}
KEY='cloudpelizzon_maintenance49'
def owned(current,original):
    if current is original:return True
    if not getattr(current,'_cp_commercial_guard',False) or getattr(current,'_cp_commercial_sku',None)!='CP-MAINTENANCE':return False
    wrapped=getattr(current,'__wrapped__',None)
    return bool(inspect.isfunction(wrapped) and wrapped.__module__.endswith('.core.commercial_guard') and inspect.getclosurevars(wrapped).nonlocals.get('handler') is original)
async def dispatch(hass,connection,msg):
    user=connection.user
    if user is None or user.is_active is not True:connection.send_error(msg['id'],'unauthorized','Acesso indisponível.');return
    bridge=hass.data.get(KEY)
    if bridge is None:connection.send_error(msg['id'],'not_loaded','Manutenção indisponível.');return
    try:
        result=await bridge.handle(msg['type'],{k:v for k,v in msg.items() if k not in ('id','type')},admin=user.is_admin)
        if hass.data.get(KEY) is not bridge:raise PermissionError('maintenance_unloaded')
        connection.send_result(msg['id'],result)
    except asyncio.CancelledError:raise
    except Exception:connection.send_error(msg['id'],'cloud_denied_or_unavailable','Não foi possível validar a operação de Manutenção no servidor.')
def register(hass,bridge):
    registry=hass.data.get(websocket_api.DOMAIN,{})
    if KEY in hass.data or any(command in registry for command in CONTRACTS):raise ValueError('legacy_handlers_must_be_unloaded_first')
    handlers={}
    for command,schema in SCHEMAS.items():
        handler=websocket_api.websocket_command(schema)(websocket_api.async_response(dispatch))
        websocket_api.async_register_command(hass,handler);handlers[command]=handler
    hass.data[KEY]=bridge
    def unload():
        if hass.data.get(KEY) is not bridge:return
        bridge.close();hass.data.pop(KEY,None)
        registry=hass.data.get(websocket_api.DOMAIN,{})
        for command,handler in handlers.items():
            if command in registry and owned(registry[command][0],handler):registry.pop(command)
    return unload
