import assert from 'node:assert';
import getLegibleTextColor from '../../../imports/helpers/colors/getLegibleTextColor';

describe('getLegibleTextColor', () => {
  it('returns white text for dark backgrounds', () => {
    assert.strictEqual(getLegibleTextColor('#333333'), 'white');
  });

  it('returns black text for light backgrounds', () => {
    assert.strictEqual(getLegibleTextColor('#FFFFFF'), 'black');
  });

  it('handles hex colors with shorthand notation', () => {
    assert.strictEqual(getLegibleTextColor('#FFF'), 'black');
  });

  it('handles RGB colors', () => {
    assert.strictEqual(getLegibleTextColor('rgb(255, 255, 255)'), 'black');
  });

  it('does not throw on 8-digit #rrggbbaa colors emitted by the antd ColorPicker', () => {
    assert.strictEqual(getLegibleTextColor('#ffd66680'), 'black');
    assert.strictEqual(getLegibleTextColor('#000000cc'), 'white');
  });

  it('returns undefined (theme default) for unsupported color formats instead of throwing', () => {
    assert.strictEqual(getLegibleTextColor('invalid-color'), undefined);
    assert.strictEqual(getLegibleTextColor('blue'), undefined);
  });

  it('returns undefined for empty colors', () => {
    assert.strictEqual(getLegibleTextColor(''), undefined);
    assert.strictEqual(getLegibleTextColor(null), undefined);
    assert.strictEqual(getLegibleTextColor(undefined), undefined);
  });

  it('returns white text for mid-dark gray', () => {
    // #666666 luminance ~0.133
    assert.strictEqual(getLegibleTextColor('#666666'), 'white');
  });

  it('returns black text for light gray', () => {
    assert.strictEqual(getLegibleTextColor('#CCCCCC'), 'black');
  });

  it('picks the WCAG higher-contrast text color around the ~0.179 luminance crossover', () => {
    // #757575 luminance ~0.178: white contrast 4.61 > black contrast 4.56
    assert.strictEqual(getLegibleTextColor('#757575'), 'white');
    // #767676 luminance ~0.181: black contrast 4.62 > white contrast 4.54
    assert.strictEqual(getLegibleTextColor('#767676'), 'black');
  });

  it('returns black text for mid-light colors that a 0.5 threshold got wrong', () => {
    // #BBBBBB luminance ~0.497, #52c41a luminance ~0.41 — white text is barely legible on both
    assert.strictEqual(getLegibleTextColor('#BBBBBB'), 'black');
    assert.strictEqual(getLegibleTextColor('#52c41a'), 'black');
  });

  it('returns white text for pure blue', () => {
    assert.strictEqual(getLegibleTextColor('#0000FF'), 'white');
  });

  it('returns black text for pure green', () => {
    assert.strictEqual(getLegibleTextColor('#00FF00'), 'black');
  });
});
