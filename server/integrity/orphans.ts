// Orphan scanner + one-off migration resolver.
//
// `scanForOrphans` walks every foreign-key edge against the live database
// and reports any reference whose target doc no longer exists. Read-only;
// safe to run on production.
//
// `resolveOrphans` is the one-off migration counterpart: it applies the same
// on-delete primitive each edge declares (pull / setNull) to the orphaned
// reference, so a database with pre-existing orphans can be cleaned BEFORE
// full-document FK enforcement (decision O-6) is switched on — otherwise
// edits to already-orphaned rows would start failing. `block`/`cascade`
// edges are reported as `skipped` rather than auto-resolved: an orphaned
// block reference points at deleted data the operator must reconcile by
// hand, and cascade orphans imply the parent is already gone.

import { COLLECTION_REGISTRY, type ForeignKeyEdge } from '../collection-registry';
import { getCollection } from '../crud.lib';
import type { CrudCollectionName } from '/imports/api/types';
import { readDottedPath } from './edges';
import type { OrphanRecord } from './types';

async function getDistinctReferencedIds(
  source: CrudCollectionName,
  edge: ForeignKeyEdge,
): Promise<Map<string, string[]>> {
  // Map of target-id → list of source-doc ids that reference it. Used to
  // batch the existence query so we hit the target collection once per unique
  // referenced id, regardless of how many source docs cite it.
  const SourceCollection = getCollection(source);
  const referencedToSourceDocs = new Map<string, string[]>();

  await SourceCollection.find({ [edge.field]: { $exists: true, $ne: null } } as never).forEachAsync(doc => {
    const sourceDocId = (doc as { _id?: string })._id;
    if (!sourceDocId) return;
    const raw = readDottedPath(doc, edge.field);
    if (raw == null) return;
    const values: string[] =
      edge.kind === 'array'
        ? Array.isArray(raw)
          ? raw.filter((v): v is string => typeof v === 'string')
          : []
        : typeof raw === 'string'
          ? [raw]
          : [];
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

  for (const [source, entry] of Object.entries(COLLECTION_REGISTRY) as Array<
    [CrudCollectionName, (typeof COLLECTION_REGISTRY)[CrudCollectionName]]
  >) {
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
          orphans.push({ source, field: edge.field, sourceId, orphanedTargetId: referencedId });
        }
      }
    }
  }

  return orphans;
}

// ────────────────────────────────────────────────────────────
// One-off migration: resolve orphans by applying each edge's declared
// on-delete primitive to the dangling reference. Designed to run BEFORE
// full-document enforcement is enabled.
// ────────────────────────────────────────────────────────────

export interface OrphanResolution {
  // Orphans cleared by $pull (array FKs) or $set:null (scalar FKs).
  readonly pulled: number;
  readonly setNull: number;
  // Orphaned `block` / `cascade` references left untouched — these require
  // manual operator reconciliation. Reported so the migration is auditable.
  readonly skipped: OrphanRecord[];
}

export async function resolveOrphans(options: { dryRun?: boolean } = {}): Promise<OrphanResolution> {
  const { dryRun = false } = options;
  const orphans = await scanForOrphans();

  // Index the declared on-delete primitive per (source, field) so we know how
  // to resolve each orphan.
  const onDeleteByEdge = new Map<string, ForeignKeyEdge['onDelete']>();
  const kindByEdge = new Map<string, ForeignKeyEdge['kind']>();
  for (const entry of Object.values(COLLECTION_REGISTRY)) {
    if (!entry.foreignKeys) continue;
    for (const edge of entry.foreignKeys) {
      onDeleteByEdge.set(`${edge.field}`, edge.onDelete);
      kindByEdge.set(`${edge.field}`, edge.kind);
    }
  }

  let pulled = 0;
  let setNull = 0;
  const skipped: OrphanRecord[] = [];

  for (const orphan of orphans) {
    const onDelete = onDeleteByEdge.get(orphan.field);
    const Source = getCollection(orphan.source);

    if (onDelete === 'pull') {
      if (!dryRun) {
        await Source.updateAsync(
          { _id: orphan.sourceId } as never,
          { $pull: { [orphan.field]: orphan.orphanedTargetId } } as never,
        );
      }
      pulled++;
    } else if (onDelete === 'setNull') {
      if (!dryRun) {
        await Source.updateAsync(
          { _id: orphan.sourceId } as never,
          { $set: { [orphan.field]: null } } as never,
        );
      }
      setNull++;
    } else {
      // block / cascade / unknown — leave it for the operator.
      skipped.push(orphan);
    }
  }

  return { pulled, setNull, skipped };
}
