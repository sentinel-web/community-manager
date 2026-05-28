// Edge index + path/selector helpers for the integrity engine.
//
// This unit owns the inverted incoming-edges index (authored per-source on
// the registry, consumed per-target at delete time), the dotted-path reader
// used to pull FK values and display names off documents, and the Mongo
// selector builders shared by every primitive.
//
// No Meteor / collection imports live here — it is pure data shaping over
// the registry, so it is trivially unit-testable.

import { COLLECTION_REGISTRY } from '../collection-registry';
import type { CrudCollectionName } from '/imports/api/types';
import type { IncomingEdge } from './types';

// ────────────────────────────────────────────────────────────
// Inverted incoming-edges index
//
// Memoized on first read so additions to the registry during tests are
// picked up if the cache is reset (see resetIncomingEdgesCache for tests).
// ────────────────────────────────────────────────────────────

let cachedIncomingEdges: Map<CrudCollectionName, IncomingEdge[]> | null = null;

function buildIncomingEdges(): Map<CrudCollectionName, IncomingEdge[]> {
  const map = new Map<CrudCollectionName, IncomingEdge[]>();
  for (const [source, entry] of Object.entries(COLLECTION_REGISTRY) as Array<
    [CrudCollectionName, (typeof COLLECTION_REGISTRY)[CrudCollectionName]]
  >) {
    if (!entry.foreignKeys) continue;
    for (const edge of entry.foreignKeys) {
      const list = map.get(edge.target) ?? [];
      list.push({ source, field: edge.field, kind: edge.kind, onDelete: edge.onDelete });
      map.set(edge.target, list);
    }
  }
  return map;
}

export function getIncomingEdges(target: CrudCollectionName): readonly IncomingEdge[] {
  if (!cachedIncomingEdges) cachedIncomingEdges = buildIncomingEdges();
  return cachedIncomingEdges.get(target) ?? [];
}

// Test seam: resets the memoized index so registry overrides injected by a
// test (e.g. the synthetic self-cascade cycle probe) take effect.
export function resetIncomingEdgesCache(): void {
  cachedIncomingEdges = null;
}

// ────────────────────────────────────────────────────────────
// Dotted-path read
// ────────────────────────────────────────────────────────────

export function readDottedPath(doc: unknown, path: string): unknown {
  if (!doc || typeof doc !== 'object') return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, doc);
}

// ────────────────────────────────────────────────────────────
// Display-name resolution
// ────────────────────────────────────────────────────────────

export function resolveDisplayName(source: CrudCollectionName, doc: unknown): string {
  const displayField = COLLECTION_REGISTRY[source].displayField;
  if (displayField) {
    const value = readDottedPath(doc, displayField);
    if (typeof value === 'string' && value.length > 0) return value;
  }
  const id = readDottedPath(doc, '_id');
  return typeof id === 'string' ? id : '<unknown>';
}

// ────────────────────────────────────────────────────────────
// Edge query: the Mongo selector that finds docs in `source` referencing
// `targetId` via this edge. Scalar and array fields share the same equality
// syntax — Mongo expands a scalar equality across array elements.
// ────────────────────────────────────────────────────────────

export function buildEdgeSelector(edge: IncomingEdge, targetId: string): Record<string, unknown> {
  return { [edge.field]: targetId };
}
