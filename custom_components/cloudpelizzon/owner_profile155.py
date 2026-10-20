"""Owner display name for explicitly accepted Fleet installation registration."""
import asyncio

class OwnerNameRequired(ValueError):
    """The required HA owner profile could not be read."""

async def owner_display_name(hass):
    try:
        users = await hass.auth.async_get_users()
    except asyncio.CancelledError:
        raise
    except Exception as error:
        raise OwnerNameRequired('owner_name_unavailable') from error
    owner = next((user for user in users if user.is_active and user.is_owner
                  and not user.system_generated), None)
    name = ''.join(char for char in str(owner.name or '').strip()
                   if char.isprintable()).strip()[:80] if owner else ''
    if not name:
        raise OwnerNameRequired('owner_name_required')
    return name
