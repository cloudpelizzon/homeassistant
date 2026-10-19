"""Original explicit trial button transport. No automatic activation or keys."""
import asyncio
from functools import partial
import probatio
from homeassistant.components import websocket_api

COMMAND='cloudpelizzon/core/trial/v2/start'
KEY='cloudpelizzon_public_trial83'
SKUS=frozenset(('CP-MAINTENANCE','CP-SOLAR','CP-SECURITY','CP-AUTOMATION'))
# Match the deployed gateway's readiness gate; never consume time on partial modules.
ACTIVATION_READY=frozenset(('CP-MAINTENANCE','CP-SOLAR','CP-AUTOMATION'))


async def dispatch(hass,connection,msg):
    state=hass.data.get(KEY)
    user=connection.user
    async def authorized():
        if (state is None or hass.data.get(KEY) is not state or state['closed']
            or connection.user is not user or user is None or not user.is_active or not user.is_admin):return False
        current=await hass.auth.async_get_user(user.id)
        return (current is not None and current.id==user.id and current.is_active and current.is_admin
                and hass.data.get(KEY) is state and not state['closed'])
    try:
        if set(msg)!={'id','type','sku'} or msg['type']!=COMMAND or msg['sku'] not in SKUS or not await authorized():
            raise PermissionError('active_administrator_required')
        if msg['sku'] not in ACTIVATION_READY:
            connection.send_error(msg['id'],'trial_module_not_ready',
                'O teste deste módulo ainda não está disponível nesta versão. Nenhuma ativação foi enviada por esta solicitação.')
            return
        # An RPC sent by the original UI's explicit confirmation is the only
        # entry point. Startup, status reads and pairing never call activate.
        if msg['sku']=='CP-AUTOMATION':
            if state['prepare'] is None:raise PermissionError('native_connection_required')
            await state['prepare'](msg['sku'])
            if not await authorized():raise PermissionError('session_or_runtime_changed')
        result=await hass.async_add_executor_job(partial(state['client'].activate,msg['sku'],confirmed=True))
        if not await authorized():raise PermissionError('session_or_runtime_changed')
        if state['activated'] is not None:state['activated'](msg['sku'])
        claim=result['claims']
        connection.send_result(msg['id'],{'first_activation':result['first_activation'],
            'sku':claim['sku'],'phase':claim['phase'],'blocks_at':claim['blocks_at'],
            'removal_due_at':claim['removal_due_at']})
    except asyncio.CancelledError:raise
    except Exception:
        connection.send_error(msg['id'],'trial_activation_denied_or_unconfirmed',
            'Não foi possível confirmar a ativação. Atualize o status antes de tentar novamente.')


def register(hass,client,*,prepare=None,activated=None):
    registry=hass.data.get(websocket_api.DOMAIN,{})
    if KEY in hass.data or COMMAND in registry:raise ValueError('trial_command_conflict')
    state={'client':client,'closed':False,'prepare':prepare,'activated':activated};hass.data[KEY]=state
    handler=websocket_api.websocket_command({probatio.Required('type'):COMMAND,
        probatio.Required('sku'):str})(websocket_api.async_response(dispatch))
    def close():
        state['closed']=True
        if hass.data.get(KEY) is state:hass.data.pop(KEY,None)
        current=hass.data.get(websocket_api.DOMAIN,{})
        if COMMAND in current and current[COMMAND][0] is handler:current.pop(COMMAND)
    try:websocket_api.async_register_command(hass,handler)
    except BaseException:close();raise
    return close
