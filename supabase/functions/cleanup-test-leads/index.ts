import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

type Action = 'preview' | 'delete';
type Candidate = {
  id: string;
  company: string;
  contact: string;
  phoneSuffix: string | null;
  reason: string;
  messageCount: number;
  jobCount: number;
  runCount: number;
};

const text = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const phoneSuffix = (value: unknown) => {
  const digits = text(value, 100).replace(/\D/g, '');
  return digits ? digits.slice(-4) : null;
};

function candidateReason(row: Record<string, unknown>): string | null {
  const company = text(row.company, 240).toLowerCase();
  const contact = text(row.contact, 240).toLowerCase();
  const evidence = JSON.stringify({
    origin: row.origin,
    source_record_id: row.source_record_id,
    source_metadata: row.source_metadata,
  }).toLowerCase();
  if (company.includes('wf digital') && contact.includes('fabricio')) return 'Teste histórico identificado: Fabricio / WF Digital.';
  if (company.includes('lavanderia') && contact.includes('fabricio')) return 'Teste de validação identificado: Fabricio / Lavanderia.';
  if (/\b(test|teste|demo|demonstracao|demonstração)\b/.test(evidence)) return 'Marcado pela origem/metadados como teste.';
  return null;
}

async function candidatesForOrganization(admin: ReturnType<typeof createAdminClient>, organizationId: string): Promise<Candidate[]> {
  const { data: leads, error } = await admin.from('leads')
    .select('id,company,contact,phone,whatsapp,origin,source_record_id,source_metadata')
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false })
    .limit(300);
  if (error) throw new Error('test_lead_candidates_read_failed');

  const selected = (leads ?? []).map((lead) => ({ lead, reason: candidateReason(lead as Record<string, unknown>) }))
    .filter((item): item is { lead: Record<string, unknown>; reason: string } => Boolean(item.reason));
  const ids = selected.map((item) => text(item.lead.id, 80)).filter(Boolean);
  if (!ids.length) return [];

  const [messages, jobs, runs] = await Promise.all([
    admin.from('lead_messages').select('lead_id').eq('organization_id', organizationId).in('lead_id', ids),
    admin.from('outreach_jobs').select('lead_id').eq('organization_id', organizationId).in('lead_id', ids),
    admin.from('agent_runs').select('lead_id').eq('organization_id', organizationId).in('lead_id', ids),
  ]);
  if (messages.error || jobs.error || runs.error) throw new Error('test_lead_relations_read_failed');
  const countByLead = (rows: Array<{ lead_id?: string | null }> | null) => (rows ?? []).reduce<Record<string, number>>((counts, row) => {
    if (row.lead_id) counts[row.lead_id] = (counts[row.lead_id] ?? 0) + 1;
    return counts;
  }, {});
  const messageCounts = countByLead(messages.data);
  const jobCounts = countByLead(jobs.data);
  const runCounts = countByLead(runs.data);

  return selected.map(({ lead, reason }) => ({
    id: text(lead.id, 80),
    company: text(lead.company, 240) || 'Empresa não informada',
    contact: text(lead.contact, 240) || 'Contato não informado',
    phoneSuffix: phoneSuffix(lead.whatsapp) ?? phoneSuffix(lead.phone),
    reason,
    messageCount: messageCounts[text(lead.id, 80)] ?? 0,
    jobCount: jobCounts[text(lead.id, 80)] ?? 0,
    runCount: runCounts[text(lead.id, 80)] ?? 0,
  }));
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json().catch(() => ({})) as { action?: Action; leadIds?: unknown; confirmation?: unknown };
    const action = body.action ?? 'preview';
    if (action !== 'preview' && action !== 'delete') throw new Error('unsupported_action');
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin']);
    const candidates = await candidatesForOrganization(admin, organizationId);
    if (action === 'preview') return json({ ok: true, candidates }, 200, headers);

    if (text(body.confirmation, 80) !== 'LIMPAR TESTES') throw new Error('test_cleanup_confirmation_required');
    const requestedIds = Array.isArray(body.leadIds) ? body.leadIds.map((id) => text(id, 80)).filter(Boolean) : [];
    const allowedIds = candidates.map((candidate) => candidate.id);
    const ids = requestedIds.filter((id) => allowedIds.includes(id));
    if (!ids.length) throw new Error('test_cleanup_selection_required');
    if (ids.length !== requestedIds.length) throw new Error('test_cleanup_candidate_changed');

    const { data: deleted, error: purgeError } = await admin.rpc('purge_selected_test_leads', {
      p_organization_id: organizationId,
      p_lead_ids: ids,
    });
    if (purgeError) throw new Error('test_cleanup_purge_failed');
    const deletedIds = Array.isArray(deleted) ? deleted.map((row) => text((row as { lead_id?: unknown }).lead_id, 80)).filter(Boolean) : [];
    if (deletedIds.length !== ids.length) throw new Error('test_cleanup_verification_failed');
    const { error: auditError } = await admin.from('audit_logs').insert({
      organization_id: organizationId,
      actor_id: user.id,
      actor_name: profile.name,
      actor_type: 'user',
      action: 'lead.test_data_purged',
      detail: `${deletedIds.length} lead(s) de teste confirmado(s) removido(s) com seus vínculos operacionais.`,
      entity_table: 'leads',
      event_data: { deleted_count: deletedIds.length, source: 'confirmed_test_cleanup' },
    });
    if (auditError) throw new Error('test_cleanup_audit_failed');
    return json({ ok: true, deletedCount: deletedIds.length, deletedIds }, 200, headers);
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});
