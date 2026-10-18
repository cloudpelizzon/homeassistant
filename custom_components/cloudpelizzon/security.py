"""Wire public Security configuration/management only. No physical executor."""
from collections.abc import Mapping
from .adapters.security.configuration import api as configuration
from .adapters.security.engines import api as engines
from .adapters.security.engines.bridge import EngineBridge


async def create(hass,entry,context):
    # A pre-existing physical option must not silently become active at cutover.
    delivery=entry.options.get('security_delivery',{})
    if (not isinstance(delivery,Mapping) or delivery.get('enabled',False) is not False
            or entry.options.get('security_shadow_control',False) is not False):
        raise ValueError('security_delivery_requires_separate_acceptance')
    closes=[]
    try:
        closes.append(configuration.register(hass,context['client'],shadow_control=False))
        bridge=EngineBridge.from_client(hass,context['client'])
        closes.append(bridge.close)
        closes.append(engines.register(hass,bridge))
    except BaseException:
        for close in reversed(closes):close()
        raise
    closed=False
    def close():
        nonlocal closed
        if closed:return
        closed=True
        for callback in reversed(closes):callback()
    return close
