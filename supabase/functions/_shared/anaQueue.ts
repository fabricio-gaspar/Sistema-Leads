import type { createAdminClient } from './auth.ts';

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;

const record = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Row
  : {};
const text = (value: unknown, max = 4_000): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const uuid = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export type AnaJobInput = {
  organizationId: string;
  leadId: string;
  event: string;
  mode: 'ia' | 'humano';
  requestId: string;
  sourceMessageId?: string | null;
  sourceIntegrationId?: string | null;
  context?: Row;
};

export async function enqueueAnaJob(admin: Admin, input: AnaJobInput): Promise<Row> {
  const { data, error } = await admin.rpc('enqueue_ana_job', {
    p_organization_id: input.organizationId,
    p_lead_id: input.leadId,
    p_event: input.event,
    p_modo: input.mode,
    p_request_id: input.requestId,
    p_source_message_id: input.sourceMessageId ?? null,
    p_source_integration_id: input.sourceIntegrationId ?? null,
    p_input_context: input.context ?? {},
  });
  if (error || !data) throw new Error('ana_job_enqueue_failed');
  return record(data);
}

async function internalCredential(admin: Admin, job: Row): Promise<string> {
  const integrationId = text(job.source_integration_id, 80);
  if (uuid(integrationId)) {
    const { data, error } = await admin.rpc('read_integration_secret', { p_integration: integrationId });
    const secret = record(data);
    const credential = text(secret.webhook_secret, 1_000) || text(secret.webhook_token, 1_000);
    if (!error && credential) return credential;
  }
  return text(Deno.env.get('WHATSAPP_WEBHOOK_SHARED_SECRET'), 1_000);
}

/**
 * Executes at most one job. A lease never proves a provider action: unknown
 * responses are quarantined for review instead of being retried blindly.
 */
export async function processNextAnaJob(admin: Admin, requestedJobId?: string | null): Promise<Row> {
  const { data: claimedData, error: claimError } = await admin.rpc('claim_ana_job', {
    p_job_id: requestedJobId && uuid(requestedJobId) ? requestedJobId : null,
  });
  if (claimError) throw new Error('ana_job_claim_failed');
  if (!claimedData) return { idle: true };
  const job = record(claimedData);
  const jobId = text(job.id, 80);
  const leaseId = text(job.lease_id, 80);
  const organizationId = text(job.organization_id, 80);
  const leadId = text(job.lead_id, 80);
  const sourceMessageId = text(job.source_message_id, 80);
  const sourceIntegrationId = text(job.source_integration_id, 80);
  const credential = await internalCredential(admin, job);
  const finish = async (status: 'completed' | 'skipped', runId?: unknown) => {
    const { data, error } = await admin.rpc('finish_ana_job', {
      p_job_id: jobId, p_lease_id: leaseId, p_status: status,
      p_agent_run_id: uuid(text(runId, 80)) ? text(runId, 80) : null,
    });
    if (error || data !== true) throw new Error('ana_job_finish_failed');
  };
  const fail = async (code: string, message: string, retryable: boolean, runId?: unknown) => {
    const { data, error } = await admin.rpc('fail_ana_job', {
      p_job_id: jobId, p_lease_id: leaseId,
      p_error_code: code.slice(0, 120), p_error_message: message.slice(0, 500),
      p_retryable: retryable,
      p_agent_run_id: uuid(text(runId, 80)) ? text(runId, 80) : null,
    });
    if (error || !data) throw new Error('ana_job_fail_failed');
    return record(data);
  };

  if (!credential || !organizationId || !leadId || !jobId || !leaseId) {
    const failed = await fail('ana_job_internal_credential_missing', 'A execução automática não encontrou uma credencial interna válida.', false);
    return { job_id: jobId, status: failed.status ?? 'needs_review' };
  }

  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ana-run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
        'Content-Type': 'application/json',
        'x-internal-worker-secret': credential,
      },
      body: JSON.stringify({
        event: text(job.event, 40),
        lead_id: leadId,
        modo: text(job.modo, 12),
        organization_id: organizationId,
        request_id: text(job.request_id, 180),
        message_id: sourceMessageId || undefined,
        source_integration_id: sourceIntegrationId || undefined,
        contexto: record(job.input_context),
        ana_job_id: jobId,
        ana_job_lease_id: leaseId,
        retry_failed: Number(job.attempt_count) > 1,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const result = record(await response.json().catch(() => null));
    if (response.ok && result.ok === true) {
      await finish(result.skipped === true ? 'skipped' : 'completed', result.run_id);
      return {
        job_id: jobId,
        status: result.skipped === true ? 'skipped' : 'completed',
        run_id: result.run_id ?? null,
        skipped: result.skipped === true,
        reason: text(result.reason, 120) || null,
      };
    }
    const failed = await fail(
      text(result.erro, 120) || `ana_run_http_${response.status}`,
      text(result.erro, 500) || 'A Ana recusou a execução antes de informar uma decisão confirmada.',
      result.retryable === true,
      result.run_id,
    );
    return { job_id: jobId, status: failed.status ?? 'needs_review', run_id: result.run_id ?? null };
  } catch {
    const failed = await fail(
      'ana_run_response_unknown',
      'A resposta da Ana não foi confirmada; o comando foi mantido para revisão e não será reenviado automaticamente.',
      false,
    );
    return { job_id: jobId, status: failed.status ?? 'needs_review' };
  }
}
