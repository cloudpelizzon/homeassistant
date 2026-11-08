# 7.0.7 public candidate review

This is a development candidate, not an approved release or a functional acceptance of Finance.

## Reviewed boundary

The original candidate changed 33 files: 27 additions and 6 modifications. Its public source inventory was still at 7.0.6. This correction reviews the changed content before updating either inventory.

- Removed the plaintext Finance integration implementation from the candidate. The public HA adapter now requires `finance_integrations651` and `_cp_finance_guard653` inside the signed, compiled native package. No public implementation is used as a fallback.
- Removed local financial calculations from the Finance UI. The UI formats and displays values supplied by the backend. Missing projections, comparisons or aggregate values are shown as unavailable, not as invented zeroes.
- Excluded nine Finance JPEGs whose redistribution rights and synthetic-data provenance were not established. They are not required by the current UI.
- Kept the signed-package verifier, authenticated HA transport, forms, CSS, local spreadsheet export and public licensing policy. The public package contains no newly added native binary, private signing key, customer database or real installation license.
- Finance is excluded from the legacy compiled-module registration loop. Its separate data store and registration must not disrupt the existing modules.
- Opening integration settings no longer saves defaults, selects recipients or schedules collection/messages. Without a saved configuration the returned sources and notification destinations are disabled.
- Native package compatibility, hashes, required modules, entitlement time, installation identity and installation public key are checked before reaching the native initializer. These checks complement, and do not replace, authorization inside the private engine.

## Remaining release gates

`RELEASE_READY` remains false and the public source manifest records `release_allowed=false`. Installation and Trial fail before network requests or local identity writes. A successful public CI does not remove this gate.

The private package must be rebuilt and signed with the existing integration implementation, with explicit opt-in for collection and notifications. Its module contract, entitlement enforcement, offline startup, Trial duration/reinstall behavior, native HA permissions, recovery and compatibility with the existing modules must be verified. Only then may its reviewed release pin and readiness change together. No private implementation or signing material belongs in this repository.

The presentation uses existing `overview.projections`, `dashboards.maintenance_forecast`, `state.utility_costs` and individual dashboard values. Extra presentation fields such as aggregate totals and market comparisons are optional, not claims that the current binary implements them. Their absence is an explicit unavailable state. Utilization percentages and warning states must also come from the backend; the UI does not infer financial thresholds from raw values. Filtered maintenance rows do not create new forecasts in the browser.

The original commit already existed in a public repository. Removing files from this candidate does not erase their earlier Git history or copies. No history rewriting or production change is part of this correction.

## Validation scope

The new tests use synthetic identities, ephemeral signing keys and fake native boundaries. They never load a commercial engine, start a real Trial, send notifications, access a bank or issue physical-device commands. The regular public-client, HACS and native HA workflows must run on the final corrected commit. Private end-to-end acceptance remains a separate prerequisite.
