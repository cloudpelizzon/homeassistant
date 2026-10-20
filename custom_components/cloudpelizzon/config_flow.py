"""Configure the public Core without starting or renewing module trials."""
import asyncio
import probatio
from homeassistant import config_entries
from homeassistant.core import callback
from .homolog_mirror.options import HomologOptionsFlow
from .setup import enroll_free
from .owner_profile155 import OwnerNameRequired

DOMAIN = 'cloudpelizzon'


class CloudPelizzonConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return HomologOptionsFlow()

    VERSION = 1
    MINOR_VERSION = 0

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if self._async_current_entries():
            return self.async_abort(reason='already_configured')
        errors = {}
        if user_input is not None:
            if user_input.get('consent') is not True:
                errors['base'] = 'consent_required'
            else:
                try:
                    data = await enroll_free(self.hass, user_input)
                except asyncio.CancelledError:
                    raise
                except PermissionError:
                    errors['base'] = 'registration_rejected'
                except OwnerNameRequired:
                    errors['base'] = 'owner_name_required'
                except ValueError:
                    errors['base'] = 'identity_invalid'
                except Exception:
                    errors['base'] = 'cannot_connect'
                else:
                    self._abort_if_unique_id_configured()
                    return self.async_create_entry(title='CloudPelizzon', data=data)
        return self.async_show_form(step_id='user', data_schema=probatio.Schema({
            probatio.Required('consent', default=False): bool}), errors=errors)
