/**
 * Parses `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` (leading `#` optional) into RGB channels.
 * Alpha is ignored. Returns `undefined` for anything else — never throws, because callers run during render.
 */
const hexToRgb = (hex: string): [number, number, number] | undefined => {
  let digits = hex.replace(/^#/, '');
  if (!/^(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(digits)) {
    return undefined;
  }
  if (digits.length <= 4) {
    digits = digits
      .split('')
      .map(x => x + x)
      .join('');
  }
  const num = Number.parseInt(digits.slice(0, 6), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

export default hexToRgb;
