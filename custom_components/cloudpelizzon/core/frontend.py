"""Frontend registration for CloudPelizzon Core."""
from pathlib import Path
from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

FRONTEND_URL = "/cloudpelizzon-core/frontend"
PANEL_URL = "cloudpelizzon"
PANEL_ELEMENT = "cloudpelizzon-core-panel"
STATIC_PATH = Path(__file__).parent / "frontend"
STATIC_KEY = "cloudpelizzon_core_frontend_static"

async def async_register_frontend(hass: HomeAssistant) -> None:
    if not hass.data.get(STATIC_KEY):
        await hass.http.async_register_static_paths([StaticPathConfig(FRONTEND_URL, str(STATIC_PATH), False)])
        hass.data[STATIC_KEY] = True
    if frontend.async_panel_exists(hass, PANEL_URL):
        frontend.async_remove_panel(hass, PANEL_URL, warn_if_unknown=False)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title="CloudPelizzon",
        sidebar_icon="mdi:cloud-outline",
        module_url=f"{FRONTEND_URL}/panel.js?v=0120",
        embed_iframe=False,
        trust_external=False,
        require_admin=False,
        handle_safe_area=False,
    )

def async_unregister_frontend(hass: HomeAssistant) -> None:
    frontend.async_remove_panel(hass, PANEL_URL, warn_if_unknown=False)
