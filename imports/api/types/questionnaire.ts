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
