import type { ColoredEntity } from './shared';

export type Medal = ColoredEntity;
export type EventType = ColoredEntity;
export type TaskStatus = ColoredEntity;

/** A reusable rich-text briefing block; `content` holds sanitized HTML (ADR 0001). */
export interface BriefingTemplate extends ColoredEntity {
  content?: string;
}
export interface DiscoveryType extends ColoredEntity {
  hasTextInput?: boolean;
}
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
  discoveryType?: string | null;
  discoveryTypeDetails?: string | null;
  steamProfileLink?: string | null;
  discordTag?: string | null;
  rulesReadAndAccepted: boolean;
  description?: string | null;
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
