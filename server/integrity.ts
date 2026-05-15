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
// Block reporting is identical in both modes — count + sample names
// populate `blockedBy`; the caller decides whether to throw or return.
// Mutating primitives (pull / setNull / cascade) compute their effects
// in both modes but only apply mutations when `mode === 'execute'`. This
// keeps preview/execute equivalence cheap to verify: the same edge
// inspection produces the same counts; only the apply step differs.
//
// Slice #162: only `block` is wired. Slice #163 adds `pull`. Other
// primitives are stubbed — they fall through to the empty-effect branch
// and will be implemented in slices #164–165.
// ────────────────────────────────────────────────────────────

type TraversalMode = 'preview' | 'execute';

interface TraversalResult {
  readonly blockedBy: BlockedByEntry[];
  readonly effects: IntegrityEffects;
}

async function traverseIntegrityEdges(
  target: CrudCollectionName,
  targetId: string,
  ctx: IntegrityContext,
  mode: TraversalMode,
  visited: Set<string> = new Set(),
): Promise<TraversalResult> {
  // Cycle break: if we've already walked this (collection, id) higher in the
  // recursion stack, return empty so we don't infinite-loop. Real registries
  // shouldn't have cycles (cascade is reserved for owned relationships) but
  // a hypothetical mistake here would otherwise hang the server.
  const visitKey = `${target}:${targetId}`;
  if (visited.has(visitKey)) {
    return { blockedBy: [], effects: { pulled: {}, setNull: {}, cascaded: {} } };
  }
  visited.add(visitKey);

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

    if (edge.onDelete === 'pull') {
      const SourceCollection = getCollection(edge.source);
      const selector = buildEdgeSelector(edge, targetId);
      const count = await SourceCollection.find(selector).countAsync();
      if (count === 0) continue;

      if (mode === 'execute') {
        // $pull on an already-pulled array is a no-op, so this remains
        // idempotent under retry — the load-bearing property documented
        // in this file's header.
        await SourceCollection.updateAsync(
          selector as never,
          { $pull: { [edge.field]: targetId } } as never,
          { multi: true } as never,
        );
      }
      effects.pulled[edge.source] = (effects.pulled[edge.source] ?? 0) + count;
      continue;
    }

    if (edge.onDelete === 'setNull') {
      const SourceCollection = getCollection(edge.source);
      const selector = buildEdgeSelector(edge, targetId);
      const count = await SourceCollection.find(selector).countAsync();
      if (count === 0) continue;

      if (mode === 'execute') {
        // $set: null on an already-null field is a no-op (Mongo writes
        // unconditionally but the result matches the prior state), so
        // retries after partial failure don't double-mutate. Self-referential
        // edges (e.g. tasks.parent → tasks) work without special-casing:
        // the same updateMany re-points children to null whether or not
        // source and target are the same collection.
        await SourceCollection.updateAsync(
          selector as never,
          { $set: { [edge.field]: null } } as never,
          { multi: true } as never,
        );
      }
      effects.setNull[edge.source] = (effects.setNull[edge.source] ?? 0) + count;
      continue;
    }

    if (edge.onDelete === 'cascade') {
      const SourceCollection = getCollection(edge.source);
      const selector = buildEdgeSelector(edge, targetId);
      const referencingDocs = await SourceCollection.find(selector).fetchAsync();
      if (referencingDocs.length === 0) continue;

      for (const doc of referencingDocs) {
        const docId = (doc as { _id?: string })._id;
        if (!docId) continue;
        // Recurse so the cascaded doc's own integrity rules fire before
        // it's removed. Owned grandchildren get cleaned up first.
        const childResult = await traverseIntegrityEdges(edge.source, docId, ctx, mode, visited);

        // Propagate child blockers upward — block has primacy, and the
        // top-level enforce decides whether to throw. (In execute mode the
        // preview pass has already cleared all blockers, so this branch
        // accumulates empty arrays.)
        for (const entry of childResult.blockedBy) blockedBy.push(entry);

        // Merge child effect counts into ours by source key.
        for (const [src, n] of Object.entries(childResult.effects.pulled)) {
          effects.pulled[src as CrudCollectionName] = (effects.pulled[src as CrudCollectionName] ?? 0) + n;
        }
        for (const [src, n] of Object.entries(childResult.effects.setNull)) {
          effects.setNull[src as CrudCollectionName] = (effects.setNull[src as CrudCollectionName] ?? 0) + n;
        }
        for (const [src, n] of Object.entries(childResult.effects.cascaded)) {
          effects.cascaded[src as CrudCollectionName] = (effects.cascaded[src as CrudCollectionName] ?? 0) + n;
        }

        if (mode === 'execute') {
          // removeAsync on a missing doc is a no-op, preserving idempotence.
          await SourceCollection.removeAsync({ _id: docId } as never);
        }
      }

      effects.cascaded[edge.source] = (effects.cascaded[edge.source] ?? 0) + referencingDocs.length;
      continue;
    }
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
  const { blockedBy, effects } = await traverseIntegrityEdges(target, targetId, ctx, 'preview');
  return { blockedBy, ...effects };
}

