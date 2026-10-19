// Public, read-only UI projection. Commercial authorization is server-enforced.
export const LIGHTING_SKU = "CP-LIGHTING";
const LIGHT_ENTITY = /^light\.[a-z0-9_]+$/;
const UNKNOWN = "unknown";
const EMPTY_COUNTS = Object.freeze({total: 0, on: 0, off: 0, unavailable: 0, unknown: 0});

function readableLabel(value, fallback) {
  if (typeof value !== "string") return fallback;
  const label = value.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 120);
  return label || fallback;
}

// A transport/UI hint, never a backend entitlement check. The private gateway
// must validate the claim and independently authorize every commercial RPC.
export function hasLightingViewAccess(grant) {
  if (!grant || grant.sku !== LIGHTING_SKU || grant.gateway_verified !== true) return false;
  if (grant.license?.allowed === true) return true;
  return grant.trial?.verified === true
    && grant.trial?.phase === "trial_active"
    && grant.trial?.paid_confirmed === false;
}

export function projectLightingSnapshot(states, grant, areaByEntity = {}) {
  const empty = () => ({
    sku: LIGHTING_SKU,
    locked: true,
    lights: [],
    counts: {...EMPTY_COUNTS},
    measured_power_w: null
  });
  if (!hasLightingViewAccess(grant)) return empty();

  const deduplicated = new Map();
  const values = states && typeof states === "object" && !Array.isArray(states)
    ? Object.values(states) : [];
  const areas = areaByEntity && typeof areaByEntity === "object" && !Array.isArray(areaByEntity)
    ? areaByEntity : {};
  for (const entity of values) {
    if (!entity || typeof entity !== "object" || !LIGHT_ENTITY.test(entity.entity_id ?? "")) continue;
    const attrs = entity.attributes && typeof entity.attributes === "object" ? entity.attributes : {};
    const id = entity.entity_id;
    const state = ["on", "off", "unavailable", "unknown"].includes(entity.state)
      ? entity.state : UNKNOWN;
    const brightness = attrs.brightness;
    const brightness_pct = state === "on" && typeof brightness === "number"
      && Number.isFinite(brightness) && brightness >= 0 && brightness <= 255
      ? Math.round(brightness * 100 / 255) : null;
    deduplicated.set(id, {
      entity_id: id,
      name: readableLabel(attrs.friendly_name, id.slice(6).replaceAll("_", " ")),
      area: readableLabel(areas[id], "Sem ambiente"),
      state,
      available: state === "on" || state === "off",
      brightness_pct
    });
  }
  const lights = [...deduplicated.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", {numeric: true, sensitivity: "base"})
      || a.entity_id.localeCompare(b.entity_id)
  );
  const counts = {...EMPTY_COUNTS, total: lights.length};
  for (const light of lights) counts[light.state] += 1;
  return {
    sku: LIGHTING_SKU,
    locked: false,
    lights, // Always flat: areas annotate lights rather than nesting or hiding them.
    counts,
    measured_power_w: null // Never infer watts from brightness or switch state.
  };
}
