// Referential-integrity engine — public surface.
//
// Single source of truth for what happens when a doc is deleted
// (block / setNull / pull / cascade) or when a doc is inserted/updated with
// foreign-key fields (validation). Previously a single ~616-line module;
// split by concern into focused, independently-testable units (#267):
//
//   types.ts            — shared interfaces (effects, preview, contexts).
//   edges.ts            — inverted incoming-edges index, dotted-path read,
//                         display-name resolution, edge selectors.
//   traversal.ts        — the single graph walk + the four delete primitives.
//   delete.ts           — enforceIntegrityOnDelete + audit-payload builder.
//   preview.ts          — previewIntegrity / previewIntegrityBulk.
//   writeValidation.ts  — write-time FK validation (touched-fields + full-doc).
//   orphans.ts          — orphan scanner + one-off migration resolver.
//
// This barrel re-exports the exact public API the rest of the server
// imports (`./integrity`, `../integrity`, `/server/integrity`), so the
// split is invisible to callers.

export { resetIncomingEdgesCache } from './edges';
export { buildRemoveAuditPayload, enforceIntegrityOnDelete } from './delete';
export { previewIntegrity, previewIntegrityBulk } from './preview';
export {
  collectForeignKeyValues,
  extractWrittenFKs,
  validateForeignKeys,
  validateForeignKeysForUpdate,
  validateForeignKeysOnDoc,
} from './writeValidation';
export { resolveOrphans, scanForOrphans, type OrphanResolution } from './orphans';

export type {
  BlockedByEntry,
  BulkIntegrityPreview,
  EffectsByCollection,
  IncomingEdge,
  IntegrityContext,
  IntegrityEffects,
  IntegrityPreview,
  OrphanRecord,
  WrittenFK,
} from './types';
