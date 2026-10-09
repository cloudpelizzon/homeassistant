"""Frontend panel for CloudPelizzon Update Center."""
from pathlib import Path
from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
FRONTEND_URL="/cloudpelizzon-updater/frontend"; PANEL_URL="cloudpelizzon-updates"; PANEL_ELEMENT="cloudpelizzon-updater-panel"; STATIC_KEY="cloudpelizzon_updater_static"
async def async_register_frontend(hass):
    if not hass.data.get(STATIC_KEY):
        await hass.http.async_register_static_paths([StaticPathConfig(FRONTEND_URL,str(Path(__file__).parent/"frontend"),False)]); hass.data[STATIC_KEY]=True
    if frontend.async_panel_exists(hass,PANEL_URL): frontend.async_remove_panel(hass,PANEL_URL,warn_if_unknown=False)
    await panel_custom.async_register_panel(hass,frontend_url_path=PANEL_URL,webcomponent_name=PANEL_ELEMENT,sidebar_title="Atualizações",sidebar_icon="mdi:update",module_url=f"{FRONTEND_URL}/panel.js?v=100",embed_iframe=False,trust_external=False,require_admin=True,handle_safe_area=False)
def async_unregister_frontend(hass): frontend.async_remove_panel(hass,PANEL_URL,warn_if_unknown=False)
