/**
 * Credential helpers for turning a registration into a member account.
 */

export const MIN_GENERATED_PASSWORD_LENGTH = 16;
// Upper bound so a bad argument cannot turn into a huge allocation; still far
// above anything a human types or reads back to an applicant.
export const MAX_GENERATED_PASSWORD_LENGTH = 128;
const DEFAULT_GENERATED_PASSWORD_LENGTH = 20;

// Unambiguous characters only (no 0/O, 1/l/I) so a password read off a screen
// or dictated to an applicant is not mistyped.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_!@#$%*+=?';

/**
 * Username suggestion from an applicant's desired name: trimmed, with internal
 * whitespace runs collapsed to one space. Accounts only requires a non-empty
 * username, so an empty result means "no suggestion" (the form's required rule
 * then asks the admin to type one).
 */
export function usernameFromName(name: string | null | undefined): string {
  return (name ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Cryptographically random password from `crypto.getRandomValues`. Uses
 * rejection sampling so every alphabet character is equally likely (no modulo
 * bias). The length is clamped to
 * {@link MIN_GENERATED_PASSWORD_LENGTH}…{@link MAX_GENERATED_PASSWORD_LENGTH},
 * so a missing, fractional or absurd argument still yields a usable password.
 */
export function generatePassword(length: number = DEFAULT_GENERATED_PASSWORD_LENGTH): string {
  const requested = Number.isFinite(length) ? Math.floor(length) : 0;
  const targetLength = Math.min(Math.max(requested, MIN_GENERATED_PASSWORD_LENGTH), MAX_GENERATED_PASSWORD_LENGTH);
  const alphabetSize = PASSWORD_ALPHABET.length;
  const unbiasedLimit = 256 - (256 % alphabetSize);
  const bytes = new Uint8Array(targetLength * 2);
  let password = '';
  while (password.length < targetLength) {
    globalThis.crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= unbiasedLimit) continue;
      password += PASSWORD_ALPHABET[byte % alphabetSize];
      if (password.length === targetLength) break;
    }
  }
  return password;
}
