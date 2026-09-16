export const BREAKPOINTS = {
  MIN_SUPPORTED_WIDTH: 360,
  MOBILE: 768,
} as const;

export const LAYOUT = {
  DRAWER_WIDTH_RATIO: 0.33,
  MODAL_WIDTH_RATIO: 0.75,
} as const;

// Documents per publication: DEFAULT when a subscription sends no limit, MAX as
// the hard cap. The cap is *enforced* server-side (server/crud.lib.ts imports
// this); it lives here — not in server/config.ts with a client mirror — so that
// the client's own use of it (clamping `Section`'s `customViewLimit` and
// deciding when to warn that results were truncated) can never disagree with
// what the server enforces. The price is that it is not Meteor.settings-tunable.
export const PUBLISH_LIMITS = {
  DEFAULT: 100,
  MAX: 1000,
} as const;

export function getDrawerWidth(windowWidth: number): number {
  return windowWidth < BREAKPOINTS.MOBILE ? windowWidth : windowWidth * LAYOUT.DRAWER_WIDTH_RATIO;
}

export function getModalWidth(windowWidth: number): number {
  // Full viewport width below the mobile breakpoint (a 75%-wide centered modal
  // is cramped on a phone); the configured ratio on larger screens.
  return windowWidth < BREAKPOINTS.MOBILE ? windowWidth : windowWidth * LAYOUT.MODAL_WIDTH_RATIO;
}

export function isDeviceUnsupported(windowWidth: number): boolean {
  return windowWidth < BREAKPOINTS.MIN_SUPPORTED_WIDTH;
}
