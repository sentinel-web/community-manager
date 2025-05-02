const getLuminance = (r, g, b) => {
  // Normalize RGB values to the range [0,1] and apply gamma correction
  const [R, G, B] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  // Calculate relative luminance based on the WCAG formula
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

export default getLuminance;
