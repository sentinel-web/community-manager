import assert from 'node:assert';
import { generatePassword, MIN_GENERATED_PASSWORD_LENGTH, usernameFromName } from '../../imports/helpers/memberCredentials';

describe('usernameFromName', () => {
  it('trims surrounding whitespace', () => {
    assert.strictEqual(usernameFromName('  Spartan  '), 'Spartan');
  });

  it('collapses internal whitespace runs to a single space', () => {
    assert.strictEqual(usernameFromName('John \t  Doe'), 'John Doe');
  });

  it('returns an empty string for missing or blank names', () => {
    assert.strictEqual(usernameFromName(undefined), '');
    assert.strictEqual(usernameFromName(null), '');
    assert.strictEqual(usernameFromName('   '), '');
  });
});

describe('generatePassword', () => {
  it('defaults to at least the minimum length', () => {
    assert.ok(generatePassword().length >= MIN_GENERATED_PASSWORD_LENGTH);
  });

  it('honours a longer requested length', () => {
    assert.strictEqual(generatePassword(32).length, 32);
  });

  it('never goes below the minimum length', () => {
    assert.strictEqual(generatePassword(4).length, MIN_GENERATED_PASSWORD_LENGTH);
    assert.strictEqual(generatePassword(Number.NaN).length, MIN_GENERATED_PASSWORD_LENGTH);
  });

  it('uses only unambiguous characters', () => {
    const password = generatePassword(200);
    assert.doesNotMatch(password, /[0O1lI\s]/);
  });

  it('produces different passwords on each call', () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generatePassword()));
    assert.strictEqual(passwords.size, 20);
  });
});
