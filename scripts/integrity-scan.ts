// Orphan scanner CLI (slice #167).
//
// Walks every foreign-key edge in COLLECTION_REGISTRY against the live
// database and prints one JSON record per orphaned reference. Read-only;
// safe to run on production.
//
// ## Invocation
//
// The scanner runs inside the Meteor runtime (it relies on the
// server/integrity.ts module, which depends on the Meteor `Mongo` driver
// + the project's collection imports). Two practical invocation paths:
//
// 1. **From the integrity.scan Meteor method** — most admin tools should
//    call this method via DDP. Returns the same `OrphanRecord[]` shape.
//
// 2. **From a running `meteor shell`** — pipe a short eval snippet:
//
//      $ npm run integrity-scan
//
//    Which expands to:
//
//      $ echo 'await (await import("/scripts/integrity-scan")).runScan(); \
//             process.exit(0)' | meteor shell
//
//    Output: one JSON record per line, suitable for piping to `jq -s` or
//    `grep`. Empty output (zero lines) means no orphans.
//
// ## Output shape
//
// Each line is:
//
//   { "source": "members", "field": "profile.rankId",
//     "sourceId": "abc...", "orphanedTargetId": "deleted-rank-id" }
//
// Empty stdout (exit 0) means no orphans.

import { scanForOrphans } from '/server/integrity';

export async function runScan(): Promise<void> {
  const orphans = await scanForOrphans();
  for (const record of orphans) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(record));
  }
}
