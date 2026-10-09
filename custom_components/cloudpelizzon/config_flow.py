"""CloudPelizzon unified configuration flow."""

from __future__ import annotations

from homeassistant import config_entries


DOMAIN = "cloudpelizzon"


class CloudPelizzonConfigFlow(
    config_entries.ConfigFlow,
    domain=DOMAIN,
):
    """Single CloudPelizzon integration."""

    VERSION = 1
    MINOR_VERSION = 0

    async def async_step_user(
        self,
        user_input=None,
    ):
        await self.async_set_unique_id(
            DOMAIN
        )

        self._abort_if_unique_id_configured()

        return self.async_create_entry(
            title="CloudPelizzon",
            data={},
        )
