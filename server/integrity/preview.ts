// Preview: non-mutating reads of the integrity graph that power the
// delete-confirmation modal and the bulk-delete UX. Both run the shared
// traversal in `preview` mode.

import type { CrudCollectionName } from '/imports/api/types';
import { traverseIntegrityEdges } from './traversal';
import type {
  BlockedByEntry,
  BulkIntegrityPreview,
  EffectsByCollection,
  IntegrityContext,
  IntegrityPreview,
} from './types';

export async function previewIntegrity(
  target: CrudCollectionName,
  targetId: string,
  ctx: IntegrityContext,
): Promise<IntegrityPreview> {
  const { blockedBy, effects } = await traverseIntegrityEdges(target, targetId, ctx, 'preview');
  return { blockedBy, ...effects };
}

// Batched preview used by the bulk-delete UX. Returns per-id previews so the
// client can aggregate or render per-row, plus an aggregate view that sums
// effect counts and concatenates blockers across all ids. Single round-trip
// instead of N parallel previewIntegrity calls.
export async function previewIntegrityBulk(
  target: CrudCollectionName,
  targetIds: readonly string[],
  ctx: IntegrityContext,
): Promise<BulkIntegrityPreview> {
  // Build mutable accumulators locally, then assemble the readonly result at
  // the end.
  const perId: Record<string, IntegrityPreview> = {};
  const blockedBy: BlockedByEntry[] = [];
  const pulled: EffectsByCollection = {};
  const setNull: EffectsByCollection = {};
  const cascaded: EffectsByCollection = {};
  const blockedIds: string[] = [];

  // Each previewIntegrity creates its own `visited` Set internally, so the
  // per-id previews are independent and safe to race. Promise.all preserves
  // order so perId keys stay stable.
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
