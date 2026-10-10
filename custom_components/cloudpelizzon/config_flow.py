"""CloudPelizzon configuration: mandatory Portal-linked Fleet enrollment."""
from __future__ import annotations

from uuid import uuid4

import voluptuous as vol
from homeassistant import config_entries

from .fleet_enrollment import (
    FleetEnrollmentRejected,
    FleetEnrollmentUnavailable,
    async_enroll,
)

DOMAIN = "cloudpelizzon"


class CloudPelizzonConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Require authoritative Fleet registration for each NEW config entry."""

    VERSION = 1
    MINOR_VERSION = 1

    def __init__(self) -> None:
        self._installation_id = uuid4().hex

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        errors = {}
        if user_input is not None:
            if user_input.get("consent") is not True:
                errors["base"] = "consent_required"
            else:
                try:
                    await async_enroll(
                        self.hass,
                        installation_id=self._installation_id,
                        code=str(user_input["code"]),
                    )
                except FleetEnrollmentRejected:
                    errors["base"] = "invalid_code"
                except FleetEnrollmentUnavailable:
                    errors["base"] = "fleet_unavailable"
                else:
                    return self.async_create_entry(
                        title="CloudPelizzon",
                        data={
                            "fleet_registered": True,
                            "fleet_installation_id": self._installation_id,
                            "fleet_reporting_consent": True,
                            "fleet_enrollment_schema": 1,
                        },
                    )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required("code"): str,
                vol.Required("consent", default=False): bool,
            }),
            errors=errors,
        )
