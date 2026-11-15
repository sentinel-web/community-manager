/**
 * An event's `preset` is either a web link or an uploaded file, stored in one string field as
 * `file:<name>:::<data URL>`. Parsing lives here so the form, the detail view, the server-side
 * validation and the Discord announcement agree on the format.
 */
export const PRESET_FILE_MAX_BYTES = 512 * 1024;
/** Upper bound for the stored string: the base64 expansion of the largest file plus name and prefix. */
export const PRESET_MAX_LENGTH = Math.ceil((PRESET_FILE_MAX_BYTES * 4) / 3) + 512;
const FILE_PATTERN = /^file:([^:/\\]{1,120}):::(data:[\w.+/-]*;base64,([A-Za-z0-9+/=]*))$/;

export type Preset = { kind: 'link'; url: string } | { kind: 'file'; filename: string; dataUrl: string; base64: string };

/**
 * `null` for an empty preset and for anything that is neither an uploaded file nor an http(s)
 * link — such a value is shown as plain text and must never become an `href`.
 */
export function parsePreset(preset: string | null | undefined): Preset | null {
  if (!preset) return null;
  const file = FILE_PATTERN.exec(preset);
  if (file) return { kind: 'file', filename: file[1], dataUrl: file[2], base64: file[3] };
  return /^https?:\/\/\S+$/i.test(preset) ? { kind: 'link', url: preset } : null;
}

/** Server-side bound: an absent preset, or a string that cannot exceed the upload limit. */
export function isValidPreset(preset: unknown): boolean {
  return preset == null || (typeof preset === 'string' && preset.length <= PRESET_MAX_LENGTH);
}
