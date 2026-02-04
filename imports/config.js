/**
 * Centralized configuration for UI constants and shared values.
 * Server-side configurations should use Meteor.settings instead.
 */

// UI Breakpoints
export const BREAKPOINTS = {
  // Minimum supported device width
  MIN_SUPPORTED_WIDTH: 360,
  // Mobile breakpoint - below this, drawers go full-width
  MOBILE: 768,
};

// UI Layout proportions
export const LAYOUT = {
  // Drawer width as proportion of window width on desktop
  DRAWER_WIDTH_RATIO: 0.33,
  // Modal width as proportion of window width
  MODAL_WIDTH_RATIO: 0.75,
};

/**
 * Calculate drawer width based on window size.
 * Returns full width on mobile, proportional width on desktop.
 * @param {number} windowWidth - Current window inner width
 * @returns {number} - Calculated drawer width in pixels
 */
export function getDrawerWidth(windowWidth) {
  return windowWidth < BREAKPOINTS.MOBILE ? windowWidth : windowWidth * LAYOUT.DRAWER_WIDTH_RATIO;
}

/**
 * Calculate modal width based on window size.
 * @param {number} windowWidth - Current window inner width
 * @returns {number} - Calculated modal width in pixels
 */
export function getModalWidth(windowWidth) {
  return windowWidth * LAYOUT.MODAL_WIDTH_RATIO;
}

/**
 * Check if device is below minimum supported width.
 * @param {number} windowWidth - Current window inner width
 * @returns {boolean} - True if device is not supported
 */
export function isDeviceUnsupported(windowWidth) {
  return windowWidth < BREAKPOINTS.MIN_SUPPORTED_WIDTH;
}
