"""Bounded, memory-only coalescing of signed status/capability control requests."""
import base64,copy,functools,json,threading,time
from datetime import datetime,timezone
from cryptography.hazmat.primitives.serialization import Encoding,PublicFormat
_LOCK=threading.RLock();_ROWS={};_FLIGHTS={};_ERRORS={}

def expiry(result,action):
    value=result[0]
    if action=='status':claim=value['claims']
    else:
        token=value['token'];raw=token.split('.')[1];claim=json.loads(base64.urlsafe_b64decode(raw+'='*((-len(raw))%4)))
    instant=datetime.fromisoformat(claim['expires_at'].replace('Z','+00:00'))
    if instant.tzinfo is None:raise ValueError('timezone_required')
    return instant.timestamp()

def wrap(original,Error):
    @functools.wraps(original)
    def control(client,action,extra=None):
        if action not in ('status','capability'):return original(client,action,extra)
        public=client._key.public_key().public_bytes(Encoding.Raw,PublicFormat.Raw)
        authority=client._authority.public_bytes(Encoding.Raw,PublicFormat.Raw)
        key=(client._iid,public,authority,action,json.dumps(extra or {},sort_keys=True,separators=(',',':')))
        while True:
            wall=client._clock().timestamp();tick=time.monotonic()
            with _LOCK:
                failure=_ERRORS.get(key)
                if failure and 0<=tick-failure[0]<2:raise Error(failure[1])
                row=_ROWS.get(key)
                if row and row['wall']-2<=wall<row['expiry']-.25 and 0<=tick-row['tick']<row['ttl']:
                    return copy.deepcopy(row['value'])
                event=_FLIGHTS.get(key)
                if event is None:
                    event=threading.Event();_FLIGHTS[key]=event;break
            if not event.wait(12):raise Error('control_request_in_progress')
        try:
            value=original(client,action,extra)
            try:
                end=expiry(value,action);now=client._clock().timestamp()
                ttl=1.8 if action=='status' else 8.0
                if end-now>.3:
                    with _LOCK:
                        if len(_ROWS)>512:_ROWS.clear()
                        _ROWS[key]={'value':copy.deepcopy(value),'expiry':end,'wall':now,'tick':time.monotonic(),'ttl':ttl}
            except (KeyError,ValueError,TypeError,IndexError):pass
            with _LOCK:_ERRORS.pop(key,None)
            return value
        except Exception as error:
            code=str(error) if len(str(error))<100 and str(error).replace('_','').isalnum() else 'control_temporarily_unavailable'
            with _LOCK:
                if len(_ERRORS)>512:_ERRORS.clear()
                _ERRORS[key]=(time.monotonic(),code)
            raise
        finally:
            with _LOCK:_FLIGHTS.pop(key,None);event.set()
    return control
