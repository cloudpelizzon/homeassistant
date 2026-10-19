# CP-LIGHTING UI inventory review

Last updated: 2026-10-19. Status: staging only; no commercial activation.

## Reviewed changes

The unchanged read-only projection now resides at `staging/lighting/projection.mjs`.
The experimental `custom_components/cloudpelizzon/ui/lighting/projection.mjs`
location is removed. The read-only renderer developed offline is retained at
`staging/lighting/readonly-view.mjs`, with its existing appearance and behavior.
Both files are outside the installed Home Assistant integration. No static route,
menu registration, device service, module readiness flag or UI inventory is added.

The source manifest is updated using SHA-256 of the exact candidate bytes. Its
release and functional-acceptance flags remain false. The sealed Home Assistant
`ui_inventory.json` and all existing active UI assets remain unchanged by this
increment. The public source verification is not relaxed or bypassed.

## Reproducible checks

- `node tests/public-client/test_lighting_projection.mjs staging/lighting/projection.mjs`
- `node --test tests/public-client/test_lighting_readonly_view.mjs`
- `python3 tools/verify_public_tree.py` in a full Git checkout.
- The existing HACS, hassfest and native Home Assistant CI checks remain required.

The renderer suite retains eight offline tests and adds four checks for the
projection-to-view connection, replacement by a locked view, staging isolation
and candidate inventory hashes. Inputs are synthetic. These tests do not prove
real backend authorization, live device control or completed installation.

## Authorization and product hold

`gateway_verified`, `locked` and the sample grant objects are presentation hints,
not authentication or a licensing implementation. No private signature validation,
trial clock, commercial engine, entitlement decision or server credential is
implemented or published here. Private readiness and authorization must be
reviewed before any real data or command route is connected to this UI.

The seven-day Trial and all expiry/revocation decisions remain server-owned.
No Trial can be started by these files. Following denial, the presentation shows
only overview/contracting text; no operational controls are implemented.
Measured consumption, device capabilities, consented commands and per-installation
entitlements still require separately reviewed integration and homologation.

Keep the pull request in draft. Do not merge, tag, release, deploy or enable the
module on the strength of these presentation tests. Reconcile parallel changes
from the base branch separately, preserving their manifests and active adapters.
