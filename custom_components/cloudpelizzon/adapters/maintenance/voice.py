"""Public voice transport. Business data, dates and speech are computed privately."""
import asyncio
import functools
import json
import uuid
import probatio
from homeassistant.components.http import HomeAssistantView, KEY_HASS
from homeassistant.helpers import intent, config_validation as cv

KEY = 'cloudpelizzon_maintenance_voice53'
VIEW_KEY = 'cloudpelizzon_maintenance_voice53_view'
URL = '/api/cloudpelizzon/maintenance/alexa'
KINDS = ('CloudPelizzonMaintenanceOverdueIntent', 'CloudPelizzonMaintenanceUpcomingIntent', 'CloudPelizzonMaintenanceStatusIntent')
DENIED = 'O módulo de manutenção não está disponível nesta instalação. Verifique o licenciamento no CloudPelizzon.'
LIMIT = 24000

def detached(value):
    raw = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode()
    if len(raw) > LIMIT:
        raise ValueError('voice_payload_size')
    return json.loads(raw)

class VoiceBridge:
    def __init__(self, hass, client):
        self.hass = hass
        self.client = client
        self.closed = False

    async def execute(self, operation, args):
        if self.closed:
            raise PermissionError('voice_closed')
        result = await self.hass.async_add_executor_job(functools.partial(
            self.client.execute, 'CP-MAINTENANCE', operation, detached(args), request_id=uuid.uuid4().hex))
        if self.closed:
            raise PermissionError('voice_closed')
        return detached(result)

    async def speech(self, kind, slots):
        if kind not in KINDS or set(slots) - {'Category', 'Days'}:
            raise ValueError('voice_slots')
        args = {'intent_type': kind}
        if 'Category' in slots:
            category = slots['Category']['value']
            if not isinstance(category, str) or len(category) > 200:
                raise ValueError('voice_category')
            args['category'] = category
        if 'Days' in slots:
            days = slots['Days']['value']
            if type(days) is not int or not 1 <= days <= 365:
                raise ValueError('voice_days')
            args['days'] = days
        result = await self.execute('maintenance.intents.read', args)
        if not isinstance(result, dict) or set(result) != {'speech'} or not isinstance(result['speech'], str):
            raise ValueError('voice_response')
        return result['speech']

    async def alexa(self, body):
        if not isinstance(body, dict) or not isinstance(body.get('request'), dict):
            raise ValueError('alexa_request')
        result = await self.execute('maintenance.alexa.notify', {'request': body})
        if not isinstance(result, dict) or result.get('version') != '1.0' or not isinstance(result.get('response'), dict):
            raise ValueError('alexa_response')
        return result

def get_bridge(hass):
    state = hass.data.get(KEY)
    if not isinstance(state, dict) or not isinstance(state.get('bridge'), VoiceBridge) or state['bridge'].closed:
        raise PermissionError('voice_unavailable')
    return state['bridge']

class MaintenanceIntent(intent.IntentHandler):
    def __init__(self, kind):
        self.intent_type = kind
        self._schema = {probatio.Optional('Category'): cv.string}
        if kind != KINDS[0]:
            self._schema[probatio.Optional('Days')] = probatio.Coerce(int)

    @property
    def slot_schema(self):
        return self._schema

    async def async_handle(self, intent_obj):
        slots = self.async_validate_slots(intent_obj.slots)
        response = intent_obj.create_response()
        try:
            speech = await get_bridge(intent_obj.hass).speech(self.intent_type, slots)
        except asyncio.CancelledError:
            raise
        except Exception:
            speech = DENIED
        response.async_set_speech(speech)
        return response

def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('duplicate_json_key')
        result[key] = value
    return result

def invalid_constant(value):
    raise ValueError('nonfinite_json')

class MaintenanceAlexaView(HomeAssistantView):
    url = URL
    name = 'api:cloudpelizzon:maintenance:alexa'
    requires_auth = True

    async def post(self, request):
        user = request.get('hass_user')
        if user is None or not user.is_active:
            return self.json({'error': 'authentication_required'}, status_code=401)
        try:
            if request.content_length is not None and request.content_length > LIMIT:
                raise ValueError('voice_payload_size')
            # Read at most LIMIT+1 even for chunked requests; never read an unbounded body.
            raw = bytearray()
            while len(raw) <= LIMIT:
                chunk = await request.content.read(min(4096, LIMIT + 1 - len(raw)))
                if not chunk:
                    break
                raw.extend(chunk)
            if len(raw) > LIMIT:
                raise ValueError('voice_payload_size')
            body = json.loads(raw, object_pairs_hook=unique_object, parse_constant=invalid_constant)
            if not isinstance(body, dict) or not isinstance(body.get('request'), dict):
                raise ValueError('alexa_request')
        except (ValueError, TypeError, RecursionError, UnicodeError):
            return self.json({'error': 'invalid_request'}, status_code=400)
        try:
            result = await get_bridge(request.app[KEY_HASS]).alexa(body)
        except asyncio.CancelledError:
            raise
        except Exception:
            return self.json({'version': '1.0', 'response': {'outputSpeech': {'type': 'PlainText', 'text': DENIED}, 'shouldEndSession': True}}, status_code=503)
        return self.json(result)

def register(hass, client):
    """Register once; on reload only update the owned dispatcher, never other routes."""
    if KEY in hass.data:
        raise RuntimeError('maintenance_voice_already_registered')
    registry = hass.data.get(intent.DATA_KEY, {})
    if any(kind in registry for kind in KINDS):
        raise RuntimeError('maintenance_intent_conflict')
    view = hass.data.get(VIEW_KEY)
    if view is not None and not isinstance(view, MaintenanceAlexaView):
        raise RuntimeError('maintenance_http_conflict')
    if view is None:
        # Check real router before registering, including wildcard methods.
        for route in hass.http.app.router.routes():
            if route.resource.canonical == URL:
                raise RuntimeError('maintenance_http_conflict')
        view = MaintenanceAlexaView()
        hass.http.register_view(view)
        hass.data[VIEW_KEY] = view
    bridge = VoiceBridge(hass, client)
    handlers = [MaintenanceIntent(kind) for kind in KINDS]
    state = {'bridge': bridge, 'handlers': handlers}
    hass.data[KEY] = state
    for handler in handlers:
        intent.async_register(hass, handler)

    def close():
        bridge.closed = True
        current = hass.data.get(intent.DATA_KEY, {})
        for handler in handlers:
            if current.get(handler.intent_type) is handler:
                intent.async_remove(hass, handler.intent_type)
        if hass.data.get(KEY) is state:
            hass.data.pop(KEY)
        # HA has no view unregister API. The authenticated dispatcher stays inert
        # until the next owned registration; it never keeps a stale client alive.
    return close