// Batched preview used by the bulk-delete UX. Returns per-id previews so
// the client can aggregate or render per-row, plus an aggregate view that
// sums effect counts and concatenates blockers across all ids. Single
// round-trip instead of N parallel previewIntegrity calls.
export interface BulkIntegrityPreview {
  readonly perId: Record<string, IntegrityPreview>;
  readonly aggregate: IntegrityPreview;
  readonly blockedIds: string[];
}

export async function previewIntegrityBulk(
  target: CrudCollectionName,
  targetIds: readonly string[],
  ctx: IntegrityContext,
): Promise<BulkIntegrityPreview> {
  // Build mutable accumulators locally, then assemble the readonly result at
  // the end. Avoids the previous (aggregate.blockedBy as BlockedByEntry[])
  // cast that silently violated the readonly contract on IntegrityPreview.
  const perId: Record<string, IntegrityPreview> = {};
  const blockedBy: BlockedByEntry[] = [];
  const pulled: EffectsByCollection = {};
  const setNull: EffectsByCollection = {};
  const cascaded: EffectsByCollection = {};
  const blockedIds: string[] = [];

  // Each previewIntegrity creates its own `visited` Set internally, so the
  // per-id previews are independent and safe to race. The accumulator merge
  // happens after all settle — Promise.all preserves order so perId keys stay
  // stable.
  const previews = await Promise.all(targetIds.map(id => previewIntegrity(target, id, ctx)));
  for (let i = 0; i < targetIds.length; i++) {
    const id = targetIds[i];
    const preview = previews[i];
    perId[id] = preview;
    if (preview.blockedBy.length > 0) blockedIds.push(id);

    for (const entry of preview.blockedBy) blockedBy.push(entry);
    for (const [src, n] of Object.entries(preview.pulled)) {
      pulled[src as CrudCollectionName] = (pulled[src as CrudCollectionName] ?? 0) + n;
    }
    for (const [src, n] of Object.entries(preview.setNull)) {
      setNull[src as CrudCollectionName] = (setNull[src as CrudCollectionName] ?? 0) + n;
    }
    for (const [src, n] of Object.entries(preview.cascaded)) {
      cascaded[src as CrudCollectionName] = (cascaded[src as CrudCollectionName] ?? 0) + n;
    }
  }

  return { perId, aggregate: { blockedBy, pulled, setNull, cascaded }, blockedIds };
}

