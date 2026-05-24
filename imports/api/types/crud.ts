import type {
  Attendances,
  BriefingTemplate,
  DiscoveryType,
  EventDoc,
  EventType,
  LogEntry,
  Medal,
  Member,
  Position,
  ProfilePicture,
  Questionnaire,
  QuestionnaireResponse,
  Rank,
  Registration,
  Role,
  Specialization,
  Squad,
  Task,
  TaskStatus,
} from './index';

export interface CrudCollectionMap {
  attendances: Attendances;
  briefingTemplates: BriefingTemplate;
  discoveryTypes: DiscoveryType;
  events: EventDoc;
  eventTypes: EventType;
  logs: LogEntry;
  medals: Medal;
  members: Member;
  positions: Position;
  profilePictures: ProfilePicture;
  questionnaireResponses: QuestionnaireResponse;
  questionnaires: Questionnaire;
  ranks: Rank;
  registrations: Registration;
  roles: Role;
  specializations: Specialization;
  squads: Squad;
  taskStatus: TaskStatus;
  tasks: Task;
}

export type CrudCollectionName = keyof CrudCollectionMap;

export type CrudMethodName =
  | `${CrudCollectionName}.read`
  | `${CrudCollectionName}.insert`
  | `${CrudCollectionName}.update`
  | `${CrudCollectionName}.remove`
  | `${CrudCollectionName}.bulkRemove`
  | `${CrudCollectionName}.count`
  | `${CrudCollectionName}.options`;

export interface SelectOption<T> {
  key: string;
  label: string;
  title: string;
  value: string;
  raw: T;
}
