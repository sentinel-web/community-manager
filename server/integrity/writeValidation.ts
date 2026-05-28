// Write-time foreign-key validation.
//
// Fires from the generic CRUD .insert/.update paths (and the custom
// members.* paths) before the Mongo write. Decision O-6 enforces FULL-
// DOCUMENT integrity: every FK field declared in the registry must resolve
// to an existing target on the *resulting* document, not only the fields a
// given write happens to touch. This supersedes the earlier touched-fields-
// only rule (RULE-027).
//
//   - insert: validate every FK present on the brand-new doc (touched and
//     full coincide — the payload IS the whole doc).
//   - update: validate every FK present on (storedDoc ⊕ modifier) — the
//     document as it will exist after the write. A `$set: { name }` on a doc
//     whose stored rankId is now an orphan is rejected, because the merged
//     doc still carries the dangling rankId. Run the orphan migration
//     (scripts/integrity-scan.ts / integrity.scanResolve) before enabling
//     this in production, or pre-existing orphans will block unrelated edits.
//
// `extractWrittenFKs` (touched-fields introspection) is retained for the
// insert path and for unit tests that pin modifier-shape parsing; the
// full-document path is `collectForeignKeyValues` + `validateForeignKeysOnDoc`.

import { Meteor } from 'meteor/meteor';
import { COLLECTION_REGISTRY, type ForeignKeyEdge } from '../collection-registry';
import { getCollection } from '../crud.lib';
import type { CrudCollectionName } from '/imports/api/types';
import { readDottedPath } from './edges';
import type { WrittenFK } from './types';

// ────────────────────────────────────────────────────────────
// Touched-fields modifier introspection (insert path + unit tests).
//
// Yields every (edge, value) pair the modifier is actually writing.
// Operators that clear or remove (`$unset`, `$pull`) never produce orphans
// and are skipped. The catch-all bare-doc shape treats every FK on the doc
// as a written value (used by insert and rare whole-doc updates).
// ────────────────────────────────────────────────────────────

