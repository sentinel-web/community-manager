import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { COLLECTION_REGISTRY, type ForeignKeyEdge } from '../../server/collection-registry';
import type { CrudCollectionMap, CrudCollectionName } from '/imports/api/types';
import EventsCollection from '../../imports/api/collections/events.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import TasksCollection from '../../imports/api/collections/tasks.collection';
import QuestionnaireResponsesCollection from '../../imports/api/collections/questionnaireResponses.collection';
import RegistrationsCollection from '../../imports/api/collections/registrations.collection';

// Structural-invariant tests for the integrity layer (slice #169).
//
// These are not behavioral — they assert properties of the codebase itself
// so that future changes can't quietly regress the integrity contract.
// Pattern lifted from the existing COLLECTION_REGISTRY shape-conformance
// tests in permissions.test.ts.

describe('integrity coverage — every removeAsync in server/apis is guarded (#169)', () => {
  // Meteor's test build virtualises __dirname inside the bundle, so we
  // resolve from the Meteor project root instead. PWD is the project root
  // when `meteor test` runs.
  const SERVER_APIS_DIR = join(process.env.PWD || process.cwd(), 'server', 'apis');

  // Files allowed to invoke removeAsync without an explicit
  // enforceIntegrityOnDelete guard. Each entry documents the reason —
  // typically either a bulk-wipe path (backup restore, demo seeding) or
  // a collection with no incoming FK edges (deleting it has no integrity
  // side effects to enforce).
  //
  // Adding a file here is a deliberate act: the reviewer of the diff
  // should confirm the reason holds, since once added, the guard is no
  // longer enforced for that file.
  const ALLOWED_UNGUARDED: Record<string, string> = {
    // Bulk-wipe paths — backup restore and demo data installation
    // deliberately replace the entire DB state, so integrity is
    // irrelevant.
    'backup.server.ts': 'bulk restore — replaces entire collection contents',
    'demoData.server.ts': 'bulk wipe before installing demo seed data',

    // Collections with no incoming FK edges — no other doc references
    // them, so deleting one has no integrity side effects to enforce.
    'logs.server.ts': 'logs has no incoming FK edges (nothing references LogEntries)',
    'settings.server.ts': 'settings has no incoming FK edges (key-value store)',
    'questionnaireResponses.server.ts':
      'questionnaireResponses has no incoming FK edges (nothing references responses)',
  };

  it('every *.server.ts file with removeAsync either guards it or is on the documented allowlist', () => {
    const files = readdirSync(SERVER_APIS_DIR).filter(name => name.endsWith('.server.ts'));
    assert.ok(files.length > 0, 'expected to find at least one *.server.ts file to scan');

    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(join(SERVER_APIS_DIR, file), 'utf8');
      if (!source.includes('removeAsync')) continue;

      const hasGuard = source.includes('enforceIntegrityOnDelete');
      const isAllowlisted = file in ALLOWED_UNGUARDED;

      if (!hasGuard && !isAllowlisted) {
        violations.push(file);
      }
    }

    assert.deepStrictEqual(
      violations,
      [],
      `unguarded removeAsync detected in: ${violations.join(
        ', ',
      )}. Either add an enforceIntegrityOnDelete call before the remove, or add an entry to ALLOWED_UNGUARDED in this test file with a clear reason.`,
    );
  });

  it('allowlist entries do not falsely claim "no incoming edges" — registry confirms', () => {
    // Sanity check: if an entry in ALLOWED_UNGUARDED references a
    // collection that actually has incoming edges, the test's invariant
    // is wrong. We approximate by checking the collection-name prefix
    // of each allowlisted file against the registry's incoming-edges set.
    const allCollectionNames = Object.keys(COLLECTION_REGISTRY) as CrudCollectionName[];
    const collectionsWithIncomingEdges = new Set<CrudCollectionName>();
    for (const entry of Object.values(COLLECTION_REGISTRY)) {
      if (!entry.foreignKeys) continue;
      for (const edge of entry.foreignKeys) collectionsWithIncomingEdges.add(edge.target);
    }

    for (const file of Object.keys(ALLOWED_UNGUARDED)) {
      const claim = ALLOWED_UNGUARDED[file];
      if (!claim.includes('no incoming FK edges')) continue;

      // Extract the collection name from the file (e.g. "logs.server.ts" → "logs")
      const collectionName = file.replace('.server.ts', '') as CrudCollectionName;
      if (!allCollectionNames.includes(collectionName)) continue; // unrelated file

      assert.ok(
        !collectionsWithIncomingEdges.has(collectionName),
        `${file} claims "no incoming FK edges" but the registry shows ${collectionName} is referenced by other collections — update the allowlist reason or add an integrity guard`,
      );
    }
  });
});

