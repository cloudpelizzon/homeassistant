"""Refresh consented Fleet metadata without registering a new identity or trial."""
import asyncio
import time,json,traceback
from datetime import timedelta
import logging
import re

from homeassistant.const import __version__ as HA_VERSION
from homeassistant.core import callback
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.loader import async_get_integration

from .public_onboarding.protocol import FLEET_URL, fleet_ack
from .owner_profile155 import owner_display_name

_LOGGER = logging.getLogger(__name__)


def start(hass, entry):
    """Return an unload callback; never delay integration setup on Fleet."""
    data = entry.data
    if (data.get('fleet_reporting_consent') is not True
            or data.get('fleet_registered') is not True
            or data.get('fleet_registration_mode') != 'free'):
        return lambda: None
    pending = None
    closed = False
    ready = False  # CP_PERIODIC441

    async def report():
        status={'schema':'cp.delivery453.v1','started_at':int(time.time()),'phase':'identity','acknowledged':False,'telemetry_included':False}
        try:
            saved = await Store(hass, 1, 'cloudpelizzon_core.data',
                                private=True, atomic_writes=True).async_load()
            if not isinstance(saved, dict):
                status['identity_error']='store_missing'
                return
            iid, secret = saved.get('installation_id'), saved.get('fleet_free_secret')
            if (type(iid) is not str or not re.fullmatch('[0-9a-f]{32}', iid)
                    or iid != data.get('fleet_installation_id')
                    or type(secret) is not str or not re.fullmatch('[0-9a-f]{64}', secret)):
                status['identity_error']='invalid_identity_or_secret'
                return
            status['phase']='integration_metadata'
            integration = await async_get_integration(hass, 'cloudpelizzon')
            payload = {'mode': 'free', 'installation_id': iid, 'registration_secret': secret,
                       'fleet_reporting_consent': True,
                       'cloudpelizzon_version': str(integration.version or ''),
                       'ha_version': HA_VERSION}
            # Existing installations without name consent are never opted in by an update.
            if data.get('fleet_owner_name_consent') is True:
                payload['ha_admin_name'] = await owner_display_name(hass)
            # CP_TELEMETRY437
            status['phase']='collection'
            try:
                from .telemetry437 import collect
                payload['telemetry437'] = collect(hass)
                status['telemetry_included']=True
                value=payload['telemetry437']
                status['collection']={'measured_at':value.get('measured_at'),'ha_running':value.get('ha_running'),'usage_present':isinstance(value.get('usage444'),dict),'details_present':isinstance(value.get('details447'),dict)}
                try:
                    _validate453(value)
                    status['collection']['receiver_schema_valid']=True
                except Exception as exc:
                    status['collection']['receiver_schema_valid']=False
                    status['collection']['schema_error']=_error453(exc)
                # Diagnostic validation never alters, filters or replaces the payload.

            except Exception as exc:
                status['collection_error']=_error453(exc)
                _LOGGER.debug('Operational telemetry unavailable; metadata reporting continues')
            status['phase']='delivery'
            session = async_get_clientsession(hass)
            async with asyncio.timeout(12):
                async with session.post(FLEET_URL, json=payload, allow_redirects=False) as response:
                    status['http_status']=response.status
                    raw = await response.content.read(8193)
                    fleet_ack(response.status, response.headers.get('Content-Type', ''), raw, iid)
                    status.update(phase='acknowledged',acknowledged=True)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            status['error']=_error453(exc)
            # Do not log responses, identifiers, local storage or shared secrets.
            _LOGGER.debug('Fleet metadata refresh unavailable; will retry on the next interval')

        finally:
            status['finished_at']=int(time.time())
            try:
                await Store(hass,1,'cloudpelizzon_delivery453',private=True,atomic_writes=True).async_save(status)
            except Exception as exc:
                _LOGGER.warning('CloudPelizzon report diagnostic storage failed: %s',type(exc).__name__)

    @callback
    def schedule(_now=None):
        nonlocal pending
        if not closed and ready and (pending is None or pending.done()):
            pending = hass.async_create_task(report(), 'CloudPelizzon Fleet metadata')

    unsubscribe = async_track_time_interval(hass, schedule, timedelta(seconds=60))
    @callback
    def started(_hass):
        nonlocal ready
        ready = True
        schedule()

    unsubscribe_started = async_at_started(hass, started)

    def close():
        nonlocal closed
        closed = True
        unsubscribe()
        unsubscribe_started()
        if pending is not None:
            pending.cancel()

    return close