export function extractWrittenFKs(source: CrudCollectionName, modifier: unknown): WrittenFK[] {
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
      if (value == null) {
        // setting to null/undefined is a clear, always valid
      } else if (edge.kind === 'array' && Array.isArray(value)) {
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
        const value =
          (raw as { $each?: unknown })?.$each !== undefined ? (raw as { $each: unknown[] }).$each : raw;
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

// ────────────────────────────────────────────────────────────
// Full-document FK collection (O-6).
//
// Given a complete document, yield every (edge, value) pair for FK fields
// present on it. Used by the full-doc validation path: insert validates the
// payload directly; update validates the stored doc merged with its modifier.
// ────────────────────────────────────────────────────────────

export function collectForeignKeyValues(source: CrudCollectionName, doc: unknown): WrittenFK[] {
  const edges = COLLECTION_REGISTRY[source].foreignKeys;
  if (!edges || edges.length === 0) return [];

  const collected: WrittenFK[] = [];
  for (const edge of edges) {
    const raw = readDottedPath(doc, edge.field);
    if (raw == null) continue;
    if (edge.kind === 'array') {
      if (!Array.isArray(raw)) continue;
      for (const v of raw) {
        if (typeof v === 'string' && v.length > 0) collected.push({ edge, value: v });
      }
    } else if (typeof raw === 'string' && raw.length > 0) {
      collected.push({ edge, value: raw });
    }
  }
  return collected;
}

// ────────────────────────────────────────────────────────────
// Modifier application: produce the post-write document shape from a stored
// doc + the `$set`-style modifier the CRUD layer issues, so the full-doc
// validator can inspect the resulting state.
//
// Every caller of validateForeignKeysForUpdate (the only thing that reaches
// here) issues `{ $set: changes }` — the generic CRUD update path
// (crud.lib.ts) and the custom members.update path both do. The array
// operators that events.server.ts ($pull/$addToSet on attendees) and
// tasks.server.ts ($push on comments) issue go through a DIRECT
// Collection.updateAsync and never touch this function. So $set is the only
// operator we support; anything else FAILS LOUD rather than silently
// returning a wrongly-merged doc that could bypass FK validation. A future
// caller that wants $push/$pull/etc. must extend this deliberately.
// ────────────────────────────────────────────────────────────

function deepClone<T>(value: T): T {
  return value == null ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function setDottedPath(doc: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let cursor: Record<string, unknown> = doc;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const next = cursor[key];
    if (next == null || typeof next !== 'object' || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}

export function applyModifierToDoc(
  stored: Record<string, unknown>,
  modifier: unknown,
): Record<string, unknown> {
  const result = deepClone(stored);
  if (modifier == null || typeof modifier !== 'object' || Array.isArray(modifier)) {
    // Bare-doc replacement: the modifier IS the new document.
    return deepClone(modifier as Record<string, unknown>);
  }

  const mod = modifier as Record<string, unknown>;
  const operators = Object.keys(mod).filter(k => k.startsWith('$'));
  if (operators.length === 0) {
    // Whole-doc replacement passed without operators.
    return deepClone(mod);
  }

  // Fail loud on any operator other than $set. Silently merging an
  // unrecognised operator (or ignoring it) would let a future caller slip a
  // write past full-document FK validation unnoticed — see the note above.
  const unsupported = operators.filter(op => op !== '$set');
  if (unsupported.length > 0) {
    throw new Meteor.Error(
      'unsupported_modifier',
      `applyModifierToDoc only supports $set; got unsupported operator(s): ${unsupported.join(', ')}`,
    );
  }

  // $set with dotted paths AND whole-object keys both flow through here:
  // a single key like `profile` replaces the whole subtree, a dotted key
  // like `profile.rankId` writes one leaf.
  const set = (mod.$set ?? {}) as Record<string, unknown>;
  for (const [path, value] of Object.entries(set)) setDottedPath(result, path, value);

  return result;
}

// ────────────────────────────────────────────────────────────
// Existence checks
// ────────────────────────────────────────────────────────────

async function assertReferencesExist(written: readonly WrittenFK[]): Promise<void> {
  if (written.length === 0) return;
  // Race the existence checks — each hits a different target collection and
  // value, no dependency between them. Dedupe (edge.target, value) pairs so a
  // doc citing the same id many times costs one query.
  const seen = new Set<string>();
  const unique: Array<{ edge: ForeignKeyEdge; value: string }> = [];
  for (const w of written) {
    const key = `${w.edge.target} ${w.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(w);
  }
  await Promise.all(
    unique.map(async ({ edge, value }) => {
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

// Touched-fields validator (retained for the insert path, which is already a
// full-doc payload, and for any caller that passes a bare doc). Throws
// `foreign_key_invalid` on the first miss.
export async function validateForeignKeys(source: CrudCollectionName, modifier: unknown): Promise<void> {
  await assertReferencesExist(extractWrittenFKs(source, modifier));
}

// Full-document validator (O-6). Validates EVERY FK present on the given
// complete document — used by the update path after merging the stored doc
// with the write's modifier, so untouched-but-orphaned FK fields are caught.
export async function validateForeignKeysOnDoc(source: CrudCollectionName, doc: unknown): Promise<void> {
  await assertReferencesExist(collectForeignKeyValues(source, doc));
}

// Full-document validator for the UPDATE path (O-6). Merges the write's
// modifier onto the stored doc and validates every FK on the result, so an
// edit to one field can't leave a different, now-orphaned FK in place. The
// CRUD layer issues `{ $set: changes }`; custom paths may pass a richer
// modifier — both flow through applyModifierToDoc. `stored` may be undefined
// (doc was concurrently removed) — nothing to validate in that case.
export async function validateForeignKeysForUpdate(
  source: CrudCollectionName,
  stored: Record<string, unknown> | undefined,
  modifier: unknown,
): Promise<void> {
  if (!stored) return;
  const merged = applyModifierToDoc(stored, modifier);
  await validateForeignKeysOnDoc(source, merged);
}
