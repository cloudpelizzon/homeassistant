"""Public read-only mirror. No energy calculations or local business engine."""
import asyncio,copy,math,re,time
from datetime import datetime,timezone,timedelta

class SolarMirror:
    def __init__(self,bridge,verified_status,*,clock=None,monotonic=time.monotonic,schedule=None):
        self.bridge=bridge;self.status=verified_status;self.clock=clock or (lambda:datetime.now(timezone.utc));self.monotonic=monotonic;self.schedule=schedule
        self.entities={};self.listeners=set();self.until=None;self.started=None;self.wall=None;self.cancel=None;self.closed=False;self.lock=asyncio.Lock()
    def subscribe(self,callback):
        self.listeners.add(callback)
        return lambda:self.listeners.discard(callback)
    def notify(self):
        for callback in tuple(self.listeners):callback()
    def valid(self):
        now=self.clock();tick=self.monotonic()
        return bool(not self.closed and self.until is not None and self.wall is not None and self.started is not None
                    and self.wall-timedelta(seconds=2)<=now<self.until and 0<=tick-self.started<5)
    def invalidate(self):
        self.until=None;self.started=None;self.wall=None
        if self.cancel:self.cancel();self.cancel=None
        self.notify()
    def close(self):self.closed=True;self.bridge.close();self.invalidate()
    def row(self,eid):return copy.deepcopy(self.entities.get(eid)) if self.valid() else None
    async def refresh(self):
        async with self.lock:
            if self.closed:raise PermissionError('mirror_unloaded')
            # Keep the previous verified sample only until its original expiry.
            try:
                status=await self.status()
                # Display status is not an operation grant. evaluate() always
                # performs a fresh authenticated gateway operation separately.
                data=await self.bridge.evaluate()
                now=self.clock();row=status['modules']['CP-SOLAR']
                def at(value):
                    value=datetime.fromisoformat(value.replace('Z','+00:00'))
                    if value.tzinfo is None:raise ValueError('naive_status_time')
                    return value
                issued=at(status['issued_at']);expiry=at(status['expires_at'])
                if not (issued<expiry<=issued+timedelta(seconds=5) and -2<=(now-issued).total_seconds()<5 and now<expiry):raise PermissionError('status_expired')
                if row['phase']=='trial_active':expiry=min(expiry,at(row['blocks_at']))
                elif row['phase']!='licensed' or row['paid_confirmed'] is not True:raise PermissionError('module_not_active')
                if now>=expiry:raise PermissionError('trial_expired')
                values=data.get('entities')
                if not isinstance(values,list) or len(values)>1000:raise ValueError('entity_projection_required')
                staged={}
                for item in values:
                    if (not isinstance(item,dict) or set(item)!={'entity_id','unique_id','name','icon','kind','value','attributes'}
                        or not isinstance(item['entity_id'],str) or not re.fullmatch(r'sensor\.cloudpelizzon_energy_[a-z0-9_]{1,180}',item['entity_id'])
                        or item['unique_id']!=item['entity_id'].replace('sensor.cloudpelizzon_energy_','cp_energy_',1)
                        or item['kind'] not in ('power','energy') or item['entity_id'] in staged
                        or any(not isinstance(item[k],str) or len(item[k])>256 for k in ('name','icon'))
                        or item['value'] is not None and (type(item['value']) not in (int,float) or not math.isfinite(item['value']))
                        or not isinstance(item['attributes'],dict) or item['attributes'].get('module')!='CP-SOLAR'
                        or set(item['attributes'])-{'module','metric','configured','dependencies','mode','integration_method'}):raise ValueError('entity_projection_invalid')
                    staged[item['entity_id']]=copy.deepcopy(item)
                if self.closed:raise PermissionError('mirror_unloaded')
                if self.cancel:self.cancel();self.cancel=None
                self.entities=staged;self.until=expiry;self.wall=now;self.started=self.monotonic()
                if self.schedule:self.cancel=self.schedule(min(5,(expiry-now).total_seconds()),lambda:self.invalidate() if self.until==expiry else None)
                self.notify();return len(staged)
            except BaseException:
                self.invalidate();raise
