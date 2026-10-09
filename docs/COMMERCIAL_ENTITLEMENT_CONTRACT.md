# CloudPelizzon commercial entitlement enforcement contract

**Scope:** every customer installation, every distribution channel, all 17 catalog SKUs
(the 14 planned SKUs must remain unavailable until developed).

## Authority and lifecycle

- HACS distributes only public Core + Updater. Commercial source remains private.
- Entitlements are per installation and per SKU, granted by signed CP1 and a valid
  activation with CP2 online lease. A local module directory is **not** a license.
- Core ControlLayer runs in `enforce` mode; `audit` is not permitted for customer
  execution authorization.
- Server-issued `revoked`, `expired`, `invalid`, `installation_mismatch`,
  `not_registered` override existing local leases and offline grace.
- Offline grace is considered only for expired CP2 leases without an authoritative
  denial. Offline clients cannot learn about new revocations until connectivity
  returns; do not promise instantaneous offline revocation.
- Check-in revalidates in the background at most every 5 minutes. A privileged
  forced refresh can revalidate sooner, subject to a 10-second flood guard.

## Required checks at *every* commercial entry point

Public shared helper: `cloudpelizzon.core.commercial_guard.is_module_authorized(hass, sku)`.

1. **WebSocket**: Core automatically guards newly registered commercial
   WebSocket commands during module bootstrap. All registered commercial routes
   must be present in the captured set and protected before customers can use them.
2. **Authenticated HTTP/REST**: the commercial package *must* call the helper
   at the start of every handler before reading or changing business data.
   A static HTTPS endpoint or authenticated HA user alone is insufficient.
3. **Services, intents and dispatchers**: the package *must* call the helper at
   each invocation. `hass.services.async_call` must not be invoked for a
   commercial operation unless that operation is authorized.
4. **Background jobs, schedulers and engines**: the package *must* call the
   helper before every periodic run and again before any externally visible
   dispatch (e.g., Alexa, notifications). Startup-only checks are insufficient.
5. **Frontend**: refresh the authoritative rights before opening and
   periodically while displaying commercial modules. UI hiding is not a
   substitute for backend enforcement.

Example, within a commercial module HTTP handler or job:

```python
from custom_components.cloudpelizzon.core.commercial_guard import is_module_authorized

if not await is_module_authorized(hass, "CP-MAINTENANCE"):
    return  # HTTP handlers should return their proper 403 response
```

Use the correct SKU for the module. A denied call must not execute the
original side effect. Never delete customer-owned business records on revocation.
The files of a paid module may remain on disk, but the backend must not process
unauthorized activity.

## Mandatory private release gates

Before publishing any `stable` commercial package:
- Independently verify HTTP, WS, service and worker routes against the shared
  helper (include regression tests for active/revoked/re-activated states).
- Inspect actual private package code; public HACS tests cannot prove private
  handlers are protected.
- Validate exact signed package hash, compatibility, rollback and installer.
- Confirm downloads, installs and active module reports are separate audit events.
- Observe a real client-like installation. Tests performed in VM 105 are
  *representative*, not a special-case implementation.
- Keep production `stable` unchanged until this contract is satisfied.

## Important exception

The original CP-MAINTENANCE Alexa HTTP handler already calls the local
`is_module_allowed()` helper, which reads locally cached license state.
Migrate that handler to the shared async helper above so it can trigger a
rate-limited online check. CP-MAINTENANCE's notification engine currently needs
explicit checks at `async_process()` and `async_dispatch()` in its **private
package**. The Core alone cannot guarantee control of previously registered
arbitrary Python jobs and HTTP handlers.
