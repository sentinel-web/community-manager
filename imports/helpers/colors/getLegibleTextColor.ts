import getLuminance from './getLuminance';
import parseColor from './parseColor';

const BLACK_LUMINANCE = 0;
const WHITE_LUMINANCE = 1;

const contrastRatio = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * Returns the text color (black or white) with the higher WCAG contrast ratio against `backgroundColor`.
 * The crossover sits at a relative luminance of ~0.179. Returns `undefined` for empty or unparseable
 * colors so callers fall back to the theme's default text color — never throws.
 */
const getLegibleTextColor = (backgroundColor?: string | null): 'black' | 'white' | undefined => {
  const rgb = parseColor(backgroundColor);
  if (!rgb) return undefined;
  const luminance = getLuminance(...rgb);
  return contrastRatio(luminance, BLACK_LUMINANCE) >= contrastRatio(luminance, WHITE_LUMINANCE) ? 'black' : 'white';
};

export default getLegibleTextColor;
