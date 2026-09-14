import type { MemberId } from './shared';

export type QuestionType = 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'rating';
export type QuestionnaireStatus = 'draft' | 'active' | 'closed';
export type QuestionnaireInterval = 'once' | 'daily' | 'weekly' | 'monthly' | 'unlimited';

export interface Question {
  text: string;
  type: QuestionType;
  required?: boolean;
  options?: string[];
}

export interface Questionnaire {
  _id?: string;
  name: string;
  description?: string;
  status: QuestionnaireStatus;
  allowAnonymous?: boolean;
  interval: QuestionnaireInterval;
  questions: Question[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Answer {
  questionIndex: number;
  questionText: string;
  questionType: QuestionType;
  value: unknown;
}

export interface QuestionnaireResponse {
  _id?: string;
  questionnaireId: string;
  respondentId: MemberId | null;
  answers: Answer[];
  ignored?: boolean;
  submittedAt?: Date;
  createdAt?: Date;
}

/**
 * Stable `Meteor.Error#error` codes thrown by `questionnaireResponses.*` (and the
 * `responseReason` of `questionnaires.getActiveForUser`). The server's `reason`
 * is an English fallback only; the client maps the code to a translated message
 * (`imports/i18n/methodErrors.ts`), with parameters carried in `details`.
 */
export type QuestionnaireErrorCode =
  | 'questionnaire-already-responded'
  | 'questionnaire-answer-invalid'
  | 'questionnaire-answer-required'
  | 'questionnaire-not-active'
  | 'questionnaire-rating-invalid'
  | 'questionnaire-response-anonymous'
  | 'questionnaire-response-cooldown'
  | 'questionnaire-response-not-own';

/** `Meteor.Error#details` accompanying a {@link QuestionnaireErrorCode}. */
export interface QuestionnaireErrorDetails {
  /** Question text, for the per-question answer errors. */
  question?: string;
  /** ISO timestamp from which a new response is accepted, for `questionnaire-response-cooldown`. */
  nextAllowedDate?: string;
}
