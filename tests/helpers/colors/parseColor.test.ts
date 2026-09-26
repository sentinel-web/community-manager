import assert from 'node:assert';
import parseColor from '../../../imports/helpers/colors/parseColor';

describe('parseColor', () => {
  it('parses hex color to RGB values', () => {
    assert.deepStrictEqual(parseColor('#ff0000'), [255, 0, 0]);
  });

  it('parses hex color with shorthand notation to RGB values', () => {
    assert.deepStrictEqual(parseColor('#f00'), [255, 0, 0]);
  });

  it('parses 8-digit hex color, ignoring alpha', () => {
    assert.deepStrictEqual(parseColor('#1677ffcc'), [22, 119, 255]);
  });

  it('parses RGB color to RGB values', () => {
    assert.deepStrictEqual(parseColor('rgb(255, 0, 0)'), [255, 0, 0]);
  });

  it('parses RGB color without spaces', () => {
    assert.deepStrictEqual(parseColor('rgb(255,128,0)'), [255, 128, 0]);
  });

  it('parses RGBA color (ignores alpha)', () => {
    assert.deepStrictEqual(parseColor('rgba(255, 0, 0, 0.5)'), [255, 0, 0]);
  });

  it('trims surrounding whitespace', () => {
    assert.deepStrictEqual(parseColor('  #00ff00 '), [0, 255, 0]);
  });

  it('returns undefined for named colors instead of throwing', () => {
    assert.strictEqual(parseColor('red'), undefined);
    assert.strictEqual(parseColor('invalid-color'), undefined);
  });

  it('returns undefined for invalid hex color', () => {
    assert.strictEqual(parseColor('#gggggg'), undefined);
  });

  it('returns undefined for invalid RGB color', () => {
    assert.strictEqual(parseColor('rgb(invalid)'), undefined);
    assert.strictEqual(parseColor('rgb(300, 0, 0)'), undefined);
  });

  it('returns undefined for empty input', () => {
    assert.strictEqual(parseColor(''), undefined);
    assert.strictEqual(parseColor(null), undefined);
    assert.strictEqual(parseColor(undefined), undefined);
  });
});
