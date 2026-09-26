import assert from 'node:assert';
import hexToRgb from '../../../imports/helpers/colors/hexToRgb';

describe('hexToRgb', () => {
  it('converts hex color to RGB values', () => {
    assert.deepStrictEqual(hexToRgb('#ff0000'), [255, 0, 0]);
  });

  it('converts hex color with shorthand notation to RGB values', () => {
    assert.deepStrictEqual(hexToRgb('#f00'), [255, 0, 0]);
  });

  it('removes leading # from hex color', () => {
    assert.deepStrictEqual(hexToRgb('ff0000'), [255, 0, 0]);
  });

  it('handles hex color with uppercase letters', () => {
    assert.deepStrictEqual(hexToRgb('#FF0000'), [255, 0, 0]);
  });

  it('handles mixed case hex colors', () => {
    assert.deepStrictEqual(hexToRgb('#FfAa00'), [255, 170, 0]);
  });

  it('handles 8-digit #rrggbbaa (antd ColorPicker with alpha), ignoring alpha', () => {
    assert.deepStrictEqual(hexToRgb('#ffd66680'), [255, 214, 102]);
  });

  it('handles 4-digit #rgba shorthand, ignoring alpha', () => {
    assert.deepStrictEqual(hexToRgb('#f008'), [255, 0, 0]);
  });

  it('returns undefined for invalid hex color instead of throwing', () => {
    assert.strictEqual(hexToRgb('invalid-color'), undefined);
  });

  it('returns undefined for hex with invalid characters', () => {
    assert.strictEqual(hexToRgb('#gggggg'), undefined);
  });

  it('returns undefined for hex with an unsupported length', () => {
    assert.strictEqual(hexToRgb('#ff00f'), undefined);
    assert.strictEqual(hexToRgb(''), undefined);
  });
});
