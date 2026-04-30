/* global describe, it */
import assert from 'node:assert';
import hexToRgb from '../../../imports/helpers/colors/hexToRgb';

describe('hexToRgb', () => {
  it('converts hex color to RGB values', () => {
    const hex = '#ff0000';
    const expectedRgb = [255, 0, 0];
    assert.deepStrictEqual(hexToRgb(hex), expectedRgb);
  });

  it('converts hex color with shorthand notation to RGB values', () => {
    const hex = '#f00';
    const expectedRgb = [255, 0, 0];
    assert.deepStrictEqual(hexToRgb(hex), expectedRgb);
  });

  it('removes leading # from hex color', () => {
    const hex = 'ff0000';
    const expectedRgb = [255, 0, 0];
    assert.deepStrictEqual(hexToRgb(hex), expectedRgb);
  });

  it('throws an error for invalid hex color', () => {
    const hex = 'invalid-color';
    assert.throws(() => hexToRgb(hex), { message: 'Invalid hex color' });
  });

  it('handles hex color with uppercase letters', () => {
    const hex = '#FF0000';
    const expectedRgb = [255, 0, 0];
    assert.deepStrictEqual(hexToRgb(hex), expectedRgb);
  });

  it('handles hex color with lowercase letters', () => {
    const hex = '#ff0000';
    const expectedRgb = [255, 0, 0];
    assert.deepStrictEqual(hexToRgb(hex), expectedRgb);
  });

  it('handles mixed case hex colors', () => {
    const hex = '#FfAa00';
    const expectedRgb = [255, 170, 0];
    assert.deepStrictEqual(hexToRgb(hex), expectedRgb);
  });

  it('throws an error for hex with invalid characters', () => {
    const hex = '#gggggg';
    assert.throws(() => hexToRgb(hex), { message: 'Invalid hex color' });
  });
});