export async function enforceIntegrityOnDelete(
  target: CrudCollectionName,
  targetId: string,
  ctx: IntegrityContext,
): Promise<IntegrityEffects> {
  // Surface blockers before doing any mutating work — block has primacy
  // over pull/setNull/cascade, and we don't want to leave the DB in a
  // half-cleaned state when the operation was going to fail anyway. A
  // preview-mode pass collects all blockers cheaply (count + sample);
  // if any fire, we throw before the execute pass touches anything.
  //
  // TOCTOU note: the preview pass and execute pass are not atomic. A
  // concurrent insert between the two could introduce a new reference
  // that the execute pass misses, leaving a freshly-orphaned id behind.
  // Accepted trade-off for the admin tool's low-concurrency profile (see
  // PRD Q7: best-effort sequential, no transactions). If concurrent
  // admin writes become realistic, swap in a Mongo session here.
  const blockCheck = await traverseIntegrityEdges(target, targetId, ctx, 'preview');
  if (blockCheck.blockedBy.length > 0) {
    const summary = blockCheck.blockedBy
      .map(b => `${b.count} ${b.source}`)
      .join(', ');
    throw new Meteor.Error(
      'foreign_key_blocked',
      `Cannot delete: in use by ${summary}`,
      { blockedBy: blockCheck.blockedBy },
    );
  }
  const { effects } = await traverseIntegrityEdges(target, targetId, ctx, 'execute');
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

// ────────────────────────────────────────────────────────────
// Write-time foreign-key validation (#166)
//
// `validateForeignKeys` fires from the generic CRUD .insert and .update
// paths before the Mongo write. For inserts, every FK field present on the
// payload is validated (the doc is brand-new — no orphan tolerance needed).
// For updates, only FK fields actually being written are validated — a
// `$set: { name: 'x' }` on a doc whose stored rankId is stale must succeed,
// because the touched-fields rule is the rollout safety valve for existing
// orphans (per PRD Q12).
//
// `extractWrittenFKs` does the modifier-shape introspection in one place
// so the call sites stay declarative.
// ────────────────────────────────────────────────────────────

// One write to validate: an FK edge × the value being written. For
// `$push`/`$addToSet` on array FKs we get a single value (the appended
// element); for `$set` on a scalar FK we get the new scalar; for a
// bare-doc insert we yield each FK present on the doc.
interface WrittenFK {
  readonly edge: ForeignKeyEdge;
  readonly value: string;
}

// Yields every (edge, value) pair the modifier is actually writing.
// Operators that clear or remove (`$unset`, `$pull`) never produce orphans
// and are skipped. The catch-all bare-doc shape treats every FK on the
// doc as a written value (used by insert and rare whole-doc updates).
export function extractWrittenFKs(
  source: CrudCollectionName,
  modifier: unknown,
): WrittenFK[] {
  const edges = COLLECTION_REGISTRY[source].foreignKeys;
  if (!edges || edges.length === 0) return [];

  const isOperatorModifier =
    modifier !== null &&
    typeof modifier === 'object' &&
    !Array.isArray(modifier) &&
    Object.keys(modifier as Record<string, unknown>).some(k => k.startsWith('$'));

  const written: WrittenFK[] = [];

  if (!isOperatorModifier) {
    // Bare doc — treat every present FK as written.
    for (const edge of edges) {
      const raw = readDottedPath(modifier, edge.field);
      if (raw == null) continue;
      if (edge.kind === 'array') {
        for (const v of raw as unknown[]) {
          if (typeof v === 'string' && v.length > 0) written.push({ edge, value: v });
        }
      } else if (typeof raw === 'string' && raw.length > 0) {
        written.push({ edge, value: raw });
      }
    }
    return written;
  }

  const mod = modifier as Record<string, unknown>;
  const set = (mod.$set ?? {}) as Record<string, unknown>;
  const push = (mod.$push ?? {}) as Record<string, unknown>;
  const addToSet = (mod.$addToSet ?? {}) as Record<string, unknown>;
  // $unset clears; $pull removes; $inc / $rename / $pop / $pullAll aren't FK-relevant.

  for (const edge of edges) {
    if (Object.prototype.hasOwnProperty.call(set, edge.field)) {
      const value = set[edge.field];
      if (value == null) continue; // setting to null/undefined is a clear, always valid
      if (edge.kind === 'array' && Array.isArray(value)) {
        for (const v of value) {
          if (typeof v === 'string' && v.length > 0) written.push({ edge, value: v });
        }
      } else if (typeof value === 'string' && value.length > 0) {
        written.push({ edge, value });
      }
    }

    if (edge.kind === 'array') {
      for (const op of [push, addToSet]) {
        if (!Object.prototype.hasOwnProperty.call(op, edge.field)) continue;
        const raw = op[edge.field];
        const value = (raw as { $each?: unknown })?.$each !== undefined
          ? (raw as { $each: unknown[] }).$each
          : raw;
        if (Array.isArray(value)) {
          for (const v of value) {
            if (typeof v === 'string' && v.length > 0) written.push({ edge, value: v });
          }
        } else if (typeof value === 'string' && value.length > 0) {
          written.push({ edge, value });
        }
      }
    }
  }

  return written;
}

// Validates every (edge, value) the modifier writes against the target
// collection's existence. Throws `foreign_key_invalid` on the first miss
// — a single bad FK is enough to reject the write.
export async function validateForeignKeys(
  source: CrudCollectionName,
  modifier: unknown,
): Promise<void> {
  const written = extractWrittenFKs(source, modifier);
  if (written.length === 0) return;

  // Race the existence checks — each hits a different target collection and
  // value, no dependency between them. If any FK is invalid we still throw,
  // just on whichever query resolves first rather than strict iteration order.
  await Promise.all(
    written.map(async ({ edge, value }) => {
      const TargetCollection = getCollection(edge.target);
      const exists = await TargetCollection.findOneAsync({ _id: value } as never);
      if (!exists) {
        throw new Meteor.Error(
          'foreign_key_invalid',
          `${edge.field} references non-existent ${edge.target} ${value}`,
          { field: edge.field, target: edge.target, value },
        );
      }
    }),
  );
}

// ────────────────────────────────────────────────────────────
// Orphan scanner (#167)
//
// Walks every foreign-key edge against the live database and reports
// any reference whose target doc no longer exists. Read-only; safe to
// run on production. Intended for the on-demand `npm run integrity-scan`
// CLI and any future admin UI surface.
// ────────────────────────────────────────────────────────────

export interface OrphanRecord {
  readonly source: CrudCollectionName;
  readonly field: string;
  readonly sourceId: string;
  readonly orphanedTargetId: string;
}

async function getDistinctReferencedIds(
  source: CrudCollectionName,
  edge: ForeignKeyEdge,
): Promise<Map<string, string[]>> {
  // Map of target-id → list of source-doc ids that reference it. Used to
  // batch the existence query so we hit the target collection once per
  // unique referenced id, regardless of how many source docs cite it.
  const SourceCollection = getCollection(source);
  const referencedToSourceDocs = new Map<string, string[]>();

  await SourceCollection.find({ [edge.field]: { $exists: true, $ne: null } } as never).forEachAsync(doc => {
    const sourceDocId = (doc as { _id?: string })._id;
    if (!sourceDocId) return;
    const raw = readDottedPath(doc, edge.field);
    if (raw == null) return;
    const values: string[] = edge.kind === 'array'
      ? (Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [])
      : (typeof raw === 'string' ? [raw] : []);
    for (const value of values) {
      const list = referencedToSourceDocs.get(value) ?? [];
      list.push(sourceDocId);
      referencedToSourceDocs.set(value, list);
    }
  });

  return referencedToSourceDocs;
}

export async function scanForOrphans(): Promise<OrphanRecord[]> {
  const orphans: OrphanRecord[] = [];

  for (const [source, entry] of Object.entries(COLLECTION_REGISTRY) as Array<[CrudCollectionName, typeof COLLECTION_REGISTRY[CrudCollectionName]]>) {
    if (!entry.foreignKeys) continue;
    // Race the per-edge scans within one collection — each edge targets a
    // different collection and has no dependency on its siblings.
    const edgeScans = await Promise.all(
      entry.foreignKeys.map(async edge => {
        const referencedIds = await getDistinctReferencedIds(source, edge);
        if (referencedIds.size === 0) return { edge, referencedIds, existingIds: new Set<string>() };
        const TargetCollection = getCollection(edge.target);
        const existingDocs = await TargetCollection.find(
          { _id: { $in: Array.from(referencedIds.keys()) } } as never,
          { fields: { _id: 1 } as never } as never,
        ).fetchAsync();
        const existingIds = new Set(existingDocs.map(d => (d as { _id: string })._id));
        return { edge, referencedIds, existingIds };
      }),
    );
    for (const { edge, referencedIds, existingIds } of edgeScans) {
      if (referencedIds.size === 0) continue;

      for (const [referencedId, sourceIds] of referencedIds) {
        if (existingIds.has(referencedId)) continue;
        for (const sourceId of sourceIds) {
          orphans.push({
            source,
            field: edge.field,
            sourceId,
            orphanedTargetId: referencedId,
          });
        }
      }
    }
  }

  return orphans;
}
