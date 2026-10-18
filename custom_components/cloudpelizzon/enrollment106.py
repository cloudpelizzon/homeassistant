"""Prove existing identities to the first-party enrollment service. Never start trials."""
import asyncio
import hashlib
from pathlib import Path
import re
import secrets
import time

from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.storage import Store
from .diagnostics import public_identity
from .public_onboarding.key import public_existing,sign_existing
from .public_onboarding.protocol import canonical

URL='https://api.cloudpelizzon.com.br/v1/installation/enroll'


async def ensure(hass,entry,context):
    data=entry.data
    if (data.get('fleet_reporting_consent') is not True or data.get('fleet_registered') is not True
        or data.get('fleet_installation_id')!=context['core_id']):
        raise PermissionError('existing_Fleet_consent_required')
    if not context['trial_id'].startswith('cp-ha-'):
        # Existing legacy identities keep their operator-approved pairing flow.
        return False
    saved=await Store(hass,1,'cloudpelizzon_core.data',private=True,atomic_writes=True).async_load()
    secret=saved.get('fleet_free_secret') if isinstance(saved,dict) else None
    if (type(secret) is not str or not re.fullmatch('[a-f0-9]{64}',secret)
        or saved.get('installation_id')!=context['core_id']):raise PermissionError('existing_Fleet_identity_required')
    meta=await hass.async_add_executor_job(public_identity,Path(hass.config.path()))
    if (meta['installation_id']!=context['trial_id'] or context['trial_id']!='cp-ha-'+meta['public_key_sha256']):
        raise PermissionError('existing_trial_identity_mismatch')
    folder=Path(hass.config.path('.cp-trial-phase2-enrollment')).absolute()
    pub=await hass.async_add_executor_job(public_existing,folder)
    claim={'schema':'cp.enrollment106.v1','aud':'https://cliente.cloudpelizzon.com.br',
        'installation_id':context['core_id'],'portal_public_key_hex':pub,
        'trial_public_key_hex':meta['public_key_hex'],'trial_id':context['trial_id'],
        'iat':int(time.time()),'nonce':secrets.token_hex(32),'timezone':hass.config.time_zone}
    portal=await hass.async_add_executor_job(sign_existing,folder,b'CP-PORTAL-ENROLL106\n'+canonical(claim))
    trial=await hass.async_add_executor_job(context['client'].enrollment_proof,claim)
    body={'claim':claim,'registration_secret':secret,'portal_signature':portal.hex(),'trial_signature':trial}
    async with asyncio.timeout(15):
        async with async_get_clientsession(hass).post(URL,json=body,allow_redirects=False) as response:
            raw=await response.content.read(8193)
            if (response.status!=200 or len(raw)>8192
                or response.headers.get('Content-Type','').split(';')[0].lower()!='application/json'):
                raise PermissionError('verified_enrollment_unavailable')
            import json
            ack=json.loads(raw)
    if (type(ack) is not dict or ack.get('ok') is not True or ack.get('installation_id')!=context['core_id']
        or ack.get('portal_registered') is not True or ack.get('trial_identity_registered') is not True
        or ack.get('trial_started') is not False):raise PermissionError('invalid_enrollment_ack')
    return True
