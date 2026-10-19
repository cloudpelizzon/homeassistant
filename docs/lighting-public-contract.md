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
