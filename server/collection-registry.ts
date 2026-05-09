import type { CrudCollectionName } from '/imports/api/types';

export interface CollectionRegistryEntry {
  readonly module: string;
  readonly fallback?: { readonly create?: string; readonly update?: string };
  readonly allowsAnonymous?: { readonly insert?: boolean };
  readonly redact?: { readonly insert?: readonly string[]; readonly update?: readonly string[] };
}

// Per-collection metadata. The Record<CrudCollectionName, _> type forces
// every member of the canonical collection-name union to have an entry —
// adding a collection to the union without updating this map is a compile
// error. The runtime shape-conformance test in permissions.test.ts catches
// the same omission under loosened type checks.
export const COLLECTION_REGISTRY: Record<CrudCollectionName, CollectionRegistryEntry> = {
  attendances: { module: 'events' },
  discoveryTypes: { module: 'discoveryTypes' },
  events: { module: 'events', fallback: { create: 'canCreateEvents' } },
  eventTypes: { module: 'eventTypes' },
  logs: { module: 'logs' },
  medals: { module: 'medals' },
  members: { module: 'members', redact: { insert: ['password'] } },
  positions: { module: 'positions' },
  profilePictures: { module: 'members' },
  questionnaireResponses: { module: 'questionnaires' },
  questionnaires: { module: 'questionnaires' },
  ranks: { module: 'ranks' },
  registrations: { module: 'registrations', allowsAnonymous: { insert: true } },
  roles: { module: 'roles' },
  specializations: { module: 'specializations' },
  squads: { module: 'squads' },
  taskStatus: { module: 'taskStatus' },
  tasks: { module: 'tasks', fallback: { create: 'canManageTasks', update: 'canManageTasks' } },
};
