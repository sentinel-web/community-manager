import hexToRgb from './hexToRgb';

const parseColor = color => {
  // Check if the color is in hex format and convert it
  if (color.startsWith('#')) {
    return hexToRgb(color);
  }
  // Check if the color is in RGB format and extract numerical values
  if (color.startsWith('rgb')) {
    return color.match(/\d+/g).map(Number);
  }
  // Throw an error for unsupported color formats
  throw new Error('Unsupported color format');
};

export default parseColor;
