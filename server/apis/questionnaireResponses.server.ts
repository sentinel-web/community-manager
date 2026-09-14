import { Meteor } from 'meteor/meteor';
import QuestionnairesCollection from '../../imports/api/collections/questionnaires.collection';
import QuestionnaireResponsesCollection from '../../imports/api/collections/questionnaireResponses.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import { checkPermission, validateString, validateArray, validateObject } from '../main';
import { createLog } from './logs.server';
import type { Answer, Questionnaire, QuestionnaireInterval } from '/imports/api/types';
import type { QuestionnaireErrorCode, QuestionnaireErrorDetails } from '/imports/api/types/questionnaire';

export function getIntervalCutoffDate(interval: QuestionnaireInterval | string | undefined): Date | null {
  if (!interval || interval === 'once') return null;
  if (interval === 'unlimited') return new Date(0);

  const now = new Date();
  switch (interval) {
    case 'daily':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

export interface CanRespondResult {
  canRespond: boolean;
  /** Stable error code; the client translates it. */
  reason?: QuestionnaireErrorCode;
  nextAllowedDate?: Date;
}

// English fallback reasons for the stable codes — shown only to clients that do
// not map the code (the app UI translates it, see imports/i18n/methodErrors.ts).
const FALLBACK_REASONS: Record<QuestionnaireErrorCode, string> = {
  'questionnaire-already-responded': 'You have already submitted a response',
  'questionnaire-answer-invalid': 'Invalid answer type',
  'questionnaire-answer-required': 'A required question is unanswered',
  'questionnaire-not-active': 'Questionnaire is not active',
  'questionnaire-rating-invalid': 'Invalid rating value',
  'questionnaire-response-anonymous': 'Anonymous responses cannot be revoked',
  'questionnaire-response-cooldown': 'You cannot submit another response yet',
  'questionnaire-response-not-own': 'You can only revoke your own responses',
};

function questionnaireError(code: QuestionnaireErrorCode, details?: QuestionnaireErrorDetails): Meteor.Error {
  return new Meteor.Error(code, FALLBACK_REASONS[code], details);
}

export async function canUserRespond(questionnaire: Questionnaire, userId: string): Promise<CanRespondResult> {
  if (questionnaire.allowAnonymous) return { canRespond: true };

  const interval = questionnaire.interval || 'once';

  if (interval === 'unlimited') return { canRespond: true };

  const filter: Record<string, unknown> = {
    questionnaireId: questionnaire._id,
    respondentId: userId,
  };

  if (interval !== 'once') {
    const cutoffDate = getIntervalCutoffDate(interval);
    if (cutoffDate) {
      filter.submittedAt = { $gte: cutoffDate };
    }
  }

  const existingResponse = await QuestionnaireResponsesCollection.findOneAsync(filter, { sort: { submittedAt: -1 } });

  if (!existingResponse) return { canRespond: true };

  if (interval === 'once') {
    return { canRespond: false, reason: 'questionnaire-already-responded' };
  }

  const nextAllowedDate = new Date(existingResponse.submittedAt ?? new Date());
  switch (interval) {
    case 'daily':
      nextAllowedDate.setDate(nextAllowedDate.getDate() + 1);
      break;
    case 'weekly':
      nextAllowedDate.setDate(nextAllowedDate.getDate() + 7);
      break;
    case 'monthly':
      nextAllowedDate.setDate(nextAllowedDate.getDate() + 30);
      break;
  }

  return {
    canRespond: false,
    reason: 'questionnaire-response-cooldown',
    nextAllowedDate,
  };
}

interface SubmittedAnswer {
  questionIndex: number;
  value: unknown;
}

if (Meteor.isServer) {
  Meteor.methods({
    'questionnaireResponses.submit': async function (questionnaireId: string, answers: SubmittedAnswer[]): Promise<string> {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      validateString(questionnaireId, false);
      validateArray(answers, false);

      const hasPermission = await checkPermission(this.userId, 'questionnaires', 'read');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      const questionnaire = await QuestionnairesCollection.findOneAsync(questionnaireId);
      if (!questionnaire) throw new Meteor.Error(404, 'Questionnaire not found');
      if (questionnaire.status !== 'active') throw questionnaireError('questionnaire-not-active');

      const { canRespond, reason, nextAllowedDate } = await canUserRespond(questionnaire, this.userId);
      if (!canRespond) {
        throw questionnaireError(reason ?? 'questionnaire-already-responded', { nextAllowedDate: nextAllowedDate?.toISOString() });
      }

      const requiredQuestions = (questionnaire.questions || [])
        .flatMap((q, index) => (q.required ? [{ ...q, index }] : []));

      const answerByIndex = new Map(answers.map(a => [a.questionIndex, a]));
      for (const question of requiredQuestions) {
        const answer = answerByIndex.get(question.index);
        if (!answer || answer.value === undefined || answer.value === null || answer.value === '') {
          throw questionnaireError('questionnaire-answer-required', { question: question.text });
        }
        if (Array.isArray(answer.value) && answer.value.length === 0) {
          throw questionnaireError('questionnaire-answer-required', { question: question.text });
        }
      }

      for (const answer of answers) {
        const question = questionnaire.questions?.[answer.questionIndex];
        if (!question) continue;

        const { type } = question;
        const { value } = answer;

        if (value === undefined || value === null || value === '') continue;

        if ((type === 'text' || type === 'textarea') && typeof value !== 'string') {
          throw questionnaireError('questionnaire-answer-invalid', { question: question.text });
        }
        if (type === 'number' && typeof value !== 'number') {
          throw questionnaireError('questionnaire-answer-invalid', { question: question.text });
        }
        if (type === 'select' && typeof value !== 'string') {
          throw questionnaireError('questionnaire-answer-invalid', { question: question.text });
        }
        if (type === 'multiselect' && !Array.isArray(value)) {
          throw questionnaireError('questionnaire-answer-invalid', { question: question.text });
        }
        if (type === 'rating' && (typeof value !== 'number' || value < 1 || value > 5)) {
          throw questionnaireError('questionnaire-rating-invalid', { question: question.text });
        }
      }

      const responseAnswers: Answer[] = answers.map(answer => {
        const question = questionnaire.questions?.[answer.questionIndex];
        return {
          questionIndex: answer.questionIndex,
          questionText: question?.text || '',
          questionType: question?.type || 'text',
          value: answer.value,
        };
      });

      const now = new Date();
      const response = {
        questionnaireId,
        respondentId: questionnaire.allowAnonymous ? null : this.userId,
        answers: responseAnswers,
        submittedAt: now,
        createdAt: now,
      };

      const id = await QuestionnaireResponsesCollection.insertAsync(response);
      await createLog('questionnaireResponses.submitted', {
        id,
        questionnaireId,
        respondentId: response.respondentId,
        anonymous: questionnaire.allowAnonymous,
      });

      return id;
    },

    'questionnaireResponses.hasResponded': async function (questionnaireId: string): Promise<boolean> {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      validateString(questionnaireId, false);

      const hasPermission = await checkPermission(this.userId, 'questionnaires', 'read');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      const existingResponse = await QuestionnaireResponsesCollection.findOneAsync({
        questionnaireId,
        respondentId: this.userId,
      });

      return !!existingResponse;
    },

    'questionnaireResponses.getForQuestionnaire': async function (questionnaireId: string, options: Record<string, unknown> = {}) {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      validateString(questionnaireId, false);
      validateObject(options, true);

      const hasPermission = await checkPermission(this.userId, 'questionnaires', 'read');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      const responses = await QuestionnaireResponsesCollection.find(
        { questionnaireId },
        { sort: { submittedAt: -1 }, ...options }
      ).fetchAsync();

      const enrichedResponses = await Promise.all(
        responses.map(async response => {
          // null = anonymous or unresolvable member; the client renders the
          // translated "Anonymous" / "Unknown" label from respondentId.
          let respondentName: string | null = null;
          if (response.respondentId) {
            const member = await MembersCollection.findOneAsync(response.respondentId);
            respondentName = member?.profile!.name || member?.username || null;
          }
          return {
            ...response,
            respondentName,
          };
        })
      );

      return enrichedResponses;
    },

    'questionnaireResponses.countForQuestionnaire': async function (questionnaireId: string): Promise<number> {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      validateString(questionnaireId, false);

      const hasPermission = await checkPermission(this.userId, 'questionnaires', 'read');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      return await QuestionnaireResponsesCollection.countDocuments({ questionnaireId });
    },

    'questionnaireResponses.revoke': async function (responseId: string): Promise<boolean> {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      validateString(responseId, false);

      const hasPermission = await checkPermission(this.userId, 'questionnaires', 'read');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      const response = await QuestionnaireResponsesCollection.findOneAsync(responseId);
      if (!response) throw new Meteor.Error(404, 'Response not found');

      if (response.respondentId !== this.userId) {
        throw questionnaireError('questionnaire-response-not-own');
      }

      if (!response.respondentId) {
        throw questionnaireError('questionnaire-response-anonymous');
      }

      await QuestionnaireResponsesCollection.removeAsync(responseId);
      await createLog('questionnaireResponses.revoked', {
        id: responseId,
        questionnaireId: response.questionnaireId,
        respondentId: response.respondentId,
      });

      return true;
    },

    'questionnaireResponses.setIgnored': async function (responseId: string, ignored: boolean): Promise<boolean> {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      validateString(responseId, false);

      const hasPermission = await checkPermission(this.userId, 'questionnaires', 'update');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      const response = await QuestionnaireResponsesCollection.findOneAsync(responseId);
      if (!response) throw new Meteor.Error(404, 'Response not found');

      await QuestionnaireResponsesCollection.updateAsync(responseId, {
        $set: { ignored: !!ignored },
      });
      await createLog('questionnaireResponses.ignored', {
        id: responseId,
        questionnaireId: response.questionnaireId,
        ignored: !!ignored,
      });

      return true;
    },
  });
}
