const hexToRgb = (hex: string): [number, number, number] => {
  let modifiedHex = hex.replace(/^#/, '');
  if (modifiedHex.length === 3) {
    modifiedHex = modifiedHex
      .split('')
      .map(x => x + x)
      .join('');
  }
  if (!/^[0-9A-Fa-f]{6}$/.test(modifiedHex)) {
    throw new Error('Invalid hex color');
  }
  const num = Number.parseInt(modifiedHex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

export default hexToRgb;
