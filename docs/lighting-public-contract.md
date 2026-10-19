# CP-LIGHTING public presentation contract (draft)

Scope: UI-only read projection for a future CloudPelizzon Lighting module.
This file is intentionally public and contains no operational engine, signing
keys, backend entitlement policy, hostnames, or private deployment logic.

## Safety boundary

- The module SKU is CP-LIGHTING. No UI route, backend command, trial offer,
  device actuation, installation, or server-side module is enabled here.
- The server remains the sole authority for licenses and trials. The projection
  is not a licensing implementation and never authenticates a token.
- Until the private gateway explicitly supplies verified module readiness and
  enforces every RPC independently, the view must remain inaccessible.
- In particular, a missing, unverified, expired, or mismatched grant yields
  a locked projection with an empty entity list.
- Seven-day trial timing, revocation, expiration and purchase are server-owned.
  Client-side clocks and local Home Assistant entities never extend a trial.
- Following expiry, only the overview and purchase journey can be offered by
  the surrounding platform; the commercial module stays blocked.

## Projection properties

- Read-only data input comes from Home Assistant light domain entities.
- Every eligible light remains in one flat, independently addressable list.
  Area metadata is an annotation, not a collapsible parent gate.
- Counts separate on, off, unavailable and unknown; unavailable must never
  be silently reclassified as off.
- Brightness is displayed only when a valid device attribute exists.
- No synthetic power estimate is produced. A later reviewed sensor mapping
  may expose measured energy only where a real compatible sensor exists.
- All device commands, including seemingly harmless toggles, are out of
  scope until a private authorization gateway is reviewed and homologated.

## Release hold

This is a staging-only building block, not a tested installation or
functional acceptance. Keep PR in draft. Require server contract review,
integration tests, end-to-end entitlement checks, and homologation before
considering a module release.

## Read-session increment — 2026-10-19

`staging/lighting/read-session.mjs` connects an injected read-only transport to
this projection and the existing renderer. It starts locked, coalesces concurrent
refresh calls, bounds each request, aborts on invalidation/close and ignores late
responses. Missing providers, malformed responses and failures produce an empty
locked view. Error details are not copied to presentation state. No retry timer,
background polling, device action, HTTP URL, token store or fallback to
`hass.states` is installed.

The **draft in-process port**, not a registered network API, is
`readSnapshot({signal}) -> {sku, grant, states, areas?}`. `states` is a map keyed
by the unchanged `light.*` entity ID; each row must carry that same ID. `areas`
contains already-reviewed display labels. The port must return only entities the
authenticated user may read and must independently enforce current authorization
for the installation, SKU and operation on every request. A browser `grant` is
only a display hint, never proof of signature, entitlement or module readiness.

The native host must recreate the reader after user/installation changes, invoke
`invalidate()` on disconnect/denial/revocation and replace its rendered view from
`session.snapshot`. `refresh()` temporarily exposes a locked loading view rather
than relying on stale authorization. The returned snapshots are immutable; the
host must not retain and redisplay an earlier unlocked snapshot after invalidation.
The UI is not the security boundary: private authorization remains mandatory.

`staging/lighting/capabilities.mjs` reads HA `supported_color_modes`, rejects
unsupported combinations and distinguishes dimming, color and white/temperature
support. Temperature limits and the current kelvin value are displayed only
when the device actually reports valid values. No default kelvin range or watt
estimate is fabricated. A residual brightness attribute on an on/off-only light
is not shown as dimming support. This is a capability projection, not permission
to operate the hardware.

The payload bounds (2,000 entries, 512 KiB and a request deadline of up to 30 s)
are defensive transport limits, **not commercial license/Trial limits**. A request
exceeding them fails closed; pagination must be agreed with the private contract
before supporting larger responses. Tests include a flat 150-light snapshot.

## Product and compatibility constraints

Grafite, FLUX and NEO SOFT remain the selected interchangeable dashboards with a
shared configuration. This increment neither implements those final themes nor
replaces the approved design direction with the current generic preview.
Existing bindings, local names, rooms, icons, favorites, order and visibility must
be preserved by the configuration adapter. Discovery requires review, must not
rename HA entities and must not create duplicate bindings. Switches/relays are not
automatically treated as lights by this reader.

No automation engine, editor, accounting subsystem, independent energy metrics
or floor-plan interpretation is added. Those responsibilities remain outside this
presentation module. The counter is only a summary of the supplied light states.

At the reviewed parallel platform commit
`aeb7d00814e5720203ae0d1051f2d1074ea96f07`, the signed client SKU allowlist does not
include CP-LIGHTING. This increment deliberately does not modify that allowlist,
register an endpoint or pretend that the private gateway is ready. The actual
lighting configuration/authorization contract and its mapper must be retrieved
and reconciled before connecting the native port; no operation name is invented
here. Parallel main changes are inspected, not merged or overwritten.

## Reproducible validation

- `node --test tests/public-client/test_lighting_read_session.mjs`: 16 synthetic
  cases for capability handling, lifecycle races, cancellation and input bounds.
- `node --test tests/public-client/test_lighting_readonly_view.mjs`: the existing
  12 tests plus the 16 read-session cases, via a test-module import.
- The unchanged full CI continues to require public hashes, HACS, hassfest and
  native HA setup. Presentation tests do not prove live session authentication,
  signed gateway acceptance, device actuation or seven-day Trial expiration.

Technical reference for HA attributes: https://contributors.home-assistant.io/core/entities/light/
