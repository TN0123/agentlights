export const PRESETS = [
  { name: 'Indigo',     hex: '#2a2733' },
  { name: 'Slate',      hex: '#2a2d33' },
  { name: 'Navy',       hex: '#232838' },
  { name: 'Teal',       hex: '#1f2e2e' },
  { name: 'Forest',     hex: '#232b25' },
  { name: 'Plum',       hex: '#2e2433' },
  { name: 'Charcoal',   hex: '#262626' },
  { name: 'Slate Blue', hex: '#252a35' },
  { name: 'Sage',       hex: '#2a2e28' },
  { name: 'Deep Rose',  hex: '#332428' },
];

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidHex(s) {
  return typeof s === 'string' && HEX_RE.test(s);
}

export function normalizeHex(s) {
  if (!isValidHex(s)) {
    throw new Error(`Not a valid hex color: ${s}`);
  }
  const lower = s.toLowerCase();
  if (lower.length === 7) return lower;
  // #rgb -> #rrggbb
  return '#' + lower.slice(1).split('').map((c) => c + c).join('');
}
