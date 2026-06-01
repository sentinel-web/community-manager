import crypto from 'crypto';
import fs from 'fs';
import { Meteor } from 'meteor/meteor';

const ALGORITHM = 'aes-256-cbc';

// Where the 32-char key comes from, in order:
//   1. a file mounted as a Docker secret (the production / preview path) —
//      generated per-stack by scripts/deploy.sh and never placed in the
//      environment, so it stays out of `docker inspect` and the client bundle;
//   2. Meteor.settings.private.encryptionKey, as a dev fallback.
// Resolution is lazy so an unconfigured server still boots (a dev run, or a
// stack that never enables Discord); the error only fires if encrypt/decrypt is
// actually called without a usable key — it is no longer a startup invariant.
const KEY_FILE = process.env.ENCRYPTION_KEY_FILE || '/run/secrets/encryption_key';

let cachedKey: string | undefined;

function resolveKey(): string {
  if (cachedKey) return cachedKey;
  let key: string | undefined;
  try {
    key = fs.readFileSync(KEY_FILE, 'utf8').trim();
  } catch {
    key = Meteor.settings.private?.encryptionKey;
  }
  if (!key || key.length !== 32) {
    throw new Meteor.Error(
      'encryption-key-missing',
      `Encryption key must be 32 characters long — provide it via ${KEY_FILE} or Meteor.settings.private.encryptionKey`
    );
  }
  cachedKey = key;
  return key;
}

export function encrypt(text: string): string {
  const key = resolveKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  try {
    const key = resolveKey();
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch {
    return 'Error decrypting value';
  }
}
