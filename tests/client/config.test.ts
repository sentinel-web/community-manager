import assert from 'node:assert';
import { BREAKPOINTS, LAYOUT, getDrawerWidth, getModalWidth, isDeviceUnsupported } from '../../imports/config';

describe('getModalWidth', () => {
  it('returns full viewport width below the mobile breakpoint', () => {
    assert.strictEqual(getModalWidth(375), 375);
    assert.strictEqual(getModalWidth(BREAKPOINTS.MOBILE - 1), BREAKPOINTS.MOBILE - 1);
  });

  it('returns the configured ratio at and above the mobile breakpoint', () => {
    assert.strictEqual(getModalWidth(BREAKPOINTS.MOBILE), BREAKPOINTS.MOBILE * LAYOUT.MODAL_WIDTH_RATIO);
    assert.strictEqual(getModalWidth(1024), 1024 * LAYOUT.MODAL_WIDTH_RATIO);
  });
});

describe('getDrawerWidth', () => {
  it('returns full viewport width below the mobile breakpoint', () => {
    assert.strictEqual(getDrawerWidth(375), 375);
  });

  it('returns the configured ratio at and above the mobile breakpoint', () => {
    assert.strictEqual(getDrawerWidth(1024), 1024 * LAYOUT.DRAWER_WIDTH_RATIO);
  });
});

describe('isDeviceUnsupported', () => {
  it('flags widths below the minimum supported width', () => {
    assert.strictEqual(isDeviceUnsupported(BREAKPOINTS.MIN_SUPPORTED_WIDTH - 1), true);
  });

  it('accepts widths at or above the minimum supported width', () => {
    assert.strictEqual(isDeviceUnsupported(BREAKPOINTS.MIN_SUPPORTED_WIDTH), false);
    assert.strictEqual(isDeviceUnsupported(1024), false);
  });
});
