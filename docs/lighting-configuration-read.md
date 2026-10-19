# CP-LIGHTING configuration presentation adapter

Last updated: 2026-10-19. Staging only. No native route, installation, Trial offer,
device action, database migration or private server registration is enabled.

## Existing response, not a replacement configuration service

The public adapter consumes the existing `lighting.config.read` pagination
contract. Its input is `{offset, limit}`. Its response contains `revision`,
`rooms`, `items`, `total` and `preferences`. Items retain `entity_id`, local `name`,
`kind`, reported configuration `capabilities`, `visible`, `room_id` and `icon`.
Preferences retain the selected `grafite`, `flux` or `neo-soft` identifier.

`loadLightingConfiguration({readPage, signal})` requests pages of at most 100
items, with a total defensive bound of 2,000 bindings. It publishes no partial
result. A changed revision, room list, theme or total across pages fails closed,
as do duplicate bindings, incomplete pages and unsupported response fields.
An edit during pagination requires a fresh user-requested refresh, not an
unbounded retry. This does not implement a distributed database snapshot.

## Connection to the existing read session

The optional `readConfigurationPage(parameters, {signal})` constructor port of
`LightingReadSession` is paired with its existing `readSnapshot` port. The latter
continues to supply authorized live states and a presentation grant. The session
joins the configuration pages with those states and passes the result to the
existing read-only renderer. The enclosing deadline covers both providers;
closing or invalidating the session discards pending and late responses.

Both ports are **in-process host interfaces**, not registered public endpoints.
The native host must derive the authenticated actor and installation from its
trusted session, enforce current access on every request, sign through the real
SDK and filter both metadata and states for current entity permissions. It must
invalidate on disconnection, revocation or identity changes. No actor ID,
installation ID, proof, secret or backend error body is accepted from UI port
parameters. The JavaScript grant is only a presentation hint, never authority.

## Presentation behavior

Existing local names, room labels, icon identifiers, visibility and theme choice
are retained without writing to HA or creating another configuration store.
Unbound live entities do not create new bindings. Missing state for an otherwise
authorized binding is shown as unavailable, never silently as off. A host must
remove unauthorized metadata before this point; absence of a state is not proof
that the viewer may read its configuration.

Stored switch bindings already classified as lights retain their original
`switch.*` IDs and have on/off-only presentation. Merely discovering a switch
does not classify it. The renderer accepts the `configured_switch` presentation
marker only for this read-only path; that marker is not proof of approval or
permission to operate a device. Presence-sensor bindings remain configuration
metadata, not lamps. Explicitly hidden lights are not added to the visible lamp
count. Configuration summary fields report total bindings, hidden lights and
sensor bindings separately. Every visible lamp remains an individual card.

No command handler, dimmer control, custom automation engine, measured-power
estimate, favorite field or ordering field is implemented. Theme identifiers are
preserved, but the three final theme dashboards are still separate work. Unknown
new configuration fields require contract review rather than silent data loss.

## Validation and release hold

The public suite adds 23 synthetic cases to the existing 28-case test entry point.
Coverage includes pagination, schema errors, cancellation, metadata preservation,
configured switches, excluded sensors, missing states and provider-to-view flow.
A separate private local test exercises the supplied original configuration
service and bridge with synthetic authorization/inventory, then feeds their real
response pages into this adapter. No private source, SQLite file or fixture from
that private test is included in this repository.

These checks do not reproduce signed SDK integration, native HA identity,
physical control or the seven-day Trial lifecycle. Those require the private
runtime, its registration and native session adapters. Keep the PR in draft and
resolve parallel base-branch conflicts separately, without force-pushing or
changing production.
