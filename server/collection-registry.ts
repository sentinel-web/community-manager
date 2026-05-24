import type { CrudCollectionName } from '/imports/api/types';

export type ForeignKeyOnDelete = 'block' | 'setNull' | 'pull' | 'cascade';
export type ForeignKeyKind = 'scalar' | 'array';

export interface ForeignKeyEdge {
  // Dotted path on the source doc (e.g. 'profile.rankId').
  readonly field: string;
  readonly target: CrudCollectionName;
  readonly kind: ForeignKeyKind;
  readonly onDelete: ForeignKeyOnDelete;
}

export interface CollectionRegistryEntry {
  readonly module: string;
  readonly fallback?: { readonly create?: string; readonly update?: string };
  // `insert` opens the generic `.insert` method to unauthenticated callers
  // (see mutation-pipeline.ts); `read` opens the generic publication to them
  // (see crud.lib.ts). Both are opt-in per collection and default to gated.
  readonly allowsAnonymous?: { readonly insert?: boolean; readonly read?: boolean };
  readonly redact?: { readonly insert?: readonly string[]; readonly update?: readonly string[] };
  // Outgoing foreign-key edges (this collection's references to other collections).
  // Inverted to incoming-edges at boot inside server/integrity.ts.
  readonly foreignKeys?: readonly ForeignKeyEdge[];
  // Dotted path on the source doc whose value is used as a human-readable
  // sample when this collection appears in a `block` error's `details.blockedBy`.
  readonly displayField?: string;
}

// Per-collection metadata. The Record<CrudCollectionName, _> type forces
// every member of the canonical collection-name union to have an entry —
// adding a collection to the union without updating this map is a compile
// error. The runtime shape-conformance test in permissions.test.ts catches
// the same omission under loosened type checks.
export const COLLECTION_REGISTRY: Record<CrudCollectionName, CollectionRegistryEntry> = {
  attendances: { module: 'events' },
  briefingTemplates: { module: 'briefingTemplates', displayField: 'name' },
  // Discovery types are surfaced on the public (pre-auth) registration form,
  // so guests must be able to read them. The docs carry nothing sensitive.
  discoveryTypes: { module: 'discoveryTypes', allowsAnonymous: { read: true } },
  events: {
    module: 'events',
    fallback: { create: 'canCreateEvents' },
    displayField: 'name',
    foreignKeys: [
      { field: 'eventType', target: 'eventTypes', kind: 'scalar', onDelete: 'block' },
      { field: 'hosts', target: 'members', kind: 'array', onDelete: 'pull' },
      { field: 'attendees', target: 'members', kind: 'array', onDelete: 'pull' },
    ],
  },
  eventTypes: { module: 'eventTypes' },
  logs: { module: 'logs' },
  medals: { module: 'medals' },
  members: {
    module: 'members',
    redact: { insert: ['password'], update: ['password'] },
    displayField: 'profile.name',
    foreignKeys: [
      { field: 'profile.roleId', target: 'roles', kind: 'scalar', onDelete: 'block' },
      { field: 'profile.rankId', target: 'ranks', kind: 'scalar', onDelete: 'block' },
      { field: 'profile.navyRankId', target: 'ranks', kind: 'scalar', onDelete: 'setNull' },
      { field: 'profile.positionId', target: 'positions', kind: 'scalar', onDelete: 'setNull' },
      { field: 'profile.squadId', target: 'squads', kind: 'scalar', onDelete: 'setNull' },
      { field: 'profile.specializationIds', target: 'specializations', kind: 'array', onDelete: 'pull' },
      { field: 'profile.medalIds', target: 'medals', kind: 'array', onDelete: 'pull' },
    ],
  },
  positions: { module: 'positions' },
  profilePictures: { module: 'members' },
  questionnaireResponses: {
    module: 'questionnaires',
    foreignKeys: [
      { field: 'respondentId', target: 'members', kind: 'scalar', onDelete: 'setNull' },
      { field: 'questionnaireId', target: 'questionnaires', kind: 'scalar', onDelete: 'cascade' },
    ],
  },
  questionnaires: { module: 'questionnaires' },
  ranks: {
    module: 'ranks',
    displayField: 'name',
    foreignKeys: [
      { field: 'previousRankId', target: 'ranks', kind: 'scalar', onDelete: 'setNull' },
      { field: 'nextRankId', target: 'ranks', kind: 'scalar', onDelete: 'setNull' },
    ],
  },
  registrations: {
    module: 'registrations',
    allowsAnonymous: { insert: true },
    foreignKeys: [
      { field: 'discoveryType', target: 'discoveryTypes', kind: 'scalar', onDelete: 'setNull' },
    ],
  },
  roles: { module: 'roles', displayField: 'name' },
  specializations: {
    module: 'specializations',
    displayField: 'name',
    foreignKeys: [
      { field: 'instructors', target: 'members', kind: 'array', onDelete: 'pull' },
      { field: 'requiredSpecializations', target: 'specializations', kind: 'array', onDelete: 'pull' },
      { field: 'requiredRankId', target: 'ranks', kind: 'scalar', onDelete: 'setNull' },
    ],
  },
  squads: {
    module: 'squads',
    displayField: 'name',
    foreignKeys: [
      { field: 'parentSquadId', target: 'squads', kind: 'scalar', onDelete: 'setNull' },
    ],
  },
  taskStatus: { module: 'taskStatus', displayField: 'name' },
  tasks: {
    module: 'tasks',
    fallback: { create: 'canManageTasks', update: 'canManageTasks' },
    displayField: 'name',
    foreignKeys: [
      { field: 'status', target: 'taskStatus', kind: 'scalar', onDelete: 'block' },
      { field: 'participants', target: 'members', kind: 'array', onDelete: 'pull' },
      { field: 'completedBy', target: 'members', kind: 'array', onDelete: 'pull' },
      { field: 'parent', target: 'tasks', kind: 'scalar', onDelete: 'setNull' },
    ],
  },
};
