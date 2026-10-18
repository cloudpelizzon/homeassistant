"""Public CloudPelizzon client candidate for preprovisioned installations."""
import logging
from pathlib import Path
from homeassistant.exceptions import ConfigEntryNotReady
from .runtime import DOMAIN, OWNER, Runtime
from .ui_inventory import PublicInventoryMismatch
from homeassistant.helpers import config_validation as cv

LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass, config):
    return True


async def async_setup_entry(hass, entry):
    manager = Runtime(hass, entry)
    try:
        await manager.start()
    except Exception as error:
        # Never log exception text, locals, request payloads or private key data.
        frames = []
        tb = error.__traceback__
        root = Path(__file__).resolve().parent
        while tb is not None:
            try:
                relative = Path(tb.tb_frame.f_code.co_filename).resolve().relative_to(root)
            except ValueError:
                pass
            else:
                frames.append(f'{relative.as_posix()}:{tb.tb_lineno}')
            tb = tb.tb_next
        location = ' > '.join(frames) or 'external_dependency'
        detail = f'{manager.stage}; {type(error).__name__}; {location}'
        if type(error) is PublicInventoryMismatch:
            detail += f'; unexpected_public_file={error.public_detail}'
        LOGGER.error('CloudPelizzon initialization failed: %s', detail)
        raise ConfigEntryNotReady(f'CloudPelizzon initialization failed: {detail}') from None
    return True


async def async_unload_entry(hass, entry):
    state = hass.data.get(DOMAIN)
    manager = state.get(OWNER) if isinstance(state, dict) else None
    if not isinstance(manager, Runtime) or manager.entry.entry_id != entry.entry_id:
        return False
    return await manager.unload()
