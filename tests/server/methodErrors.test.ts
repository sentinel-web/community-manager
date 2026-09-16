import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import { getTranslation, type Locale } from '../../imports/i18n';
import { describeMethodError, translateErrorCode, type Localizer } from '../../imports/i18n/methodErrors';

function localizerFor(language: Locale): Localizer {
  return { language, t: (key, ...args) => getTranslation(key, language, ...args) };
}

describe('methodErrors — client translation of stable server error codes (#364)', () => {
  const de = localizerFor('de');

  it('translates a known code', () => {
    assert.strictEqual(translateErrorCode('questionnaire-not-active', undefined, de), 'Diese Umfrage ist nicht aktiv');
  });

  it('interpolates the question text from details', () => {
    assert.strictEqual(translateErrorCode('questionnaire-answer-required', { question: 'Warum?' }, de), 'Die Frage „Warum?“ ist erforderlich');
  });

  it('formats the cooldown date in the app language, not the host locale', () => {
    const iso = '2030-01-15T12:00:00.000Z';
    const date = new Date(iso);
    assert.strictEqual(
      translateErrorCode('questionnaire-response-cooldown', { nextAllowedDate: iso }, de),
      `Sie können ab dem ${new Intl.DateTimeFormat('de').format(date)} erneut antworten`
    );
    assert.strictEqual(
      translateErrorCode('questionnaire-response-cooldown', { nextAllowedDate: iso }, localizerFor('en')),
      `You can submit again after ${new Intl.DateTimeFormat('en').format(date)}`
    );
  });

  it('returns null for unknown or non-string codes', () => {
    assert.strictEqual(translateErrorCode('not-a-known-code', undefined, de), null);
    assert.strictEqual(translateErrorCode(403, undefined, de), null);
    assert.strictEqual(translateErrorCode('toString', undefined, de), null);
  });

  it('describes a known Meteor.Error with a translated description', () => {
    const error = new Meteor.Error('questionnaire-response-not-own', 'You can only revoke your own responses');
    assert.deepStrictEqual(describeMethodError(error, de), {
      message: 'Fehler',
      description: 'Sie können nur Ihre eigenen Antworten widerrufen',
    });
  });

  it('falls back to the server code and reason for unknown errors', () => {
    const error = new Meteor.Error(403, 'Permission denied');
    assert.deepStrictEqual(describeMethodError(error, de), { message: '403', description: 'Permission denied' });
  });
});
