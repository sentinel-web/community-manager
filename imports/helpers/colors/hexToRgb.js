const hexToRgb = hex => {
  // Remove the leading '#' if present
  let modifiedHex = hex.replace(/^#/, '');
  // Convert shorthand hex (e.g., #abc) to full-length (e.g., #aabbcc)
  if (modifiedHex.length === 3) {
    modifiedHex = modifiedHex
      .split('')
      .map(x => x + x)
      .join('');
  }
  // Validate hex format
  if (!/^[0-9A-Fa-f]{6}$/.test(modifiedHex)) {
    throw new Error('Invalid hex color');
  }
  // Convert hex to RGB values
  const num = Number.parseInt(modifiedHex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

export default hexToRgb;
