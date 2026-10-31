"""Consented module observations, separate from authoritative trial grants/dates."""
import asyncio
import re
import time
from .public_core.metadata import MODULES
from .public_core.projection import validate_claim
from datetime import datetime, timezone

PHASES = frozenset(('not_started', 'not_entitled', 'trial_active', 'trial_blocked', 'trial_removal_due', 'licensed'))


async def collect(hass, context, inventory=()):
    """Query status only. Never activate, renew, enroll, or infer a start date."""
    if (not isinstance(context, dict) or not callable(context.get('fetch_verified'))
            or not isinstance(context.get('trial_id'), str)
            or not re.fullmatch(r'[A-Za-z0-9_.:-]{1,128}', context['trial_id'])):
        raise ValueError('tracking_context_unavailable')
    observed = {row['sku'] for row in inventory if isinstance(row, dict)
                and row.get('imported') is True and row.get('sku') in MODULES}
    observed.update(sku for sku, meta in MODULES.items()
                    if any(e.domain == meta['domain'] for e in hass.config_entries.async_entries()))
    records = {}
    verified = False
    try:
        async with asyncio.timeout(4):
            claim = await context['fetch_verified']()
        if claim.get('installation_id') != context['trial_id']:
            raise ValueError('tracking_identity_mismatch')
        records = validate_claim(claim, datetime.now(timezone.utc))
        verified = True
    except asyncio.CancelledError:
        raise
    except Exception:
        # An outage is unknown status, never evidence that trials ended.
        records = {}
    skus = sorted(set(MODULES) | set(records))
    return {'schema': 'cp.module.tracking591.v1', 'measured_at': int(time.time()),
            'trial_identity': context['trial_id'], 'status_verified': verified,
            'modules': [{'sku': sku, 'installed': sku in observed,
                         'phase': records.get(sku, {}).get('phase', 'unknown'),
                         'blocks_at': records.get(sku, {}).get('blocks_at'),
                         'removal_due_at': records.get(sku, {}).get('removal_due_at')}
                        for sku in skus]}
