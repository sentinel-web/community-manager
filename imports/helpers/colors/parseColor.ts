import hexToRgb from './hexToRgb';

const RGB_PATTERN = /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/i;

/**
 * Parses a hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`) or `rgb()`/`rgba()` color into RGB channels.
 * Alpha is ignored. Returns `undefined` for empty, named or malformed colors — never throws.
 */
const parseColor = (color?: string | null): [number, number, number] | undefined => {
  const value = color?.trim();
  if (!value) return undefined;
  if (value.startsWith('#')) {
    return hexToRgb(value);
  }
  const match = RGB_PATTERN.exec(value);
  if (!match) return undefined;
  const channels = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (channels.some(c => c > 255)) return undefined;
  return [channels[0], channels[1], channels[2]];
};

export default parseColor;
