import getLuminance from './getLuminance';
import parseColor from './parseColor';

const getLegibleTextColor = (backgroundColor: string): 'black' | 'white' => {
  const [r, g, b] = parseColor(backgroundColor);
  const luminance = getLuminance(r, g, b);
  return luminance > 0.5 ? 'black' : 'white';
};

export default getLegibleTextColor;
