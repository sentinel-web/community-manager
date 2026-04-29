import type { QuestionnaireResponse } from '/imports/api/types/questionnaire';

export interface QuestionnaireResponseRow extends QuestionnaireResponse {
  respondentName?: string;
}
