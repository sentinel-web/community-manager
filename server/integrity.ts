// Referential-integrity engine. Single source of truth for what happens
// when a doc is deleted (block / setNull / pull / cascade) or when a doc
// is inserted/updated with foreign-key fields (validation).
//
// Slice #162 implements the `block` primitive end-to-end. Subsequent slices
// (#163 pull, #164 setNull, #165 cascade, #166 write validation) extend this
// module without changing its public surface.
//
// Load-bearing invariant: every operation issued by this engine must be
// idempotent under retry. `$pull` on an already-pulled array is a no-op;
// `$set: null` on an already-null field is a no-op; `removeAsync` on a
// missing doc is a no-op. The "best-effort sequential" execution model
// (no transactions) relies on this property — partial-failure retries
// must not double-mutate. Do NOT add non-idempotent logic ("decrement a
// counter", "append to a log array") inline inside an integrity primitive.

import { Meteor } from 'meteor/meteor';
import { COLLECTION_REGISTRY, type ForeignKeyEdge } from './collection-registry';
import { getCollection } from './crud.lib';
import { getSquadScope } from './main';
import type { CrudCollectionName } from '/imports/api/types';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface IncomingEdge {
  readonly source: CrudCollectionName;
  readonly field: string;
  readonly kind: ForeignKeyEdge['kind'];
  readonly onDelete: ForeignKeyEdge['onDelete'];
}

export type EffectsByCollection = Partial<Record<CrudCollectionName, number>>;

export interface IntegrityEffects {
  readonly pulled: EffectsByCollection;
  readonly setNull: EffectsByCollection;
  readonly cascaded: EffectsByCollection;
}

export interface BlockedByEntry {
  readonly source: CrudCollectionName;
  readonly count: number;
  readonly sample: string[];
}

export interface IntegrityPreview extends IntegrityEffects {
  readonly blockedBy: BlockedByEntry[];
}

export interface IntegrityContext {
  readonly userId: string | null;
}

const SAMPLE_LIMIT = 5;

// ────────────────────────────────────────────────────────────
// Inverted incoming-edges index
//
// Authored per-source on the registry; consumed per-target at delete time.
// Memoized on first read so additions to the registry during tests are
// picked up if the cache is reset (see resetIncomingEdgesCache for tests).
// ────────────────────────────────────────────────────────────

let cachedIncomingEdges: Map<CrudCollectionName, IncomingEdge[]> | null = null;

function buildIncomingEdges(): Map<CrudCollectionName, IncomingEdge[]> {
  const map = new Map<CrudCollectionName, IncomingEdge[]>();
  for (const [source, entry] of Object.entries(COLLECTION_REGISTRY) as Array<[CrudCollectionName, typeof COLLECTION_REGISTRY[CrudCollectionName]]>) {
    if (!entry.foreignKeys) continue;
    for (const edge of entry.foreignKeys) {
      const list = map.get(edge.target) ?? [];
      list.push({ source, field: edge.field, kind: edge.kind, onDelete: edge.onDelete });
      map.set(edge.target, list);
    }
  }
  return map;
}

function getIncomingEdges(target: CrudCollectionName): readonly IncomingEdge[] {
  if (!cachedIncomingEdges) cachedIncomingEdges = buildIncomingEdges();
  return cachedIncomingEdges.get(target) ?? [];
}

// Test seam: the integration tests exercise the engine against the real
// registry, so they don't need this. Reserved for future slices that may
// introduce test-only registry overrides (e.g. cycle-detection tests).
export function resetIncomingEdgesCache(): void {
  cachedIncomingEdges = null;
}

// ────────────────────────────────────────────────────────────
// Display-name resolution
// ────────────────────────────────────────────────────────────

function readDottedPath(doc: unknown, path: string): unknown {
  if (!doc || typeof doc !== 'object') return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, doc);
}

function resolveDisplayName(source: CrudCollectionName, doc: unknown): string {
  const displayField = COLLECTION_REGISTRY[source].displayField;
  if (displayField) {
    const value = readDottedPath(doc, displayField);
    if (typeof value === 'string' && value.length > 0) return value;
  }
  const id = readDottedPath(doc, '_id');
  return typeof id === 'string' ? id : '<unknown>';
}

// ────────────────────────────────────────────────────────────
// Edge query: build the Mongo selector that finds docs in `source`
// referencing `targetId` via this edge.
// ────────────────────────────────────────────────────────────

