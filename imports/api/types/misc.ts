import type { ColoredEntity } from './shared';

export type Medal = ColoredEntity;
export type EventType = ColoredEntity;
export type TaskStatus = ColoredEntity;
export type DiscoveryType = ColoredEntity;
export interface Position extends ColoredEntity {
  order?: number;
}

export interface Specialization extends ColoredEntity {
  linkToFile?: string;
  instructors?: string[];
  requiredSpecializations?: string[];
  requiredRankId?: string;
}

export interface Registration {
  _id?: string;
  name: string;
  id: number;
  age: number;
  discoveryType?: string;
  rulesReadAndAccepted: boolean;
  description?: string;
}

export interface ProfilePicture {
  _id?: string;
  value: string;
}

export interface SettingDoc {
  _id?: string;
  key: string;
  value: unknown;
}

export interface LogEntry {
  _id?: string;
  action: string;
  payload?: Record<string, unknown>;
  timestamp?: Date;
  createdAt: Date;
}
