import hexToRgb from './hexToRgb';

const parseColor = (color: string): [number, number, number] => {
  if (color.startsWith('#')) {
    return hexToRgb(color);
  }
  if (color.startsWith('rgb')) {
    const nums = color.match(/\d+/g)?.map(Number);
    if (!nums || nums.length < 3) throw new Error('Invalid RGB color');
    return [nums[0], nums[1], nums[2]];
  }
  throw new Error('Unsupported color format');
};

export default parseColor;
