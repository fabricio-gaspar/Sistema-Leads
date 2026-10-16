import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));
const anaRun = readFileSync(new URL('../functions/ana-run/index.ts', import.meta.url), 'utf8');
const inboundWork = readFileSync(new URL('../functions/_shared/inboundWork.ts', import.meta.url), 'utf8');
const automationWorker = readFileSync(new URL('../functions/automation-worker/index.ts', import.meta.url), 'utf8');

function existingLeadQueueMigration(): string {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => readFileSync(join(migrationsDirectory, file), 'utf8'))
    .filter((sql) => sql.includes('existing_lead.selected'))
    .join('\n');
}

function functionSection(sql: string, name: string): string {
  const start = sql.indexOf(name);
  return start >= 0 ? sql.slice(start, start + 16_000) : '';
}

describe('Ana existing-lead queue safety contract', () => {
  it('accepts the distinct existing-lead event only through the internal Ana path', () => {
    expect(anaRun).toContain("'existing_lead.selected'");
    expect(anaRun).toMatch(/(?:event\s*===\s*['"]existing_lead\.selected['"][\s\S]{0,260}!internal|!internal[\s\S]{0,260}event\s*===\s*['"]existing_lead\.selected['"])/i);
  });

  it('extends both durable event stores and exposes server-only reservation', () => {
    const sql = existingLeadQueueMigration();

    expect(sql).toContain('existing_lead.selected');
    expect(sql).toContain('alter table public.agent_runs');
    expect(sql).toContain('alter table public.ana_jobs');
    expect(sql).toContain('public.reserve_existing_leads_for_ana');
    expect(sql).toContain('public.assert_existing_lead_work_allowed');
    expect(sql).toContain("current_user not in ('postgres', 'service_role')");
  });

  it('requires prior inbound history and current automation eligibility before reserving a lead', () => {
    const sql = existingLeadQueueMigration();
    const reserve = functionSection(sql, 'public.reserve_existing_leads_for_ana');

    expect(reserve).toMatch(/from public\.lead_messages[\s\S]{0,800}sender\s*=\s*'lead'/i);
    expect(reserve).toContain("contact_approval_status = 'approved'");
    expect(reserve).toContain("modo_atendimento = 'ia'");
    expect(reserve).toContain('ai_paused');
    expect(reserve).toContain('opt_out');
    expect(reserve).toMatch(/handoff|human/i);
    expect(reserve).toContain("provider = 'wa_akg'");
    expect(reserve).toContain("connection_status = 'connected'");
    expect(reserve).toContain("lower(coalesce(lead.active_channel, '')) = 'whatsapp'");
    expect(reserve).toContain('automation_enabled');
    expect(reserve).toContain('lead_authorized');
    expect(reserve).toContain('p_scheduler_lease_id uuid');
    expect(reserve).toContain('ana_existing_lead_scheduler_lease_invalid');
    expect(reserve).toContain("'needs_review'");
  });

  it('reports only candidates that pass the same core channel and protection fences', () => {
    const sql = existingLeadQueueMigration();
    const snapshot = functionSection(sql, 'public.get_ana_existing_lead_work_snapshot');

    expect(snapshot).toContain("connection_status = 'connected'");
    expect(snapshot).toContain("lower(coalesce(lead.active_channel, '')) = 'whatsapp'");
    expect(snapshot).toContain("provider = 'wa_akg'");
    expect(snapshot).toContain('automation_enabled');
    expect(snapshot).toContain("evidence_state in ('provider_verified', 'operator_confirmed')");
    expect(snapshot).toContain('lead_handoffs');
    expect(snapshot).toContain('ana_existing_lead_batch_items');
  });

  it('preempts queued existing-lead work before admitting a newer inbound message', () => {
    const preempt = inboundWork.indexOf('preempt_existing_lead_work_for_inbound');
    const enqueue = inboundWork.indexOf('enqueueAnaJob(admin');

    expect(preempt).toBeGreaterThan(-1);
    expect(enqueue).toBeGreaterThan(-1);
    expect(preempt).toBeLessThan(enqueue);
  });

  it('runs at most one proactive existing-lead item before the generic Ana queue drain', () => {
    const workerTick = automationWorker.slice(automationWorker.indexOf('let anaOperations'));
    const proactive = workerTick.indexOf('processExistingLeadWork');
    const genericDrain = workerTick.indexOf('drainAnaQueue(admin)');

    expect(proactive).toBeGreaterThan(-1);
    expect(genericDrain).toBeGreaterThan(-1);
    expect(proactive).toBeLessThan(genericDrain);
    expect(automationWorker).toMatch(/processExistingLeadWork[\s\S]{0,3000}(?:limit\s*=\s*1|max(?:imum)?(?:Jobs)?\s*[:=]\s*1|\blimit\s*:\s*1)/i);
  });

  it('carries the scheduler lease into reservation and fences the Ana run again before effects', () => {
    expect(automationWorker).toContain('p_scheduler_lease_id: leaseId');
    expect(anaRun).toContain('p_lease_id: requestedJobLeaseId');
    expect(anaRun).toContain('const existingLeadFence = await existingLeadWorkAllowed()');
    expect(anaRun).toContain('const currentExistingLeadFence = await existingLeadWorkAllowed()');
  });

  it('keeps scheduled existing-lead work as review-only and only selects while Ana is automatic', () => {
    const sql = existingLeadQueueMigration();
    const savePolicy = functionSection(sql, 'public.save_ana_existing_lead_work_policy');
    const claim = functionSection(sql, 'public.claim_due_existing_lead_policy');

    expect(savePolicy).toContain("p_mode <> 'review_only'");
    expect(claim).toContain("company.ana_operation_mode = 'automatic'");
    expect(claim).toContain('company.sandbox_mode is not true');
  });

  it('does not select or drain automatic Ana work before the company and sandbox gates', () => {
    const blocked = automationWorker.indexOf('const blocked =');
    const sandbox = automationWorker.indexOf('reads[0].data?.sandbox_mode === true');
    const existingLeadWork = automationWorker.indexOf('await processExistingLeadWork(admin, orgId, 1)');
    const anaQueue = automationWorker.indexOf('await drainAnaQueue(admin)');

    expect(blocked).toBeGreaterThan(-1);
    expect(sandbox).toBeGreaterThan(blocked);
    expect(existingLeadWork).toBeGreaterThan(sandbox);
    expect(anaQueue).toBeGreaterThan(sandbox);
    expect(automationWorker).toContain('if (serverScheduler && reads[0].data?.sandbox_mode !== true) waAkgQueues = await processWaAkgQueues(orgId);');
  });
});
