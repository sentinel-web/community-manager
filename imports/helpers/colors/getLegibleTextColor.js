import getLuminance from './getLuminance';
import parseColor from './parseColor';

const getLegibleTextColor = backgroundColor => {
  // Convert input color to RGB values
  const [r, g, b] = parseColor(backgroundColor);
  // Calculate luminance to determine contrast
  const luminance = getLuminance(r, g, b);
  // Return black or white text based on luminance threshold
  return luminance > 0.5 ? 'black' : 'white';
};

export default getLegibleTextColor;
