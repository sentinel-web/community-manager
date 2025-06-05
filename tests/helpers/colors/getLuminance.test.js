/* global describe, it */
import assert from 'node:assert';
import getLuminance from '../../../imports/helpers/colors/getLuminance';

describe('getLuminance', () => {
  it('calculates luminance for RGB values', () => {
    const r = 128;
    const g = 128;
    const b = 128;
    const expectedLuminance = 0.2126 * 0.5 + 0.7152 * 0.5 + 0.0722 * 0.5;
    assert.strictEqual(getLuminance(r, g, b), expectedLuminance);
  });

  it('handles RGB values at the minimum end of the range', () => {
    const r = 0;
    const g = 0;
    const b = 0;
    const expectedLuminance = 0;
    assert.strictEqual(getLuminance(r, g, b), expectedLuminance);
  });

  it('handles RGB values at the maximum end of the range', () => {
    const r = 255;
    const g = 255;
    const b = 255;
    const expectedLuminance = 1;
    assert.strictEqual(getLuminance(r, g, b), expectedLuminance);
  });

  it('applies gamma correction for values above 0.03928', () => {
    const r = 200;
    const g = 200;
    const b = 200;
    const expectedLuminance = 0.2126 * 0.7725 + 0.7152 * 0.7725 + 0.0722 * 0.7725;
    assert.strictEqual(getLuminance(r, g, b), expectedLuminance);
  });

  it('does not apply gamma correction for values below 0.03928', () => {
    const r = 10;
    const g = 10;
    const b = 10;
    const expectedLuminance = 0.2126 * 0.0789 + 0.7152 * 0.0789 + 0.0722 * 0.0789;
    assert.strictEqual(getLuminance(r, g, b), expectedLuminance);
  });
});
