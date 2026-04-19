export const BREAKPOINTS = {
  MIN_SUPPORTED_WIDTH: 360,
  MOBILE: 768,
} as const;

export const LAYOUT = {
  DRAWER_WIDTH_RATIO: 0.33,
  MODAL_WIDTH_RATIO: 0.75,
} as const;

export function getDrawerWidth(windowWidth: number): number {
  return windowWidth < BREAKPOINTS.MOBILE ? windowWidth : windowWidth * LAYOUT.DRAWER_WIDTH_RATIO;
}

export function getModalWidth(windowWidth: number): number {
  return windowWidth * LAYOUT.MODAL_WIDTH_RATIO;
}

export function isDeviceUnsupported(windowWidth: number): boolean {
  return windowWidth < BREAKPOINTS.MIN_SUPPORTED_WIDTH;
}
