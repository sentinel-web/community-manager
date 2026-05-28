// Shared types for the referential-integrity engine.
//
// Kept in one small module so the concern-specific units (edges, traversal,
// delete, preview, write-validation, orphans) can import the shapes without
// creating a dependency cycle between them.

import type { ForeignKeyEdge } from '../collection-registry';
import type { CrudCollectionName } from '/imports/api/types';

// One incoming edge: a source collection's reference to a target, inverted
// from the per-source `foreignKeys` authored on the registry.
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

// Batched preview used by the bulk-delete UX. Returns per-id previews so
// the client can aggregate or render per-row, plus an aggregate view that
// sums effect counts and concatenates blockers across all ids.
export interface BulkIntegrityPreview {
  readonly perId: Record<string, IntegrityPreview>;
  readonly aggregate: IntegrityPreview;
  readonly blockedIds: string[];
}

// One write to validate: an FK edge × the value being written.
export interface WrittenFK {
  readonly edge: ForeignKeyEdge;
  readonly value: string;
}

// One orphaned reference found by the scanner: a source doc whose FK field
// points at a target id that no longer exists.
export interface OrphanRecord {
  readonly source: CrudCollectionName;
  readonly field: string;
  readonly sourceId: string;
  readonly orphanedTargetId: string;
}

// Modes shared by the traversal: a `preview` pass computes effect counts and
// blockers without mutating; an `execute` pass additionally applies the
// pull/setNull/cascade mutations.
export type TraversalMode = 'preview' | 'execute';

export interface TraversalResult {
  readonly blockedBy: BlockedByEntry[];
  readonly effects: IntegrityEffects;
}

export const SAMPLE_LIMIT = 5;
