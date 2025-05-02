import parseColor from '../../../imports/helpers/colors/parseColor';
import assert from 'node:assert';

describe('parseColor', () => {
  it('parses hex color to RGB values', () => {
    const hex = '#ff0000';
    const expectedRgb = [255, 0, 0];
    assert.deepStrictEqual(parseColor(hex), expectedRgb);
  });

  it('parses hex color with shorthand notation to RGB values', () => {
    const hex = '#f00';
    const expectedRgb = [255, 0, 0];
    assert.deepStrictEqual(parseColor(hex), expectedRgb);
  });

  it('parses RGB color to RGB values', () => {
    const rgb = 'rgb(255, 0, 0)';
    const expectedRgb = [255, 0, 0];
    assert.deepStrictEqual(parseColor(rgb), expectedRgb);
  });

  it('throws an error for unsupported color format', () => {
    const color = ' invalid-color';
    assert.throws(() => parseColor(color), Error, 'Unsupported color format');
  });

  it('throws an error for invalid hex color', () => {
    const hex = '# invalid-color';
    assert.throws(() => parseColor(hex), Error, 'Invalid hex color');
  });

  it('throws an error for invalid RGB color', () => {
    const rgb = 'rgb( invalid-color)';
    assert.throws(() => parseColor(rgb), Error, 'Invalid RGB color');
  });
});
