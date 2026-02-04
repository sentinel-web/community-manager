import { Meteor } from 'meteor/meteor';
import QuestionnairesCollection from '../../imports/api/collections/questionnaires.collection';
import QuestionnaireResponsesCollection from '../../imports/api/collections/questionnaireResponses.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import { checkPermission, validateString, validateArray, validateObject } from '../main';
import { createLog } from './logs.server';

function getIntervalCutoffDate(interval) {
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

async function canUserRespond(questionnaire, userId) {
  if (questionnaire.allowAnonymous) return { canRespond: true };

  const interval = questionnaire.interval || 'once';

  if (interval === 'unlimited') return { canRespond: true };

  const filter = {
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
    return { canRespond: false, reason: 'You have already submitted a response' };
  }

  const nextAllowedDate = new Date(existingResponse.submittedAt);
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
    reason: `You can submit again after ${nextAllowedDate.toLocaleDateString()}`,
    nextAllowedDate,
  };
}

if (Meteor.isServer) {
  Meteor.methods({
    'questionnaireResponses.submit': async function (questionnaireId, answers) {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      validateString(questionnaireId, false);
      validateArray(answers, false);

      const hasPermission = await checkPermission(this.userId, 'questionnaires', 'read');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      const questionnaire = await QuestionnairesCollection.findOneAsync(questionnaireId);
      if (!questionnaire) throw new Meteor.Error(404, 'Questionnaire not found');
      if (questionnaire.status !== 'active') throw new Meteor.Error(400, 'Questionnaire is not active');

      // Check if user can respond based on interval settings
      const { canRespond, reason } = await canUserRespond(questionnaire, this.userId);
      if (!canRespond) {
        throw new Meteor.Error(400, reason);
      }

      // Validate required questions are answered
      const requiredQuestions = (questionnaire.questions || [])
        .map((q, index) => ({ ...q, index }))
        .filter(q => q.required);

      for (const question of requiredQuestions) {
        const answer = answers.find(a => a.questionIndex === question.index);
        if (!answer || answer.value === undefined || answer.value === null || answer.value === '') {
          throw new Meteor.Error(400, `Question "${question.text}" is required`);
        }
        if (Array.isArray(answer.value) && answer.value.length === 0) {
          throw new Meteor.Error(400, `Question "${question.text}" is required`);
        }
      }

      // Validate answer types match question types
      for (const answer of answers) {
        const question = questionnaire.questions?.[answer.questionIndex];
        if (!question) continue;

        const { type } = question;
        const { value } = answer;

        if (value === undefined || value === null || value === '') continue;

        if ((type === 'text' || type === 'textarea') && typeof value !== 'string') {
          throw new Meteor.Error(400, `Invalid answer type for question "${question.text}"`);
        }
        if (type === 'number' && typeof value !== 'number') {
          throw new Meteor.Error(400, `Invalid answer type for question "${question.text}"`);
        }
        if (type === 'select' && typeof value !== 'string') {
          throw new Meteor.Error(400, `Invalid answer type for question "${question.text}"`);
        }
        if (type === 'multiselect' && !Array.isArray(value)) {
          throw new Meteor.Error(400, `Invalid answer type for question "${question.text}"`);
        }
        if (type === 'rating' && (typeof value !== 'number' || value < 1 || value > 5)) {
          throw new Meteor.Error(400, `Invalid rating value for question "${question.text}"`);
        }
      }

      // Build response document with question snapshots
      const responseAnswers = answers.map(answer => {
        const question = questionnaire.questions?.[answer.questionIndex];
        return {
          questionIndex: answer.questionIndex,
          questionText: question?.text || '',
          questionType: question?.type || '',
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

    'questionnaireResponses.hasResponded': async function (questionnaireId) {
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

    'questionnaires.getActiveForUser': async function () {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');

      const hasPermission = await checkPermission(this.userId, 'questionnaires', 'read');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      const activeQuestionnaires = await QuestionnairesCollection.find({ status: 'active' }).fetchAsync();

      const result = await Promise.all(
        activeQuestionnaires.map(async questionnaire => {
          const { canRespond, reason, nextAllowedDate } = await canUserRespond(questionnaire, this.userId);

          // Get total response count for this user
          const responseCount = questionnaire.allowAnonymous
            ? 0
            : await QuestionnaireResponsesCollection.countDocuments({
                questionnaireId: questionnaire._id,
                respondentId: this.userId,
              });

          return {
            ...questionnaire,
            canRespond,
            responseReason: reason,
            nextAllowedDate,
            responseCount,
            questionCount: questionnaire.questions?.length || 0,
          };
        })
      );

      return result;
    },

    'questionnaireResponses.getForQuestionnaire': async function (questionnaireId, options = {}) {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      validateString(questionnaireId, false);
      validateObject(options, true);

      const hasPermission = await checkPermission(this.userId, 'questionnaires', 'read');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      const responses = await QuestionnaireResponsesCollection.find(
        { questionnaireId },
        { sort: { submittedAt: -1 }, ...options }
      ).fetchAsync();

      // Enrich with respondent names
      const enrichedResponses = await Promise.all(
        responses.map(async response => {
          let respondentName = 'Anonymous';
          if (response.respondentId) {
            const member = await MembersCollection.findOneAsync(response.respondentId);
            respondentName = member?.profile?.name || member?.username || 'Unknown';
          }
          return {
            ...response,
            respondentName,
          };
        })
      );

      return enrichedResponses;
    },

    'questionnaireResponses.countForQuestionnaire': async function (questionnaireId) {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      validateString(questionnaireId, false);

      const hasPermission = await checkPermission(this.userId, 'questionnaires', 'read');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      return await QuestionnaireResponsesCollection.countDocuments({ questionnaireId });
    },
  });
}
