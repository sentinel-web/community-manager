/* global describe, it */
import assert from 'node:assert';
import getLegibleTextColor from '../../../imports/helpers/colors/getLegibleTextColor';
import getLuminance from '../../../imports/helpers/colors/getLuminance';
import parseColor from '../../../imports/helpers/colors/parseColor';

describe('getLegibleTextColor', () => {
  it('returns white text for dark backgrounds', () => {
    // Dark backgrounds need light text for readability
    const backgroundColor = '#333333';
    assert.strictEqual(getLegibleTextColor(backgroundColor), 'white');
  });

  it('returns black text for light backgrounds', () => {
    // Light backgrounds need dark text for readability
    const backgroundColor = '#FFFFFF';
    assert.strictEqual(getLegibleTextColor(backgroundColor), 'black');
  });

  it('handles hex colors with shorthand notation', () => {
    // #FFF is white, needs black text
    const backgroundColor = '#FFF';
    assert.strictEqual(getLegibleTextColor(backgroundColor), 'black');
  });

  it('handles RGB colors', () => {
    // White in RGB format needs black text
    const backgroundColor = 'rgb(255, 255, 255)';
    assert.strictEqual(getLegibleTextColor(backgroundColor), 'black');
  });

  it('throws an error for unsupported color formats', () => {
    const backgroundColor = 'invalid-color';
    assert.throws(() => getLegibleTextColor(backgroundColor), { message: 'Unsupported color format' });
  });

  it('returns white text for mid-dark gray', () => {
    // #666666 has luminance ~0.13, which is < 0.5
    const backgroundColor = '#666666';
    assert.strictEqual(getLegibleTextColor(backgroundColor), 'white');
  });

  it('returns black text for light gray', () => {
    // #CCCCCC has luminance ~0.6, which is > 0.5
    const backgroundColor = '#CCCCCC';
    assert.strictEqual(getLegibleTextColor(backgroundColor), 'black');
  });

  it('uses 0.5 as the luminance threshold', () => {
    // Verify the threshold behavior by checking a color near the boundary
    const lightGray = '#BBBBBB';
    const luminance = getLuminance(...parseColor(lightGray));
    // #BBBBBB has luminance ~0.48, so should return white
    if (luminance > 0.5) {
      assert.strictEqual(getLegibleTextColor(lightGray), 'black');
    } else {
      assert.strictEqual(getLegibleTextColor(lightGray), 'white');
    }
  });

  it('returns white text for pure blue', () => {
    // Blue has low luminance (~0.07)
    const backgroundColor = '#0000FF';
    assert.strictEqual(getLegibleTextColor(backgroundColor), 'white');
  });

  it('returns black text for pure green', () => {
    // Green has high luminance (~0.72)
    const backgroundColor = '#00FF00';
    assert.strictEqual(getLegibleTextColor(backgroundColor), 'black');
  });
});