import json, time, re
'Strict aggregate-only operational scope schema.'
import re

def _usage453(value, enabled_total):
    if not isinstance(value, dict) or value.get('schema') != 'cp.usage444.v1' or value.get('policy') != 'operational_v1':
        raise ValueError('usage_schema_invalid')
    keys = ('monitored', 'diagnostic', 'configuration', 'excluded_label', 'review', 'auxiliary')
    selection = value.get('selection')
    entities = value.get('entities')
    groups = value.get('integrations')

    def valid(row, fields):
        return isinstance(row, dict) and all((type(row.get(k)) is int and 0 <= row[k] <= 1000000 for k in fields))
    ek = ('total', 'available', 'unavailable', 'unknown')
    if not valid(selection, keys) or sum((selection[k] for k in keys)) != enabled_total:
        raise ValueError('usage_selection_partition_invalid')
    if not valid(entities, ek) or entities['total'] != selection['monitored'] or sum((entities[k] for k in ek[1:])) != entities['total']:
        raise ValueError('usage_entities_partition_invalid')
    if not isinstance(groups, list) or len(groups) > 20:
        raise ValueError('usage_integrations_invalid')
    cleaned = []
    seen = set()
    for group in groups:
        if not valid(group, ek) or not isinstance(group.get('domain'), str) or (not re.fullmatch('[a-z0-9_]{1,64}', group['domain'])) or (group['domain'] in seen) or (sum((group[k] for k in ek[1:])) != group['total']):
            raise ValueError('usage_integrations_invalid')
        seen.add(group['domain'])
        cleaned.append({k: group[k] for k in ('domain', *ek)})
    if any((sum((group[k] for group in cleaned)) != entities[k] for k in ek)):
        raise ValueError('usage_integrations_partition_invalid')
    return {'schema': value['schema'], 'policy': value['policy'], 'selection': {k: selection[k] for k in keys}, 'entities': {k: entities[k] for k in ek}, 'integrations': cleaned}
'Bounded optional diagnostics, validated after authenticated Fleet collection.'
import re

def _details453(value, usage, now):

    def check(ok):
        if not ok:
            raise ValueError('diagnostic_details447_invalid')
    check(isinstance(value, dict) and value.get('schema') == 'cp.details447.v1' and isinstance(usage, dict))
    groups = value.get('kinds')
    check(isinstance(groups, list) and len(groups) <= 50)
    rows = []
    seen = set()
    for g in groups:
        check(isinstance(g, dict) and isinstance(g.get('domain'), str) and re.fullmatch('[a-z_]{1,64}', g['domain']) and (g['domain'] not in seen))
        keys = ('total', 'available', 'unavailable', 'unknown')
        check(all((type(g.get(k)) is int and 0 <= g[k] <= 1000000 for k in keys)))
        check(g['total'] == g['available'] + g['unavailable'] + g['unknown'])
        seen.add(g['domain'])
        rows.append({k: g[k] for k in ('domain', *keys)})
    check(all((sum((g[k] for g in rows)) == usage['entities'][k] for k in ('total', 'available', 'unavailable', 'unknown'))))
    issues = value.get('issues')
    review = value.get('review_examples')
    check(isinstance(issues, list) and len(issues) <= 200 and isinstance(review, list) and (len(review) <= 50))
    entity = lambda v: isinstance(v, str) and re.fullmatch('[a-z_]{1,64}\\.[a-z0-9_]{1,190}', v)
    cleaned = []
    seen = set()
    counts = {g['domain']: g for g in rows}
    for issue in issues:
        check(isinstance(issue, dict) and entity(issue.get('entity_id')) and (issue['entity_id'] not in seen) and (issue.get('status') in ('unavailable', 'unknown')) and isinstance(issue.get('origin'), str) and re.fullmatch('[a-z0-9_]{1,64}', issue['origin']))
        check(issue['entity_id'].partition('.')[0] in counts)
        seen.add(issue['entity_id'])
        cleaned.append({k: issue[k] for k in ('entity_id', 'origin', 'status')})
    check(len(cleaned) <= usage['entities']['unavailable'] + usage['entities']['unknown'])
    for domain, g in counts.items():
        for status in ('unavailable', 'unknown'):
            check(sum((i['status'] == status and i['entity_id'].startswith(domain + '.') for i in cleaned)) <= g[status])
    check(all((entity(v) and v.partition('.')[0] in ('sensor', 'binary_sensor') for v in review)) and len(set(review)) == len(review) and (len(review) <= usage['selection']['review']))
    backup = value.get('backup')
    check(isinstance(backup, dict) and type(backup.get('observed')) is bool and all((k in backup for k in ('last_success_at', 'last_attempt_at'))))
    for key in ('last_success_at', 'last_attempt_at'):
        check(backup.get(key) is None or (type(backup[key]) is int and 946684800 <= backup[key] <= now + 30))
    return {'schema': 'cp.details447.v1', 'kinds': rows, 'issues': cleaned, 'review_examples': review, 'backup': {k: backup[k] for k in ('observed', 'last_success_at', 'last_attempt_at')}}

