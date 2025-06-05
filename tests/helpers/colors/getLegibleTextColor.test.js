/* global describe, it */
import assert from 'node:assert';
import getLegibleTextColor from '../../../imports/helpers/colors/getLegibleTextColor';
import getLuminance from '../../../imports/helpers/colors/getLuminance';
import parseColor from '../../../imports/helpers/colors/parseColor';

describe('getLegibleTextColor', () => {
  it('returns black for dark backgrounds', () => {
    const backgroundColor = '#333333';
    const expectedTextColor = 'black';
    assert.strictEqual(getLegibleTextColor(backgroundColor), expectedTextColor);
  });

  it('returns white for light backgrounds', () => {
    const backgroundColor = '#FFFFFF';
    const expectedTextColor = 'white';
    assert.strictEqual(getLegibleTextColor(backgroundColor), expectedTextColor);
  });

  it('handles hex colors with shorthand notation', () => {
    const backgroundColor = '#FFF';
    const expectedTextColor = 'black';
    assert.strictEqual(getLegibleTextColor(backgroundColor), expectedTextColor);
  });

  it('handles RGB colors', () => {
    const backgroundColor = 'rgb(255, 255, 255)';
    const expectedTextColor = 'black';
    assert.strictEqual(getLegibleTextColor(backgroundColor), expectedTextColor);
  });

  it('throws an error for unsupported color formats', () => {
    const backgroundColor = ' invalid-color';
    assert.throws(() => getLegibleTextColor(backgroundColor), Error, 'Unsupported color format');
  });

  it('uses the correct luminance threshold', () => {
    const backgroundColor = '#AAAAAA';
    const luminance = getLuminance(...parseColor(backgroundColor));
    assert.ok(luminance > 0.5);
    assert.strictEqual(getLegibleTextColor(backgroundColor), 'black');
  });
});
