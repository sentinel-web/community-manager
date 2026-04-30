/* global describe, it */
import assert from 'node:assert';
import parseColor from '../../../imports/helpers/colors/parseColor';

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
    const color = 'invalid-color';
    assert.throws(() => parseColor(color), { message: 'Unsupported color format' });
  });

  it('throws an error for invalid hex color', () => {
    const hex = '#gggggg';
    assert.throws(() => parseColor(hex), { message: 'Invalid hex color' });
  });

  it('throws an error for invalid RGB color', () => {
    const rgb = 'rgb(invalid)';
    // This will return null from match, causing an error when mapping
    assert.throws(() => parseColor(rgb));
  });

  it('parses RGB color without spaces', () => {
    const rgb = 'rgb(255,128,0)';
    const expectedRgb = [255, 128, 0];
    assert.deepStrictEqual(parseColor(rgb), expectedRgb);
  });

  it('parses RGBA color (ignores alpha)', () => {
    const rgba = 'rgba(255, 0, 0, 0.5)';
    // Only extracts the RGB values, alpha is captured but we only use first 3
    const result = parseColor(rgba);
    assert.strictEqual(result[0], 255);
    assert.strictEqual(result[1], 0);
    assert.strictEqual(result[2], 0);
  });
});
