/* global describe, it */
import assert from 'node:assert';
import getLuminance from '../../../imports/helpers/colors/getLuminance';

describe('getLuminance', () => {
  it('returns 0 for black (0, 0, 0)', () => {
    assert.strictEqual(getLuminance(0, 0, 0), 0);
  });

  it('returns 1 for white (255, 255, 255)', () => {
    assert.strictEqual(getLuminance(255, 255, 255), 1);
  });

  it('calculates luminance for mid-gray with gamma correction', () => {
    // For RGB(128, 128, 128):
    // c = 128/255 ≈ 0.502 > 0.03928, so gamma correction applies
    // corrected = ((0.502 + 0.055) / 1.055) ** 2.4 ≈ 0.216
    const luminance = getLuminance(128, 128, 128);
    assert.ok(luminance > 0.2 && luminance < 0.23, `Expected ~0.216, got ${luminance}`);
  });

  it('calculates higher luminance for light gray', () => {
    // For RGB(200, 200, 200):
    // c = 200/255 ≈ 0.784 > 0.03928, so gamma correction applies
    const luminance = getLuminance(200, 200, 200);
    assert.ok(luminance > 0.5 && luminance < 0.6, `Expected ~0.58, got ${luminance}`);
  });

  it('calculates low luminance for dark colors without gamma correction', () => {
    // For RGB(10, 10, 10):
    // c = 10/255 ≈ 0.039 <= 0.03928, so linear scaling applies (c / 12.92)
    const luminance = getLuminance(10, 10, 10);
    assert.ok(luminance > 0.002 && luminance < 0.004, `Expected ~0.003, got ${luminance}`);
  });

  it('calculates correct luminance for pure red', () => {
    // Red contributes 0.2126 to luminance
    const luminance = getLuminance(255, 0, 0);
    assert.ok(luminance > 0.21 && luminance < 0.22, `Expected ~0.2126, got ${luminance}`);
  });

  it('calculates correct luminance for pure green', () => {
    // Green contributes 0.7152 to luminance
    const luminance = getLuminance(0, 255, 0);
    assert.ok(luminance > 0.71 && luminance < 0.72, `Expected ~0.7152, got ${luminance}`);
  });

  it('calculates correct luminance for pure blue', () => {
    // Blue contributes 0.0722 to luminance
    const luminance = getLuminance(0, 0, 255);
    assert.ok(luminance > 0.07 && luminance < 0.08, `Expected ~0.0722, got ${luminance}`);
  });
});
