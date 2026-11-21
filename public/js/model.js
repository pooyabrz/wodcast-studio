// Shared schema. Explicit field copying prevents prototype and arbitrary URL injection.
export const VERSION = '1.1.0';
export const FONT_STACKS = {
  sans: 'Arial, Helvetica, sans-serif',
  mono: '"Courier New", Courier, monospace',
  serif: 'Georgia, "Times New Roman", serif'
};
export const DEFAULT_CONFIG = {
  version: 1,
  content: {
    title: 'WODCAST', subtitle: 'TRAIN TOGETHER. GET STRONGER.',
    event: 'FRIDAY ENGINE', freeText: 'YOUR WORKOUT. LIVE.',
    wod: '12 MIN AMRAP\n10 Air Squats\n8 Push-ups\n6 Burpees',
    trainer: 'Coach Alex', notes: 'Move well. Find your pace.\nEvery rep counts.',
    timeZone: 'UTC', logoUrl: '/assets/wodcast-mark.svg'
  },
  timer: { mode: 'countdown', durationSec: 720, prestartSec: 10, rounds: 8, workSec: 20, restSec: 10 },
  theme: {
    accent: '#b0f15b', textColor: '#ffffff', timerColor: '#ffffff',
    panelOpacity: 0.83, font: 'sans', align: 'left',
    titleSize: 38, eventSize: 24, subtitleSize: 18, freeTextSize: 20,
    textSize: 28, coachSize: 22, notesSize: 18, clockSize: 15, timerSize: 132,
    warningColors: true, yellowAt: 30, redAt: 10, animate: true
  },
  visible: { logo: true, title: true, subtitle: true, freeText: true, timer: true, round: true, wod: true, trainer: true, notes: true, clock: true },
  zones: {
    left: { x: 48, y: 800, width: 480, height: 232, visible: true },
    center: { x: 690, y: 48, width: 540, height: 250, visible: true },
    right: { x: 1484, y: 48, width: 388, height: 690, visible: true }
  }
};
export const PRESETS = {
  amrap: { mode: 'countdown', durationSec: 720, prestartSec: 10, rounds: 8, workSec: 20, restSec: 10 },
  emom: { mode: 'interval', durationSec: 600, prestartSec: 10, rounds: 10, workSec: 60, restSec: 0 },
  tabata: { mode: 'interval', durationSec: 240, prestartSec: 10, rounds: 8, workSec: 20, restSec: 10 }
};
export const TEXT_LIMITS = { title: 100, subtitle: 160, event: 100, freeText: 240, wod: 1600, trainer: 100, notes: 400, timeZone: 80, logoUrl: 300 };
export const THEME_RANGES = {
  panelOpacity: [0, 1], titleSize: [18, 80], eventSize: [14, 60], subtitleSize: [12, 40],
  freeTextSize: [12, 40], textSize: [16, 60], coachSize: [14, 40], notesSize: [12, 40],
  clockSize: [12, 32], timerSize: [56, 200], yellowAt: [0, 600], redAt: [0, 600]
};
export const clone = value => JSON.parse(JSON.stringify(value));
function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
}
function number(value, key, min, max, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${key} must be ${integer ? 'an integer ' : ''}between ${min} and ${max}.`);
  }
  return value;
}
function boolean(value, key) {
  if (typeof value !== 'boolean') throw new Error(`${key} must be true or false.`);
  return value;
}
function choice(value, key, options) {
  if (!options.includes(value)) throw new Error(`Invalid ${key}.`);
  return value;
}
export function sanitizeConfig(patch, base = DEFAULT_CONFIG) {
  record(patch, 'Configuration');
  if (Object.hasOwn(patch, 'version') && patch.version !== 1) throw new Error('Unsupported configuration version.');
  const next = clone(base);
  for (const key of ['content', 'timer', 'theme', 'visible', 'zones']) if (Object.hasOwn(patch, key)) record(patch[key], key);
  if (patch.content) {
    for (const [key, max] of Object.entries(TEXT_LIMITS)) if (Object.hasOwn(patch.content, key)) {
      const value = patch.content[key];
      if (typeof value !== 'string' || value.length > max) throw new Error(`${key} must be text with at most ${max} characters.`);
      next.content[key] = value;
    }
    try { new Intl.DateTimeFormat('en-GB', { timeZone: next.content.timeZone }); }
    catch { throw new Error('Unknown time zone.'); }
    if (!/^(?:|\/assets\/wodcast-mark\.svg|\/uploads\/logo-[a-f\d]{24}\.(?:png|jpg|webp))$/.test(next.content.logoUrl)) throw new Error('Use the logo upload control instead of an external URL.');
  }
  if (patch.timer) {
    if (Object.hasOwn(patch.timer, 'mode')) next.timer.mode = choice(patch.timer.mode, 'timer mode', ['countdown', 'stopwatch', 'interval']);
    for (const [key, min, max] of [['durationSec', 1, 86400], ['prestartSec', 0, 120], ['rounds', 1, 200], ['workSec', 1, 3600], ['restSec', 0, 3600]]) {
      if (Object.hasOwn(patch.timer, key)) next.timer[key] = number(patch.timer[key], key, min, max, true);
    }
  }
  if (patch.theme) {
    for (const [key, range] of Object.entries(THEME_RANGES)) if (Object.hasOwn(patch.theme, key)) next.theme[key] = number(patch.theme[key], key, ...range);
    for (const key of ['accent', 'textColor', 'timerColor']) if (Object.hasOwn(patch.theme, key)) {
      if (typeof patch.theme[key] !== 'string' || !/^#[a-f\d]{6}$/i.test(patch.theme[key])) throw new Error(`${key} must be a six-digit hex color.`);
      next.theme[key] = patch.theme[key];
    }
    for (const key of ['warningColors', 'animate']) if (Object.hasOwn(patch.theme, key)) next.theme[key] = boolean(patch.theme[key], key);
    if (Object.hasOwn(patch.theme, 'font')) next.theme.font = choice(patch.theme.font, 'font', Object.keys(FONT_STACKS));
    if (Object.hasOwn(patch.theme, 'align')) next.theme.align = choice(patch.theme.align, 'alignment', ['left', 'center', 'right']);
    if (next.theme.redAt > next.theme.yellowAt) throw new Error('Red warning must be at or below the yellow warning.');
  }
  if (patch.visible) for (const key of Object.keys(next.visible)) if (Object.hasOwn(patch.visible, key)) next.visible[key] = boolean(patch.visible[key], key);
  if (patch.zones) for (const key of Object.keys(next.zones)) if (Object.hasOwn(patch.zones, key)) {
    const zone = patch.zones[key]; record(zone, key);
    for (const [field, min, max] of [['x', 0, 1920], ['y', 0, 1080], ['width', 180, 1920], ['height', 100, 1080]]) {
      if (Object.hasOwn(zone, field)) next.zones[key][field] = number(zone[field], `${key}.${field}`, min, max, true);
    }
    if (Object.hasOwn(zone, 'visible')) next.zones[key].visible = boolean(zone.visible, `${key}.visible`);
    const result = next.zones[key];
    if (result.x + result.width > 1920 || result.y + result.height > 1080) throw new Error(`${key} zone must stay within 1920 x 1080.`);
  }
  return next;
}