function buildEdgeSelector(edge: IncomingEdge, targetId: string): Record<string, unknown> {
  // Scalar and array fields share the same Mongo equality syntax: a query
  // on { 'profile.rankId': id } matches scalar refs; { 'attendees': id }
  // matches array refs (Mongo expands the equality across array elements).
  return { [edge.field]: targetId };
}

// ────────────────────────────────────────────────────────────
// Squad scope: applied only to `members` source samples.
// Counts are NOT scoped (so the modal preview is honest about total impact).
// ────────────────────────────────────────────────────────────

async function buildSampleSelector(
  edge: IncomingEdge,
  targetId: string,
  ctx: IntegrityContext,
): Promise<Record<string, unknown>> {
  const base = buildEdgeSelector(edge, targetId);
  if (edge.source !== 'members') return base;
  const scope = await getSquadScope(ctx.userId);
  return { ...base, ...scope };
}

// ────────────────────────────────────────────────────────────
// Shared traversal: powers both `enforce` and `preview`.
//
// `mode === 'execute'` throws on the first `block` hit (after collecting
// all blockers — admin gets the full breakdown in a single error).
// `mode === 'preview'` returns the same shape with `blockedBy` populated
// instead of throwing.
//
// Slice #162: only `block` is wired. Other primitives are stubbed —
// they fall through to the empty-effect branch and will be implemented
// in slices #163–165.
// ────────────────────────────────────────────────────────────

interface TraversalResult {
  readonly blockedBy: BlockedByEntry[];
  readonly effects: IntegrityEffects;
}

async function traverseIntegrityEdges(
  target: CrudCollectionName,
  targetId: string,
  ctx: IntegrityContext,
): Promise<TraversalResult> {
  const edges = getIncomingEdges(target);
  const blockedBy: BlockedByEntry[] = [];
  const effects: IntegrityEffects = { pulled: {}, setNull: {}, cascaded: {} };

  for (const edge of edges) {
    if (edge.onDelete === 'block') {
      const SourceCollection = getCollection(edge.source);
      const countSelector = buildEdgeSelector(edge, targetId);
      const count = await SourceCollection.find(countSelector).countAsync();
      if (count === 0) continue;

      const sampleSelector = await buildSampleSelector(edge, targetId, ctx);
      const sampleDocs = await SourceCollection.find(sampleSelector, { limit: SAMPLE_LIMIT }).fetchAsync();
      const sample = sampleDocs.map(doc => resolveDisplayName(edge.source, doc));
      blockedBy.push({ source: edge.source, count, sample });
      continue;
    }

    // Slices #163 (pull), #164 (setNull), #165 (cascade) extend here.
    // For #162 these primitives are not declared on any registry edge,
    // so the loop falls through silently.
  }

  return { blockedBy, effects };
}

// ────────────────────────────────────────────────────────────
// Public surface
// ────────────────────────────────────────────────────────────

export async function previewIntegrity(
  target: CrudCollectionName,
  targetId: string,
  ctx: IntegrityContext,
): Promise<IntegrityPreview> {
  const { blockedBy, effects } = await traverseIntegrityEdges(target, targetId, ctx);
  return { blockedBy, ...effects };
}

export async function enforceIntegrityOnDelete(
  target: CrudCollectionName,
  targetId: string,
  ctx: IntegrityContext,
): Promise<IntegrityEffects> {
  const { blockedBy, effects } = await traverseIntegrityEdges(target, targetId, ctx);
  if (blockedBy.length > 0) {
    const summary = blockedBy
      .map(b => `${b.count} ${b.source}`)
      .join(', ');
    throw new Meteor.Error(
      'foreign_key_blocked',
      `Cannot delete: in use by ${summary}`,
      { blockedBy },
    );
  }
  return effects;
}

// Builds the audit-payload `data` shape for a delete operation, attaching
// `cascadeEffects` only when at least one primitive produced an effect.
// Keeps the historical `{ id }` shape for the common no-cascade case.
function hasNonEmptyEffects(effects: IntegrityEffects): boolean {
  return (
    Object.keys(effects.pulled).length > 0 ||
    Object.keys(effects.setNull).length > 0 ||
    Object.keys(effects.cascaded).length > 0
  );
}

export function buildRemoveAuditPayload(
  id: string,
  effects?: IntegrityEffects,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { id };
  if (effects && hasNonEmptyEffects(effects)) {
    payload.cascadeEffects = effects;
  }
  return payload;
}
