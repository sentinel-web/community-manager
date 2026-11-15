import crypto from 'crypto';
import fs from 'fs';
import { Meteor } from 'meteor/meteor';

// Authenticated encryption (AES-256-GCM) for secrets stored in the database —
// today only the Discord bot token. Stored as `v1:<iv>:<tag>:<ciphertext>` (hex).
//
// Where the key material comes from, in order:
//   1. a mounted file (the production / preview path) — generated per-stack by
//      scripts/deploy.sh, copied owner-only into the app-secrets volume by the
//      secrets-init service, and never placed in the environment, so it stays
//      out of `docker inspect`;
//   2. Meteor.settings.private.encryptionKey;
//   3. outside production only, a fixed development key, so `npm start` and the test
//      suite work without any setup. Production never falls back to it.
// Resolution is lazy so an unconfigured server still boots (a dev run, or a
// stack that never enables Discord); the error only fires when encrypt/decrypt
// is actually called without usable key material.
const KEY_FILE = process.env.ENCRYPTION_KEY_FILE || '/run/secrets/encryption_key';
const MIN_KEY_MATERIAL_LENGTH = 32;
const DEVELOPMENT_KEY = 'development-only-encryption-key!!';

let cachedKey: Buffer | undefined;

function resolveKey(): Buffer {
  if (cachedKey) return cachedKey;
  let material: string | undefined;
  try {
    material = fs.readFileSync(KEY_FILE, 'utf8').trim();
  } catch {
    material = Meteor.settings.private?.encryptionKey ?? (Meteor.isProduction ? undefined : DEVELOPMENT_KEY);
  }
  if (!material || material.length < MIN_KEY_MATERIAL_LENGTH) {
    throw new Meteor.Error(
      'encryption-key-missing',
      `No encryption key of at least ${MIN_KEY_MATERIAL_LENGTH} characters — provide it via ${KEY_FILE} or Meteor.settings.private.encryptionKey`
    );
  }
  cachedKey = crypto.createHash('sha256').update(material).digest();
  return cachedKey;
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', resolveKey(), iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('hex'), cipher.getAuthTag().toString('hex'), data.toString('hex')].join(':');
}

/** Throws when the value was tampered with, was encrypted with another key, or is not in the `v1` format. */
export function decrypt(value: string): string {
  const [version, iv, tag, data] = value.split(':');
  if (version !== 'v1' || !iv || !tag || data === undefined) {
    throw new Meteor.Error('decryption-failed', 'Stored secret is not in a supported format');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', resolveKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  try {
    return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    throw new Meteor.Error('decryption-failed', 'Stored secret could not be decrypted with the current key');
  }
}
