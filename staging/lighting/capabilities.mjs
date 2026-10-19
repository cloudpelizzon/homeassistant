// Last updated: 2026-10-19. Public HA attribute projection, not authorization.
const COLOR = new Set(['hs', 'xy', 'rgb', 'rgbw', 'rgbww']);
const MODES = new Set(['onoff', 'brightness', 'color_temp', 'white', ...COLOR]);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => typeof value === 'number' && Number.isSafeInteger(value);

/** Report only capabilities declared by HA. Never infer hardware from its name. */
export function projectLightingCapabilities(entity) {
  const attributes = record(entity?.attributes) ? entity.attributes : {};
  const raw = attributes.supported_color_modes;
  const valid = Array.isArray(raw) && raw.length > 0 && raw.length <= MODES.size
    && raw.every(mode => typeof mode === 'string' && MODES.has(mode))
    && new Set(raw).size === raw.length
    && (!raw.includes('onoff') || raw.length === 1)
    && (!raw.includes('brightness') || raw.length === 1)
    && (!raw.includes('white') || raw.some(mode => COLOR.has(mode)));
  const modes = valid ? [...raw].sort() : [];
  const brightness = modes.some(mode => mode !== 'onoff');
  const color = modes.some(mode => COLOR.has(mode));
  const colorTemp = modes.includes('color_temp');
  const min = attributes.min_color_temp_kelvin;
  const max = attributes.max_color_temp_kelvin;
  const boundsValid = colorTemp && integer(min) && integer(max)
    && min > 0 && max > min;
  const current = attributes.color_temp_kelvin;
  const currentValid = entity?.state === 'on' && boundsValid
    && attributes.color_mode === 'color_temp' && integer(current)
    && current >= min && current <= max;
  return Object.freeze({
    reported: valid,
    supported_color_modes: Object.freeze(modes),
    brightness,
    color,
    color_temperature: colorTemp,
    white: modes.includes('white'),
    min_color_temp_kelvin: boundsValid ? min : null,
    max_color_temp_kelvin: boundsValid ? max : null,
    color_temp_kelvin: currentValid ? current : null,
  });
}
