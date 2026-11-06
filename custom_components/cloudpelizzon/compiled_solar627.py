"""Native-license Solar mirror; original projection validation is preserved."""
import asyncio,copy,math,re
from datetime import datetime,timedelta,timezone
async def refresh(self):
    async with self.lock:
        if self.closed:
            raise PermissionError('mirror_unloaded')
        try:
            runtime = self._compiled627_runtime
            if runtime.closed:
                raise PermissionError('compiled_solar_unloaded')
            before = await asyncio.to_thread(runtime.namespace.guard.verify, 'CP-SOLAR', runtime.iid)
            data = await self.bridge.evaluate()
            after = await asyncio.to_thread(runtime.namespace.guard.verify, 'CP-SOLAR', runtime.iid)
            now = self.clock()
            expiry = now + timedelta(seconds=5)
            if before['license_id'] != after['license_id'] or before['license_revision'] != after['license_revision']:
                raise PermissionError('compiled_solar_entitlement_changed')
            if after['expires_at'] is not None:
                expiry = min(expiry, datetime.fromtimestamp(after['expires_at'], timezone.utc))
            if now >= expiry:
                raise PermissionError('compiled_solar_expired')
            values = data.get('entities')
            if not isinstance(values, list) or len(values) > 1000:
                raise ValueError('entity_projection_required')
            staged = {}
            for item in values:
                if not isinstance(item, dict) or set(item) != {'entity_id', 'unique_id', 'name', 'icon', 'kind', 'value', 'attributes'} or (not isinstance(item['entity_id'], str)) or (not re.fullmatch('sensor\\.cloudpelizzon_energy_[a-z0-9_]{1,180}', item['entity_id'])) or (item['unique_id'] != item['entity_id'].replace('sensor.cloudpelizzon_energy_', 'cp_energy_', 1)) or (item['kind'] not in ('power', 'energy')) or (item['entity_id'] in staged) or any((not isinstance(item[k], str) or len(item[k]) > 256 for k in ('name', 'icon'))) or (item['value'] is not None and (type(item['value']) not in (int, float) or not math.isfinite(item['value']))) or (not isinstance(item['attributes'], dict)) or (item['attributes'].get('module') != 'CP-SOLAR') or (set(item['attributes']) - {'module', 'metric', 'configured', 'dependencies', 'mode', 'integration_method'}):
                    raise ValueError('entity_projection_invalid')
                staged[item['entity_id']] = copy.deepcopy(item)
            if self.closed:
                raise PermissionError('mirror_unloaded')
            if self.cancel:
                self.cancel()
                self.cancel = None
            self.entities = staged
            self.until = expiry
            self.wall = now
            self.started = self.monotonic()
            if self.schedule:
                self.cancel = self.schedule(min(5, (expiry - now).total_seconds()), lambda: self.invalidate() if self.until == expiry else None)
            self.notify()
            return len(staged)
        except BaseException:
            self.invalidate()
            raise