describe('integrity coverage — COLLECTION_REGISTRY completeness (#169)', () => {
  it('every CrudCollectionName has a registry entry', () => {
    // The Record<CrudCollectionName, _> type already forces this at
    // compile time; this runtime check guards against the loosened-type
    // path (e.g. registry initializer asserting Record<...> via Object.assign).
    const registryKeys = new Set(Object.keys(COLLECTION_REGISTRY));
    const collectionsThatHaveEntries: Array<keyof CrudCollectionMap> = [
      'attendances',
      'discoveryTypes',
      'events',
      'eventTypes',
      'logs',
      'medals',
      'members',
      'positions',
      'profilePictures',
      'questionnaireResponses',
      'questionnaires',
      'ranks',
      'registrations',
      'roles',
      'specializations',
      'squads',
      'taskStatus',
      'tasks',
    ];
    for (const c of collectionsThatHaveEntries) {
      assert.ok(registryKeys.has(c), `COLLECTION_REGISTRY missing entry for ${c}`);
    }
  });

  it('every registry entry with foreignKeys references valid target collections', () => {
    for (const [source, entry] of Object.entries(COLLECTION_REGISTRY)) {
      if (!entry.foreignKeys) continue;
      for (const edge of entry.foreignKeys) {
        assert.ok(
          COLLECTION_REGISTRY[edge.target as CrudCollectionName],
          `${source}.${edge.field} points to unknown target collection "${edge.target}"`,
        );
      }
    }
  });

  it('every edge has a valid onDelete primitive', () => {
    const validPrimitives: ReadonlySet<ForeignKeyEdge['onDelete']> = new Set(['block', 'setNull', 'pull', 'cascade']);
    for (const [source, entry] of Object.entries(COLLECTION_REGISTRY)) {
      if (!entry.foreignKeys) continue;
      for (const edge of entry.foreignKeys) {
        assert.ok(
          validPrimitives.has(edge.onDelete),
          `${source}.${edge.field} has invalid onDelete "${edge.onDelete}"`,
        );
      }
    }
  });
});

describe('integrity coverage — displayField paths resolve (#169)', () => {
  // For each registry entry that declares a displayField, verify the
  // dotted path resolves to a string on a freshly-constructed fixture
  // doc of that collection. Catches typos in displayField paths.
  //
  // Each collection that has a displayField is paired with a doc shape
  // we can insert to verify the path. The doc shapes mirror the existing
  // fixture style — minimum fields required to instantiate.

  function readPath(doc: unknown, path: string): unknown {
    if (!doc || typeof doc !== 'object') return undefined;
    return path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, doc);
  }

  // Construct a sample doc that *would* have the displayField populated.
  // Returns null if we don't have a fixture for this collection — in that
  // case the test logs but doesn't fail. The point is to catch typos in
  // paths that we know how to test.
  function sampleDocForDisplayField(collection: CrudCollectionName, displayField: string): Record<string, unknown> | null {
    switch (collection) {
      case 'members':
        return { profile: { name: 'Sample Name' } };
      case 'events':
      case 'medals':
      case 'positions':
      case 'ranks':
      case 'roles':
      case 'specializations':
      case 'squads':
      case 'taskStatus':
      case 'tasks':
      case 'discoveryTypes':
      case 'eventTypes':
      case 'questionnaires':
        return { name: 'Sample Name' };
      default:
        void displayField;
        return null;
    }
  }

  it('every displayField path resolves to a non-empty string on a representative sample', () => {
    const unresolved: string[] = [];
    for (const [source, entry] of Object.entries(COLLECTION_REGISTRY)) {
      if (!entry.displayField) continue;
      const sample = sampleDocForDisplayField(source as CrudCollectionName, entry.displayField);
      if (sample === null) continue;
      const value = readPath(sample, entry.displayField);
      if (typeof value !== 'string' || value.length === 0) {
        unresolved.push(`${source}.${entry.displayField}`);
      }
    }
    assert.deepStrictEqual(
      unresolved,
      [],
      `displayField paths failed to resolve to non-empty strings on sample docs: ${unresolved.join(', ')}`,
    );
  });
});

// Suppress unused-import warnings: these imports demonstrate the test
// targets the *real* collections (catches breakage if a collection is
// renamed or removed). The compiler enforces their existence.
void EventsCollection;
void MembersCollection;
void RanksCollection;
void SpecializationsCollection;
void SquadsCollection;
void TasksCollection;
void QuestionnaireResponsesCollection;
void RegistrationsCollection;
