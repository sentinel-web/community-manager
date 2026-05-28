// Delete enforcement: the top-level `enforceIntegrityOnDelete` entrypoint
// the CRUD `.remove` path and the custom members.remove path call before
// removing a document, plus the audit-payload builder.

import { Meteor } from 'meteor/meteor';
import type { CrudCollectionName } from '/imports/api/types';
import { traverseIntegrityEdges } from './traversal';
import type { IntegrityContext, IntegrityEffects } from './types';

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
  // Accepted trade-off for the admin tool's low-concurrency profile.
  const blockCheck = await traverseIntegrityEdges(target, targetId, ctx, 'preview');
  if (blockCheck.blockedBy.length > 0) {
    const summary = blockCheck.blockedBy.map(b => `${b.count} ${b.source}`).join(', ');
    throw new Meteor.Error('foreign_key_blocked', `Cannot delete: in use by ${summary}`, {
      blockedBy: blockCheck.blockedBy,
    });
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

export function buildRemoveAuditPayload(id: string, effects?: IntegrityEffects): Record<string, unknown> {
  const payload: Record<string, unknown> = { id };
  if (effects && hasNonEmptyEffects(effects)) {
    payload.cascadeEffects = effects;
  }
  return payload;
}
