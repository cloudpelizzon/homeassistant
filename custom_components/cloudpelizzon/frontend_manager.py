"""Single frontend entry point for CloudPelizzon."""

from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant


ROOT = Path(__file__).parent

PANEL_URL = "cloudpelizzon"
PANEL_ELEMENT = "cloudpelizzon-panel"

STATIC_KEY = "cloudpelizzon_unified_frontend"


async def async_register_frontend(
    hass: HomeAssistant,
) -> None:

    if not hass.data.get(STATIC_KEY):

        paths = [
            StaticPathConfig(
                "/cloudpelizzon/frontend",
                str(ROOT / "frontend"),
                False,
            ),
            StaticPathConfig(
                "/cloudpelizzon-core/frontend",
                str(ROOT / "core" / "frontend"),
                False,
            ),
            StaticPathConfig(
                "/cloudpelizzon-updater/frontend",
                str(ROOT / "updater" / "frontend"),
                False,
            ),
        ]

        optional_paths = (
            (
                "/cloudpelizzon-maintenance/frontend",
                ROOT / "modules" / "maintenance" / "frontend",
            ),
            (
                "/cloudpelizzon-energy/frontend",
                ROOT / "modules" / "energy" / "frontend",
            ),
            (
                "/cloudpelizzon-security/frontend",
                ROOT / "modules" / "security" / "frontend",
            ),
        )

        for url, directory in optional_paths:
            if directory.is_dir():
                paths.append(
                    StaticPathConfig(
                        url,
                        str(directory),
                        False,
                    )
                )

        await hass.http.async_register_static_paths(
            paths
        )

        hass.data[STATIC_KEY] = True

    if frontend.async_panel_exists(
        hass,
        PANEL_URL,
    ):
        frontend.async_remove_panel(
            hass,
            PANEL_URL,
            warn_if_unknown=False,
        )

    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title="CloudPelizzon",
        sidebar_icon="mdi:cloud-outline",
        module_url=(
            "/cloudpelizzon/frontend/"
            "panel.js?v=20261009-reactivation-6213rc2"
        ),
        embed_iframe=False,
        trust_external=False,
        require_admin=False,
        handle_safe_area=False,
    )


def async_unregister_frontend(
    hass: HomeAssistant,
) -> None:

    frontend.async_remove_panel(
        hass,
        PANEL_URL,
        warn_if_unknown=False,
    )
