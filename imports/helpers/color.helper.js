function getLuminance(r, g, b) {
  // Normalize RGB values to the range [0,1] and apply gamma correction
  const [R, G, B] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  // Calculate relative luminance based on the WCAG formula
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function hexToRgb(hex) {
  // Remove the leading '#' if present
  let modifiedHex = hex.replace(/^#/, '');
  // Convert shorthand hex (e.g., #abc) to full-length (e.g., #aabbcc)
  if (modifiedHex.length === 3) {
    modifiedHex = modifiedHex
      .split('')
      .map(x => x + x)
      .join('');
  }
  // Convert hex to RGB values
  const num = Number.parseInt(modifiedHex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function parseColor(color) {
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
}

export function getLegibleTextColor(backgroundColor) {
  // Convert input color to RGB values
  const [r, g, b] = parseColor(backgroundColor);
  // Calculate luminance to determine contrast
  const luminance = getLuminance(r, g, b);
  // Return black or white text based on luminance threshold
  return luminance > 0.5 ? 'black' : 'white';
}
