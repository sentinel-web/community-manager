import type { QuestionnaireErrorCode, QuestionnaireErrorDetails } from '../api/types/questionnaire';
import type { Translator } from './index';

/**
 * Client-side translation of stable server error codes.
 *
 * Server methods throw `Meteor.Error(code, englishFallbackReason, details)`; the
 * UI must not show the English reason, so known codes are mapped here to
 * translated messages (parameters travel in `details`). Unknown codes fall back
 * to the server's reason, exactly as the MethodCall seam shows them.
 */

type Resolver = (details: QuestionnaireErrorDetails, t: Translator) => string;

const RESOLVERS: Record<QuestionnaireErrorCode, Resolver> = {
  'questionnaire-already-responded': (_, t) => t('questionnaires.errors.alreadyResponded'),
  'questionnaire-answer-invalid': ({ question = '' }, t) => t('questionnaires.errors.answerInvalid', { question }),
  'questionnaire-answer-required': ({ question = '' }, t) => t('questionnaires.errors.answerRequired', { question }),
  'questionnaire-not-active': (_, t) => t('questionnaires.errors.notActive'),
  'questionnaire-rating-invalid': ({ question = '' }, t) => t('questionnaires.errors.ratingInvalid', { question }),
  'questionnaire-response-anonymous': (_, t) => t('questionnaires.errors.responseAnonymous'),
  'questionnaire-response-cooldown': ({ nextAllowedDate }, t) =>
    nextAllowedDate ? t('questionnaires.errors.cooldown', { date: new Date(nextAllowedDate).toLocaleDateString() }) : t('questionnaires.pleaseWait'),
  'questionnaire-response-not-own': (_, t) => t('questionnaires.errors.responseNotOwn'),
};

/** Translated message for a stable error code, or `null` when the code is not mapped. */
export function translateErrorCode(code: unknown, details: unknown, t: Translator): string | null {
  if (typeof code !== 'string' || !Object.prototype.hasOwnProperty.call(RESOLVERS, code)) return null;
  const safeDetails = details && typeof details === 'object' ? (details as QuestionnaireErrorDetails) : {};
  return RESOLVERS[code as QuestionnaireErrorCode](safeDetails, t);
}

interface MethodErrorLike {
  error?: unknown;
  reason?: string;
  message?: string;
  details?: unknown;
}

/** `notification.error` content for a caught method error: translated when the code is known. */
export function describeMethodError(caught: unknown, t: Translator): { message: string; description: string } {
  const error = (caught ?? {}) as MethodErrorLike;
  const translated = translateErrorCode(error.error, error.details, t);
  if (translated !== null) return { message: t('common.error'), description: translated };
  return { message: String(error.error ?? t('common.error')), description: error.reason || error.message || '' };
}
