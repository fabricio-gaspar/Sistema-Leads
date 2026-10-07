import type { createAdminClient } from './auth.ts';
type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;
type Provider = 'wa_akg' | 'evolution_go';
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
export type ProvisioningStep = <T>(name: string, work: () => Promise<T>, mutating?: boolean) => Promise<T>;

export async function runProvisioningWork(admin: Admin, provider: Provider, job: Row,
  work: (claimed: Row, step: ProvisioningStep, saveSecret: (secret: Row) => Promise<void>) => Promise<Row>,
): Promise<Row> {
  const claimed = await admin.rpc('claim_whatsapp_provisioning', { p_provider: provider, p_job_id: job.id });
  if (claimed.error) throw new Error('whatsapp_provisioning_claim_failed');
  if (!claimed.data) return { skipped: true };
  const ticket = object(claimed.data);
  const context = { p_provider: provider, p_job_id: ticket.id, p_operation_id: ticket.operation_id, p_revision: ticket.revision };
  const step: ProvisioningStep = async (name, call, mutating = false) => {
    const checkpoint = await admin.rpc('check_whatsapp_provisioning', { ...context, p_step: name, p_mutating: mutating });
    if (checkpoint.error || object(checkpoint.data).current !== true) throw new Error('whatsapp_provisioning_superseded');
    return call();
  };
  const saveSecret = async (secret: Row) => {
    const saved = await admin.rpc('save_whatsapp_provisioning_secret', { ...context, p_secret: secret });
    if (saved.error || saved.data !== true) throw new Error('whatsapp_provisioning_secret_save_failed');
  };
  let result: Row;
  try { result = { ...await work(ticket, step, saveSecret), success: true }; }
  catch (error) {
    const message = error instanceof Error ? error.message : '';
    result = { success: false, error_code: /^(wa_akg|evolution_go|whatsapp_provisioning)_[a-z0-9_]{1,90}$/.test(message)
      ? message : 'whatsapp_provisioning_remote_failed' };
  }
  // If this transaction fails, retain the durable token. Never redo the POST.
  const finished = await admin.rpc('finish_whatsapp_provisioning', { ...context, p_result: result });
  if (finished.error || !finished.data) throw new Error('whatsapp_provisioning_finish_failed');
  const state = object(finished.data).state;
  if (state === 'cancelled') return { cancelled: true };
  return state === 'completed' ? { provisioned: true } : { failed: true, review: state === 'needs_review' };
}