def _validate453(value, now=None):
    now = int(time.time()) if now is None else now
    if not isinstance(value, dict) or value.get('schema') != 'cp.ha.telemetry437.v1':
        raise ValueError('telemetry_schema_invalid')
    stamp = value.get('measured_at')
    if type(stamp) is not int or not now - 180 <= stamp <= now + 30:
        raise ValueError('telemetry_clock_invalid')
    if type(value.get('ha_running')) is not bool:
        raise ValueError('telemetry_running_invalid')
    result = {'schema': value['schema'], 'measured_at': stamp, 'ha_running': value['ha_running']}
    groups = {'entries': ('loaded', 'failed', 'pending'), 'cloudpelizzon': ('loaded', 'failed', 'pending'), 'entities': ('total', 'available', 'unavailable', 'unknown', 'assumed'), 'devices': ('total', 'available', 'partial', 'unavailable', 'unknown', 'disabled')}
    for name, keys in groups.items():
        group = value.get(name)
        if not isinstance(group, dict):
            raise ValueError('telemetry_counts_invalid')
        if any((type(group.get(k)) is not int or not 0 <= group[k] <= 1000000 for k in keys)):
            raise ValueError('telemetry_counts_invalid')
        result[name] = {k: group[k] for k in keys}
        if name in ('entities', 'devices'):
            parts = ('available', 'unavailable', 'unknown') if name == 'entities' else ('available', 'partial', 'unavailable', 'unknown')
            if sum((group[k] for k in parts)) != group['total']:
                raise ValueError('telemetry_partition_invalid')
        if name == 'entities' and group['assumed'] > group['unknown']:
            raise ValueError('telemetry_partition_invalid')
    connectors = value['cloudpelizzon'].get('connectors', [])
    if not isinstance(connectors, list) or len(connectors) > 30 or any((not isinstance(v, str) or not re.fullmatch('CP-[A-Z0-9-]{1,60}', v) for v in connectors)):
        raise ValueError('telemetry_connectors_invalid')
    result['cloudpelizzon']['connectors'] = sorted(set(connectors))
    inventory = value.get('module_inventory443')
    if inventory is not None:
        if not isinstance(inventory, list) or len(inventory) > 30:
            raise ValueError('telemetry_inventory_invalid')
        rows = []
        seen = set()
        for module in inventory:
            if not isinstance(module, dict) or module.get('sku') not in ('CP-SOLAR', 'CP-MAINTENANCE', 'CP-SECURITY', 'CP-AUTOMATION', 'CP-LIGHTING') or type(module.get('imported')) is not bool or (module.get('state') not in ('runtime_loaded', 'interface_loaded', 'not_observed')):
                raise ValueError('telemetry_inventory_invalid')
            if module['sku'] in seen or (module['state'] != 'not_observed' and (not module['imported'])):
                raise ValueError('telemetry_inventory_invalid')
            seen.add(module['sku'])
            rows.append({k: module[k] for k in ('sku', 'imported', 'state')})
        result['module_inventory443'] = rows
    if value.get('usage444') is not None:
        result['usage444'] = _usage453(value['usage444'], result['entities']['total'])
    if value.get('details447') is not None:
        result['details447'] = _details453(value['details447'], result.get('usage444'), now)
    return result

def _error453(exc):
    out={'class':type(exc).__name__,'frames':[{'file':f.filename.rsplit('/',1)[-1].rsplit('\\',1)[-1],'line':f.lineno,'function':f.name} for f in traceback.extract_tb(exc.__traceback__)[-5:]]}
    # Only error codes generated by the reviewed schema; never messages from IO.
    if isinstance(exc,ValueError) and re.fullmatch(r'(?:telemetry|usage|diagnostic)_[a-z_]{1,70}',str(exc)):out['schema_code']=str(exc)
    return out
