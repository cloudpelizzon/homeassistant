"""Public candidate native Security HTTP/services dispatcher. No device effects."""
import asyncio,json
from homeassistant.components.http import HomeAssistantView,KEY_HASS
from homeassistant.exceptions import HomeAssistantError
from .bridge import SecurityBridge,ALIASES
from ....local_ownership300 import actor_guard
URL='/api/cloudpelizzon/seguranca/configuracao'
DOMAIN='cloudpelizzon'
KEY='cloudpelizzon_security_transport63'
VIEW_KEY=KEY+'_view'
LIMIT=48000
def active(user):return user is not None and getattr(user,'is_active',False) is True
def get_bridge(hass):
    state=hass.data.get(KEY)
    if not isinstance(state,dict) or state['bridge'].closed:raise PermissionError('security_unavailable')
    return state['bridge']
def unique(pairs):
    data={}
    for k,v in pairs:
        if k in data:raise ValueError('duplicate_json_key')
        data[k]=v
    return data
async def body(request):
    if request.content_length is not None and request.content_length>LIMIT:raise ValueError('body_limit')
    raw=bytearray()
    while len(raw)<=LIMIT:
        chunk=await request.content.read(min(4096,LIMIT+1-len(raw)))
        if not chunk:break
        raw.extend(chunk)
    if len(raw)>LIMIT:raise ValueError('body_limit')
    value=json.loads(raw,object_pairs_hook=unique,parse_constant=lambda _:(_ for _ in ()).throw(ValueError('nonfinite')))
    if not isinstance(value,dict):raise ValueError('object_required')
    return value
async def current_user(hass,user,*,admin=False):
    user_id=getattr(user,'id',None)
    current=await hass.auth.async_get_user(user_id) if user_id else None
    if (not active(current) or getattr(current,'id',None)!=user_id
            or admin and getattr(current,'is_admin',False) is not True):
        raise PermissionError('security_session_changed')
    return current

async def prepare_siren_permissions(hass,value,*,authorized):
    """Consent from the active admin's enabled physical actuator configuration."""
    import re
    from ....public_security.api126 import KEY as EDGE_KEY
    selected=value.get('sirene')
    if not isinstance(selected,dict) or selected.get('habilitada') is not True:return
    target=selected.get('entidade')
    if not isinstance(target,str) or not re.fullmatch(r'siren\.[a-z0-9_]+',target):raise ValueError('invalid_siren_target')
    edge=hass.data.get(EDGE_KEY)
    if edge is None or not authorized():raise PermissionError('active_security_connection_required')
    previous=edge.check();updated={**previous,'reads':sorted(set(previous['reads'])|{target}),'effects':[list(x) for x in previous['effects']]}
    for service in ('turn_on','turn_off'):
        row=['siren',service,target]
        if row not in updated['effects']:updated['effects'].append(row)
    if updated!=previous:await edge.prepare(new_policy=updated,confirmed=True,authorized=authorized)
    if not authorized() or hass.data.get(EDGE_KEY) is not edge:raise PermissionError('security_session_changed')

class ConfigurationView(HomeAssistantView):
    url=URL;name='api:cloudpelizzon:seguranca:configuracao';requires_auth=True
    async def get(self,request):
        user=request.get('hass_user');hass=request.app[KEY_HASS]
        if not active(user):return self.json({'erro':'authentication_required'},status_code=401)
        try:
            await current_user(hass,user)
            bridge=get_bridge(hass)
            result=await bridge.handle('configuration.get',authenticated=True,admin=user.is_admin)
            await current_user(hass,user)
            if get_bridge(hass) is not bridge:raise PermissionError('runtime_changed')
        except asyncio.CancelledError:raise
        except Exception:return self.json({'erro':'security_unavailable'},status_code=503)
        return self.json(result)
    async def post(self,request):
        user=request.get('hass_user');hass=request.app[KEY_HASS]
        if not active(user):return self.json({'erro':'authentication_required'},status_code=401)
        if user.is_admin is not True:return self.json({'erro':'administrator_required'},status_code=403)
        try:value=await body(request)
        except (ValueError,TypeError,RecursionError,UnicodeError):return self.json({'erro':'invalid_configuration'},status_code=400)
        try:
            await current_user(hass,user,admin=True)
            bridge=get_bridge(hass)
            await prepare_siren_permissions(hass,value,authorized=actor_guard(user,lambda:active(user) and user.is_admin is True and get_bridge(hass) is bridge))
            await current_user(hass,user,admin=True)
            result=await bridge.handle('configuration.set',value,authenticated=True,admin=True)
            await current_user(hass,user,admin=True)
            if get_bridge(hass) is not bridge:raise PermissionError('runtime_changed')
        except asyncio.CancelledError:raise
        except ValueError:return self.json({'erro':'invalid_configuration'},status_code=400)
        except Exception:return self.json({'erro':'security_unavailable'},status_code=503)
        return self.json(result)

def register(hass,client,*,shadow_control=False):
    if KEY in hass.data:raise ValueError('security_transport_already_registered')
    current=hass.services.async_services().get(DOMAIN,{})
    if any(name in current for name in ALIASES):raise ValueError('security_service_conflict')
    view=hass.data.get(VIEW_KEY)
    if view is not None and not isinstance(view,ConfigurationView):raise ValueError('security_view_conflict')
    if view is None:
        if any(route.resource.canonical==URL for route in hass.http.app.router.routes()):raise ValueError('security_HTTP_conflict')
        view=ConfigurationView();hass.http.register_view(view);hass.data[VIEW_KEY]=view
    state={'bridge':SecurityBridge.from_client(hass,client,shadow_control=shadow_control),'services':{}}
    hass.data[KEY]=state
    def close():
        state['bridge'].close()
        owned=hass.services.async_services().get(DOMAIN,{})
        for name,original in state['services'].items():
            if owned.get(name) is original:hass.services.async_remove(DOMAIN,name)
        if hass.data.get(KEY) is state:hass.data.pop(KEY,None)
    try:
        for name in ALIASES:
            async def handler(call,service_name=name):
                if hass.data.get(KEY) is not state:raise HomeAssistantError('security_unavailable')
                user_id=call.context.user_id
                user=await hass.auth.async_get_user(user_id) if user_id else None
                if not active(user) or user.is_admin is not True:raise HomeAssistantError('security_administrator_required')
                if hass.data.get(KEY) is not state:raise HomeAssistantError('security_unavailable')
                try:await state['bridge'].handle(service_name,dict(call.data),authenticated=True,admin=True)
                except asyncio.CancelledError:raise
                except Exception:raise HomeAssistantError('security_unavailable') from None
            hass.services.async_register(DOMAIN,name,handler)
            state['services'][name]=hass.services.async_services()[DOMAIN][name]
    except BaseException:close();raise
    return close
