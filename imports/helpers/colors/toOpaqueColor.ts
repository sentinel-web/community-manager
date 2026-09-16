import parseColor from './parseColor';

/**
 * Drops the alpha channel from a color so it can be painted and measured as the same value:
 * `#rgba`/`#rrggbbaa` and `rgba(…)` become their opaque equivalent. Colors without alpha are returned
 * unchanged, and an empty or unparseable color returns `undefined` so callers can fall back.
 */
const toOpaqueColor = (color?: string | null): string | undefined => {
  if (!color) return undefined;
  const trimmed = color.trim();
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(trimmed)) return trimmed;

  const rgb = parseColor(trimmed);
  if (!rgb) return undefined;
  return `#${rgb.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
};

export default toOpaqueColor;
