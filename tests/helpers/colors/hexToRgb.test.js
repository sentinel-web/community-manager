/* global describe, it, expect */
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
    const hex = ' invalid-color';
    assert.throws(() => hexToRgb(hex), Error, 'Invalid hex color');
  });

  it('handles hex color with uppercase letters', () => {
    const hex = '#FF0000';
    const expectedRgb = [255, 0, 0];
    expect(hexToRgb(hex)).toEqual(expectedRgb);
  });

  it('handles hex color with lowercase letters', () => {
    const hex = '#ff0000';
    const expectedRgb = [255, 0, 0];
    expect(hexToRgb(hex)).toEqual(expectedRgb);
  });
});
