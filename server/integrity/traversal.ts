// Shared traversal: the single graph walk that powers both `enforce` and
// `preview`.
//
// Block reporting is identical in both modes — count + sample names populate
// `blockedBy`; the caller decides whether to throw or return. Mutating
// primitives (pull / setNull / cascade) compute their effects in both modes
// but only apply mutations when `mode === 'execute'`. This keeps
// preview/execute equivalence cheap to verify: the same edge inspection
// produces the same counts; only the apply step differs.
//
// Load-bearing invariant: every mutation issued here must be idempotent
// under retry. `$pull` on an already-pulled array is a no-op; `$set: null`
// on an already-null field is a no-op; `removeAsync` on a missing doc is a
// no-op. The "best-effort sequential" execution model (no transactions)
// relies on this property — partial-failure retries must not double-mutate.
// Do NOT add non-idempotent logic ("decrement a counter", "append to a log
// array") inline inside an integrity primitive.

import { getCollection } from '../crud.lib';
import { getSquadScope } from '../main';
import type { CrudCollectionName } from '/imports/api/types';
import { buildEdgeSelector, getIncomingEdges, resolveDisplayName } from './edges';
import {
  SAMPLE_LIMIT,
  type BlockedByEntry,
  type IncomingEdge,
  type IntegrityContext,
  type IntegrityEffects,
  type TraversalMode,
  type TraversalResult,
} from './types';

// ────────────────────────────────────────────────────────────
// Squad scope: applied only to `members` source samples. Counts are NOT
// scoped (so the modal preview is honest about total impact).
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

function mergeEffectCounts(into: Record<string, number>, from: Record<string, number>): void {
  for (const [src, n] of Object.entries(from)) {
    into[src] = (into[src] ?? 0) + n;
  }
}

export async function traverseIntegrityEdges(
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
        // idempotent under retry — the load-bearing property documented above.
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
        // $set: null on an already-null field is a no-op, so retries after
        // partial failure don't double-mutate. Self-referential edges (e.g.
        // tasks.parent → tasks) work without special-casing.
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
        // Recurse so the cascaded doc's own integrity rules fire before it's
        // removed. Owned grandchildren get cleaned up first.
        const childResult = await traverseIntegrityEdges(edge.source, docId, ctx, mode, visited);

        // Propagate child blockers upward — block has primacy, and the
        // top-level enforce decides whether to throw.
        for (const entry of childResult.blockedBy) blockedBy.push(entry);

        mergeEffectCounts(effects.pulled as Record<string, number>, childResult.effects.pulled as Record<string, number>);
        mergeEffectCounts(effects.setNull as Record<string, number>, childResult.effects.setNull as Record<string, number>);
        mergeEffectCounts(
          effects.cascaded as Record<string, number>,
          childResult.effects.cascaded as Record<string, number>,
        );

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
