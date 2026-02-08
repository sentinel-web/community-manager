import { Meteor } from 'meteor/meteor';
import QuestionnairesCollection from '../../imports/api/collections/questionnaires.collection';
import QuestionnaireResponsesCollection from '../../imports/api/collections/questionnaireResponses.collection';
import { checkPermission } from '../main';
import { canUserRespond } from './questionnaireResponses.server';

if (Meteor.isServer) {
  Meteor.methods({
    'questionnaires.getActiveForUser': async function () {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');

      const hasPermission = await checkPermission(this.userId, 'questionnaires', 'read');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      const activeQuestionnaires = await QuestionnairesCollection.find({ status: 'active' }).fetchAsync();

      const result = await Promise.all(
        activeQuestionnaires.map(async questionnaire => {
          const { canRespond, reason, nextAllowedDate } = await canUserRespond(questionnaire, this.userId);

          // Get total response count and latest response for this user
          let responseCount = 0;
          let latestResponseId = null;
          if (!questionnaire.allowAnonymous) {
            responseCount = await QuestionnaireResponsesCollection.countDocuments({
              questionnaireId: questionnaire._id,
              respondentId: this.userId,
            });
            const latestResponse = await QuestionnaireResponsesCollection.findOneAsync(
              { questionnaireId: questionnaire._id, respondentId: this.userId },
              { sort: { submittedAt: -1 }, fields: { _id: 1 } }
            );
            latestResponseId = latestResponse?._id || null;
          }

          return {
            ...questionnaire,
            canRespond,
            responseReason: reason,
            nextAllowedDate,
            responseCount,
            latestResponseId,
            questionCount: questionnaire.questions?.length || 0,
          };
        })
      );

      return result;
    },
  });
}
