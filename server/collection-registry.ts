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
  readonly allowsAnonymous?: { readonly insert?: boolean };
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
  discoveryTypes: { module: 'discoveryTypes' },
  events: {
    module: 'events',
    fallback: { create: 'canCreateEvents' },
    displayField: 'name',
    foreignKeys: [
      { field: 'hosts', target: 'members', kind: 'array', onDelete: 'pull' },
      { field: 'attendees', target: 'members', kind: 'array', onDelete: 'pull' },
    ],
  },
  eventTypes: { module: 'eventTypes' },
  logs: { module: 'logs' },
  medals: { module: 'medals' },
  members: {
    module: 'members',
    redact: { insert: ['password'] },
    displayField: 'profile.name',
    foreignKeys: [
      { field: 'profile.rankId', target: 'ranks', kind: 'scalar', onDelete: 'block' },
      { field: 'profile.specializationIds', target: 'specializations', kind: 'array', onDelete: 'pull' },
      { field: 'profile.medalIds', target: 'medals', kind: 'array', onDelete: 'pull' },
    ],
  },
  positions: { module: 'positions' },
  profilePictures: { module: 'members' },
  questionnaireResponses: { module: 'questionnaires' },
  questionnaires: { module: 'questionnaires' },
  ranks: { module: 'ranks', displayField: 'name' },
  registrations: { module: 'registrations', allowsAnonymous: { insert: true } },
  roles: { module: 'roles', displayField: 'name' },
  specializations: {
    module: 'specializations',
    displayField: 'name',
    foreignKeys: [
      { field: 'instructors', target: 'members', kind: 'array', onDelete: 'pull' },
      { field: 'requiredSpecializations', target: 'specializations', kind: 'array', onDelete: 'pull' },
    ],
  },
  squads: { module: 'squads', displayField: 'name' },
  taskStatus: { module: 'taskStatus', displayField: 'name' },
  tasks: {
    module: 'tasks',
    fallback: { create: 'canManageTasks', update: 'canManageTasks' },
    displayField: 'name',
    foreignKeys: [
      { field: 'participants', target: 'members', kind: 'array', onDelete: 'pull' },
      { field: 'completedBy', target: 'members', kind: 'array', onDelete: 'pull' },
    ],
  },
};
