import { afterEach, describe, expect, it, vi } from 'vitest';
import { enqueueAnaJob, processNextAnaJob } from '../functions/_shared/anaQueue.ts';

const orgId = 'a1111111-1111-4111-8111-111111111111';
const leadId = 'b1111111-1111-4111-8111-111111111111';
const messageId = 'c1111111-1111-4111-8111-111111111111';
const integrationId = 'd1111111-1111-4111-8111-111111111111';
const jobId = 'e1111111-1111-4111-8111-111111111111';
const leaseId = 'f1111111-1111-4111-8111-111111111111';
const runId = 'a2222222-2222-4222-8222-222222222222';

function adminFor(result: Record<string, unknown> | null) {
  const rpc = vi.fn(async (name: string, input: Record<string, unknown>) => {
    if (name === 'enqueue_ana_job') return { data: { id: jobId }, error: null };
    if (name === 'claim_ana_job') return { data: result, error: null };
    if (name === 'read_integration_secret') return { data: { webhook_secret: 'synthetic-secret' }, error: null };
    if (name === 'finish_ana_job') return { data: true, error: null };
    if (name === 'fail_ana_job') return { data: { status: input.p_retryable ? 'retry' : 'needs_review' }, error: null };
    throw new Error(`unexpected_rpc:${name}`);
  });
  return { rpc, from: vi.fn() } as unknown as Parameters<typeof enqueueAnaJob>[0];
}

afterEach(() => vi.unstubAllGlobals());

describe('Ana durable queue', () => {
  it('enqueues only the persisted inbound message id', async () => {
    const admin = adminFor(null);
    await enqueueAnaJob(admin, {
      organizationId: orgId, leadId, event: 'message.received', mode: 'ia', requestId: 'wa_akg:account:provider-message',
      sourceMessageId: messageId, sourceIntegrationId: integrationId, context: { channel: 'whatsapp' },
    });
    expect(admin.rpc).toHaveBeenCalledWith('enqueue_ana_job', expect.objectContaining({
      p_source_message_id: messageId, p_source_integration_id: integrationId,
    }));
  });

  it('forwards the leased persisted message to ana-run and closes the job only after success', async () => {
    const admin = adminFor({ id: jobId, lease_id: leaseId, organization_id: orgId, lead_id: leadId,
      source_message_id: messageId, source_integration_id: integrationId, event: 'message.received', modo: 'ia', request_id: 'wa_akg:account:provider-message', input_context: {}, attempt_count: 1 });
    vi.stubGlobal('Deno', { env: { get: (name: string) => ({ SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'service-key' } as Record<string, string>)[name] } });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, run_id: runId }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(processNextAnaJob(admin, jobId)).resolves.toMatchObject({ status: 'completed', run_id: runId });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ message_id: messageId, ana_job_id: jobId, ana_job_lease_id: leaseId });
    expect(admin.rpc).toHaveBeenCalledWith('finish_ana_job', expect.objectContaining({ p_job_id: jobId, p_lease_id: leaseId, p_agent_run_id: runId }));
  });

  it('quarantines an unknown response instead of retrying an ambiguous execution', async () => {
    const admin = adminFor({ id: jobId, lease_id: leaseId, organization_id: orgId, lead_id: leadId,
      source_message_id: messageId, source_integration_id: integrationId, event: 'message.received', modo: 'ia', request_id: 'wa_akg:account:provider-message', input_context: {}, attempt_count: 1 });
    vi.stubGlobal('Deno', { env: { get: (name: string) => ({ SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'service-key' } as Record<string, string>)[name] } });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network lost'); }));
    await expect(processNextAnaJob(admin, jobId)).resolves.toMatchObject({ status: 'needs_review' });
    expect(admin.rpc).toHaveBeenCalledWith('fail_ana_job', expect.objectContaining({
      p_error_code: 'ana_run_response_unknown', p_retryable: false,
    }));
  });

  it('retries only a confirmed transient Ana failure', async () => {
    const admin = adminFor({ id: jobId, lease_id: leaseId, organization_id: orgId, lead_id: leadId,
      source_message_id: messageId, source_integration_id: integrationId, event: 'message.received', modo: 'ia', request_id: 'wa_akg:account:provider-message', input_context: {}, attempt_count: 1 });
    vi.stubGlobal('Deno', { env: { get: (name: string) => ({ SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'service-key' } as Record<string, string>)[name] } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, erro: 'freellm_503', retryable: true }), { status: 503 })));
    await expect(processNextAnaJob(admin, jobId)).resolves.toMatchObject({ status: 'retry' });
    expect(admin.rpc).toHaveBeenCalledWith('fail_ana_job', expect.objectContaining({
      p_error_code: 'freellm_503', p_retryable: true,
    }));
  });
});
