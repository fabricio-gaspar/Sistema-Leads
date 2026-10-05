import type { OperationalEvent } from './operationalDiagnosticsRepository';

const instant = (value: string | null | undefined) => value ? Date.parse(value) : NaN;
/** Observations over the supplied recent sample, not an SLA or a provider latency probe. */
export function summarizeOperationalSample(runs: OperationalEvent[], jobs: OperationalEvent[], observedAt: string) {
  const durations = runs.map((run) => instant(run.completed_at) - instant(run.created_at))
    .filter((duration) => Number.isFinite(duration) && duration >= 0).sort((a, b) => a - b);
  const now = instant(observedAt);
  const pendingAges = jobs.filter((job) => ['queued','processing','reconciliation_required'].includes(job.status ?? ''))
    .map((job) => now - instant(job.run_at)).filter((age) => Number.isFinite(age) && age >= 0);
  return {
    observedAt, runCount: runs.length, durationCount: durations.length,
    failedRuns: runs.filter((run) => run.status === 'failed' || run.status === 'error').length,
    p95CompletionMs: durations.length ? durations[Math.ceil(durations.length * 0.95) - 1] : null,
    oldestDueSampleMs: pendingAges.length ? Math.max(...pendingAges) : null,
    jobsSampleCount: jobs.length,
  };
}
