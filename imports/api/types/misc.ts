import type { ColoredEntity } from './shared';

export type Medal = ColoredEntity;
export type TaskStatus = ColoredEntity;

/**
 * `countsForInactivity` (#366): unset means true. When false, unexcused
 * absences at events of this type add no inactivity points.
 */
export interface EventType extends ColoredEntity {
  countsForInactivity?: boolean;
}

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
  /** Server-set on insert (never client-supplied); absent on registrations created before #377. */
  createdAt?: Date;
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
