"""Mount only verified UI assets and retain the original CloudPelizzon panel."""
from pathlib import Path
from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from .ui_inventory import ROUTES, verify

STATIC_KEY = 'cloudpelizzon_public_static73'
PANEL_KEY = 'cloudpelizzon_public_panel73'
URL = 'cloudpelizzon'
EXTRA_BRAND_URL = '/cloudpelizzon-core/frontend/hacs-brand-compat.js?v=39cd41964a7c'


def marker(hass):
    return hass.data.get(getattr(frontend, 'DATA_PANELS', 'frontend_panels'), {}).get(URL)


async def register(hass, root):
    verified = await hass.async_add_executor_job(verify, root)
    previous = hass.data.get(STATIC_KEY)
    if previous is not None and previous != verified:
        raise ValueError('static_paths_changed_restart_required')
    if PANEL_KEY in hass.data or frontend.async_panel_exists(hass, URL):
        raise ValueError('existing_panel_must_not_be_overwritten')
    if previous is None:
        paths = [StaticPathConfig(url, str(Path(verified['root'])/relative), False)
                 for url, relative in ROUTES.items()]
        await hass.http.async_register_static_paths(paths)
        # HA does not unregister its HTTP static resources during entry reload.
        hass.data[STATIC_KEY] = verified
    state = {'panel': None,'extra':False}

    def close():
        if hass.data.get(PANEL_KEY) is state:
            hass.data.pop(PANEL_KEY, None)
        if state['panel'] is not None and marker(hass) is state['panel']:
            frontend.async_remove_panel(hass, URL, warn_if_unknown=False)
        state['panel'] = None
        if state['extra']:
            frontend.remove_extra_js_url(hass,EXTRA_BRAND_URL)
            state['extra']=False

    hass.data[PANEL_KEY] = state
    try:
        await panel_custom.async_register_panel(hass,
            frontend_url_path=URL, webcomponent_name='cloudpelizzon-panel',
            sidebar_title='CloudPelizzon', sidebar_icon='mdi:cloud-outline',
            module_url='/cloudpelizzon/frontend/panel.js?v=72c4d538eb1d',
            embed_iframe=False, trust_external=False, require_admin=False,
            handle_safe_area=False)
        state['panel'] = marker(hass)
        if state['panel'] is None:
            raise RuntimeError('panel_registration_not_confirmed')
        frontend.add_extra_js_url(hass,EXTRA_BRAND_URL)
        state['extra']=True
    except BaseException:
        close()
        raise
    return close
