import { Meteor } from 'meteor/meteor';
import { TELEMETRY } from './config';

// === Telemetry / Observability boundary ===
//
// A dependency-free instrumentation seam. Server hot paths (the mutation
// pipeline and read methods) hand each operation's timing + outcome to
// `recordTelemetry`, which forwards the record to a pluggable exporter.
//
// Decision O-3: the production backend is a self-hosted OTLP collector. We do
// NOT bundle the OpenTelemetry SDK (it would have to be installed into the
// shared node_modules). Instead this module emits a neutral record shape and
// exposes an exporter seam where an OTLP/HTTP exporter — or the full OTel SDK —
// can be dropped in later without touching the call sites.

export type TelemetryOutcome = 'ok' | 'denied' | 'error';

export interface TelemetryRecord {
  // The Meteor method / logical operation name, e.g. "medals.insert".
  readonly method: string;
  // Wall-clock duration of the instrumented body, in milliseconds.
  readonly durationMs: number;
  readonly outcome: TelemetryOutcome;
  // Epoch milliseconds when the record was produced.
  readonly timestamp: number;
}

// An exporter consumes finished records. Implementations MUST be non-throwing
// from the caller's perspective — `recordTelemetry` already guards against it,
// but a well-behaved exporter never propagates transport failures back into
// the application hot path.
export type TelemetryExporter = (record: TelemetryRecord) => void;

// Default exporter: a structured, no-op-safe log emit. Cheap, dependency-free,
// and greppable. Swapped out wholesale by `setTelemetryExporter` (tests inject
// a spy; ops can install the OTLP exporter below).
export const consoleExporter: TelemetryExporter = record => {
  // Single-line structured payload so log scrapers can parse it directly.
  console.log(`[telemetry] ${JSON.stringify(record)}`);
};

// OTLP/HTTP exporter SEAM.
//
// This is a minimal, dependency-free stub that POSTs records as JSON to an
// OTLP-style HTTP endpoint when one is configured (TELEMETRY.otlpEndpoint, read
// via the server/config.ts Meteor.settings pattern). It deliberately does NOT
// pull in the OpenTelemetry SDK or build a spec-compliant ResourceSpans
// envelope — that is the plug-in point. When ops stand up the self-hosted OTLP
// collector (decision O-3) this is where the real SDK exporter is wired in.
//
// Fire-and-forget: transport is best-effort and never blocks or throws into the
// caller. Failures are swallowed (the hot path must not care about telemetry).
export const otlpExporter: TelemetryExporter = record => {
  const endpoint = TELEMETRY.otlpEndpoint;
  if (!endpoint) return;
  // TODO(O-3): replace this hand-rolled JSON POST with the OpenTelemetry SDK's
  // OTLP/HTTP exporter once the SDK can be added as a dependency. The neutral
  // TelemetryRecord shape above is the stable seam; only this transport body
  // should need to change.
  void postJson(endpoint, record);
};

async function postJson(endpoint: string, record: TelemetryRecord): Promise<void> {
  try {
    // `fetch` is available in the Node 22 runtime this app targets.
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(record),
    });
  } catch {
    // Best-effort: telemetry transport failures must never surface to callers.
  }
}

// The active exporter. Selected at module load from config, overridable at
// runtime (primarily for tests, which inject a spy via setTelemetryExporter).
let activeExporter: TelemetryExporter = TELEMETRY.otlpEndpoint ? otlpExporter : consoleExporter;

// Swap the exporter. Returns the previous exporter so callers (tests) can
// restore it in an afterEach without leaking a spy into later suites.
export function setTelemetryExporter(exporter: TelemetryExporter): TelemetryExporter {
  const previous = activeExporter;
  activeExporter = exporter;
  return previous;
}

// Record a single finished operation. Forwarding is wrapped so a misbehaving
// exporter can never break the instrumented call site (Security > … > DX, but
// telemetry must never be load-bearing for correctness).
export function recordTelemetry(record: TelemetryRecord): void {
  if (!Meteor.isServer) return;
  if (!TELEMETRY.enabled) return;
  try {
    activeExporter(record);
  } catch {
    // Never let telemetry break the application.
  }
}

// Convenience wrapper used by the instrumented hot paths: times the supplied
// async `body`, classifies its outcome, emits a record, and re-throws any error
// untouched so it MUST NOT change error propagation. `classifyError` maps a
// thrown value to 'denied' vs 'error' (the pipeline distinguishes pre-body
// denials from body errors; reads have no denial branch and always map to
// 'error').
export async function instrument<T>(
  method: string,
  body: () => Promise<T>,
  classifyError: (error: unknown) => TelemetryOutcome = () => 'error',
): Promise<T> {
  const start = Date.now();
  try {
    const result = await body();
    emit(method, start, 'ok');
    return result;
  } catch (error) {
    emit(method, start, classifyError(error));
    throw error;
  }
}

function emit(method: string, start: number, outcome: TelemetryOutcome): void {
  recordTelemetry({ method, durationMs: Date.now() - start, outcome, timestamp: Date.now() });
}
