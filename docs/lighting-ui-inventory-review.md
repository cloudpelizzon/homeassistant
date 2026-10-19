# CP-LIGHTING UI inventory review

Status: staging only. The existing projection at `ui/lighting/projection.mjs` is not listed in the sealed Home Assistant UI inventory or registered static routes. It must not be shipped in that location. Move the draft projection outside the active `ui/` tree, or complete an independently reviewed inventory and route integration after private gateway and licensing readiness. Do not publish or activate the commercial module, allow device commands, or expose source code for private engines.

Acceptance gate: verify that the public asset inventory still passes in the candidate Home Assistant integration before release. Keep any pull request in draft.
