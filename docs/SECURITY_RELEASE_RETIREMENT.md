# CloudPelizzon — Security release and retirement gate

**Status:** release blocked pending end-to-end validation. Public HACS contains
the open-source Core only; private commercial packages must NEVER be committed
to this repository.

## Threats and invariants

1. **Revoked stays revoked:** a prior signed CP2 lease must not grant access
   after an authoritative deny. A timeout, HTTP 5xx, malformed JSON, or HTTP
   authentication failure cannot overwrite that deny. A new authenticated
   ACTIVE result and a *new validly signed CP2*, matched to activation,
   installation and license, are required to restore access.
2. **All entry points:** frontend visibility is not an authorization control.
   Protect WebSocket, HTTP, HA services, delayed callbacks, periodic tasks,
   sensors and intent/voice dispatch. A previously registered handler must
   check authorization at the point of action.
3. **No physical hazard:** CP-SECURITY must retain disarm, panic and existing
   alarms after commercial revocation. Delayed arming must check authorization
   **again after** its countdown. Reloads during an armed/pending alarm need a
   safety review and should be deferred if they interrupt emergency services.
4. **Automatic reactivation:** when Core never started a denied module, a
   subsequent successful signed authorization should restore its runtime
   without restarting all of Home Assistant, with bounded retry and no lost
   data. Check startup with license revoked.
5. **Downgrade/rollback:** a customer must not be able to return to an
   *unsupported commercial package* using a stale signed release or local
   backup after the server has raised the minimum supported version. Do not
   enforce security version floors until the validated replacement has been
   delivered and the rollback recovery plan is approved.
6. **Private supply chain:** Release Center packages must be signed, have
   verified hashes, safe extraction paths, immutable release IDs, explicit
   HA compatibility limits, and a centrally audited install/checkin history.
   Never upload private packages, private signing keys, customer secrets or
   activated CP1/CP2 credentials to public GitHub.

## Required end-to-end test matrix (PILOT before STABLE)

- License active at startup; licensed modules start and authorized API works.
- License revoked while module is running; old active CP2 cannot override it.
- Timeout/HTTP 500/unexpected response *after* revocation: still denied.
- Signed reactivation: functional module resumes without full HA reboot.
- Revoked on HA startup, then reactivated: previously skipped modules start.
- Restart after revocation: no open premium APIs or notification dispatch.
- CP-SECURITY arms only while authorized; revocation during arming cancels
  the pending action; disarm/emergency endpoints remain available.
- Network outage during normal active lease vs. outage after prior revocation:
  offline policy cannot erase an authoritative deny.
- Update interrupted halfway, signed artifact corrupted, downgrade attempt,
  unsafe path in tarball, signing key mismatch; all fail safely.
- Restore/rollback: no unsafe older commercial code becomes operational.
- Test on supported HA versions and against the actual private Release Center.

## Known GitHub release inventory (2026-10-09)

- `v6.2.9` — pre-release
- `v6.2.10`, `v6.2.11`, `v6.2.12` — previous releases
- `v6.2.13-rc.1` — **incorrectly published as normal release**, must be
  changed to pre-release or removed from latest before wider deployment.

## Retirement sequence — do NOT reverse these steps

1. Inventory installed Core versions and signed private module versions
   across the client fleet; retain essential change and audit records.
2. Validate the complete security matrix on PILOT with a private signed
   release and a compatible Core candidate; fix failures and rerun.
3. Publish one security-supported STABLE pair (Core + all eligible private
   modules). Give customers a supported update and a verified recovery route.
4. Enforce **minimum accepted Core/module versions on the PRIVATE license and
   release server**, coordinated with the client rollout. Reject obsolete
   installs/downloads, and block local rollback to unsafe versions.
5. Confirm fleet migration and emergency recovery, **then** remove vulnerable
   GitHub release entries and tags through GitHub Releases/Tags, deliberately
   leaving the newly supported STABLE. Remove accidental non-pre-release RCs.
6. Verify HACS sees only the supported public release. Retain internal
   archives/audit evidence under controlled private storage if required.
   **Deleting a GitHub release/tag does not delete copies already installed,
   downloaded artifacts, forks or public commit history.** It is not itself
   a license revocation mechanism.

No retrospective declaration that all vulnerabilities are fixed is allowed
solely because syntax tests or isolated tests have passed.
