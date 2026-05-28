// Orphan scanner + one-off migration CLI.
//
// Walks every foreign-key edge in COLLECTION_REGISTRY against the live
// database. `runScan` is read-only and prints one JSON record per orphaned
// reference; `runResolve` is the one-off migration that clears resolvable
// orphans (pull / setNull) so a populated database can be cleaned BEFORE
// full-document FK enforcement (decision O-6) is switched on — otherwise
// edits to already-orphaned rows would start failing.
//
// Both run inside the Meteor runtime (they rely on the server/integrity
// module, which depends on the Mongo driver + the project's collection
// imports). Two practical invocation paths:
//
// 1. **Meteor methods** (preferred for admin tooling, gated admin-only):
//      - `integrity.scan`         → read-only orphan report (OrphanRecord[]).
//      - `integrity.scanResolve`  → migration; pass `true` for a dry run.
//
// 2. **From a running `meteor shell`** — pipe a short eval snippet:
//
//      # read-only report (one JSON record per line; empty output = clean)
//      $ npm run integrity-scan
//
//    which expands to:
//
//      $ echo 'await (await import("/scripts/integrity-scan")).runScan(); \
//             process.exit(0)' | meteor shell
//
// ## Orphan-migration runbook (run BEFORE deploying full-doc enforcement)
//
//   1. Dry run to see what would change, and which orphans need manual
//      reconciliation (block/cascade edges are never auto-resolved):
//
//        $ echo 'console.log(JSON.stringify(await (await \
//          import("/scripts/integrity-scan")).runResolve(true))); \
//          process.exit(0)' | meteor shell
//
//      (or call the `integrity.scanResolve` method with dryRun: true)
//
//   2. Review the `skipped` array — resolve those references by hand.
//   3. Apply the migration for the auto-resolvable orphans:
//
//        $ echo 'console.log(JSON.stringify(await (await \
//          import("/scripts/integrity-scan")).runResolve(false))); \
//          process.exit(0)' | meteor shell
//
//   4. Re-run `runScan` and confirm it prints nothing (zero orphans) before
//      shipping the build with full-document enforcement enabled.
//
// ## Output shape
//
//   runScan:    one JSON OrphanRecord per line; empty stdout = no orphans.
//   runResolve: an OrphanResolution { pulled, setNull, skipped[] }.

import { resolveOrphans, scanForOrphans, type OrphanResolution } from '/server/integrity';

export async function runScan(): Promise<void> {
  const orphans = await scanForOrphans();
  for (const record of orphans) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(record));
  }
}

// One-off migration. `dryRun` (default true — safe by default) counts what
// WOULD be resolved without mutating. Returns the resolution summary so the
// shell snippet can JSON.stringify it.
export async function runResolve(dryRun: boolean = true): Promise<OrphanResolution> {
  return resolveOrphans({ dryRun });
}
