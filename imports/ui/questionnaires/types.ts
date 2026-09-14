import type { QuestionnaireResponse } from '/imports/api/types/questionnaire';

export interface QuestionnaireResponseRow extends QuestionnaireResponse {
  /** null when anonymous or the member no longer resolves — render a translated label. */
  respondentName?: string | null;
}
