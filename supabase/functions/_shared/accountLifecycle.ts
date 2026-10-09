import type { createAdminClient } from './auth.ts';

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;
export type LifecycleContext = {
  organizationId: string; accountId: string; provider: 'wa_akg'; actorId: string;
};
export type LifecycleResult = {
  state: string; revision: number; desiredAction: string | null; errorCode: string | null;
};
type WorkResult = { connected?: boolean; connectionStatus?: string; phoneSuffix?: string | null; webhookRegistered?: boolean; payload?: Row };
export type LifecycleStep = <T>(work: () => Promise<T>, mutating?: boolean) => Promise<T>;

const row = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const params = (context: LifecycleContext) => ({ p_organization_id: context.organizationId,
  p_account_id: context.accountId, p_provider: context.provider, p_actor_id: context.actorId });
const present = (value: Row): LifecycleResult => ({
  state: String(value.state ?? 'needs_review'), revision: Number(value.revision ?? 0),
  desiredAction: typeof value.desired_action === 'string' ? value.desired_action : null,
  errorCode: typeof value.error_code === 'string' ? value.error_code : null,
});

async function rpc(admin: Admin, name: string, input: Row): Promise<Row> {
  const { data, error } = await admin.rpc(name, input);
  if (error || !data || Array.isArray(data)) throw new Error('account_lifecycle_persistence_failed');
  return row(data);
}

export async function accountLifecycleStatus(admin: Admin, context: LifecycleContext): Promise<LifecycleResult> {
  return present(await rpc(admin, 'get_whatsapp_account_lifecycle', params(context)));
}

/**
 * Database intent is committed before resolving credentials or touching the gateway.
 * Only one durable operation token can own remote work. No timer steals an uncertain
 * token: the caller gets pending/needs_review, never a fictitious successful retry.
 * The existing account/integration flags and provider controls remain authoritative.
 */
export async function runAccountLifecycle(
  admin: Admin, context: LifecycleContext, action: string, work: (step: LifecycleStep) => Promise<WorkResult>,
): Promise<{ lifecycle: LifecycleResult; payload: Row; status: number }> {
  const ticket = await rpc(admin, 'begin_whatsapp_account_lifecycle', { ...params(context), p_action: action });
  if (ticket.admitted !== true) {
    const lifecycle = present(ticket);
    return { lifecycle, payload: lifecycle.state === 'needs_review' ? { error: 'account_lifecycle_needs_review' } : {},
      status: lifecycle.state === 'completed' ? 200 : lifecycle.state === 'needs_review' ? 409 : 202 };
  }
  const operation = { ...params(context), p_operation_id: ticket.operation_id, p_revision: ticket.revision };
  let mutationStarted = false;
  const step: LifecycleStep = async (call, mutating = false) => {
    const checkpoint = await rpc(admin, 'check_whatsapp_account_lifecycle', operation);
    if (checkpoint.current !== true) throw new Error('account_lifecycle_superseded');
    if (mutating) mutationStarted = true;
    return call();
  };
  let result: WorkResult;
  try {
    result = await work(step);
  } catch (error) {
    // Never persist arbitrary provider response/error text (credentials and phone data).
    const message = error instanceof Error ? error.message : '';
    const code = message === 'account_lifecycle_superseded' ? message
      : /^wa_akg_[a-z0-9_]{1,90}$/.test(message) ? message : 'account_lifecycle_remote_failed';
    const finished = await rpc(admin, 'finish_whatsapp_account_lifecycle', {
      ...operation, p_result: { success: false, uncertain: mutationStarted, error_code: code },
    });
    const lifecycle = present(finished);
    return { lifecycle, payload: { error: lifecycle.state === 'needs_review' ? 'account_lifecycle_needs_review' : code },
      status: lifecycle.state === 'pending' ? 202 : lifecycle.state === 'needs_review' ? 409 : 400 };
  }
  // A failure here must not be mistaken for a failed remote request and retried.
  // The durable token stays in-flight for explicit reconciliation if persistence fails.
  const finished = await rpc(admin, 'finish_whatsapp_account_lifecycle', { ...operation, p_result: {
    success: true, connected: result.connected, connection_status: result.connectionStatus,
    phone_suffix: result.phoneSuffix, webhook_registered: result.webhookRegistered === true,
  } });
  const lifecycle = present(finished);
  const completed = lifecycle.state === 'completed';
  return { lifecycle, payload: completed ? result.payload ?? {} : {}, status: completed ? 200 : lifecycle.state === 'needs_review' ? 409 : 202 };
}

export async function setAccountProviderControls(admin: Admin, context: LifecycleContext, input: Row): Promise<void> {
  for (const key of ['inbound_enabled', 'send_enabled', 'automation_enabled', 'kill_switch']) {
    if (typeof input[key] !== 'boolean') throw new Error('provider_controls_explicit_values_required');
  }
  await rpc(admin, 'set_whatsapp_account_provider_controls', { ...params(context),
    p_inbound_enabled: input.inbound_enabled, p_send_enabled: input.send_enabled,
    p_automation_enabled: input.automation_enabled, p_kill_switch: input.kill_switch,
  });
}

export async function recoverAccountLifecycle(admin: Admin, context: LifecycleContext, input: Row,
  observe: () => Promise<{ confirmed: boolean; connected: boolean }>,
): Promise<{ lifecycle: LifecycleResult; recovery: Row; status: number }> {
  const diagnosis = await rpc(admin, 'diagnose_whatsapp_account_lifecycle', params(context));
  const observed = await observe(); // GET only; never connect/start/pair/QR
  const observation = { ...observed, observed_at: new Date().toISOString() };
  const eligible = diagnosis.can_reconcile_read_only === true && observed.confirmed;
  const recovery: Row = { eligible, reason: observed.confirmed ? diagnosis.reason : 'provider_state_not_confirmed',
    observedConnected: observed.confirmed ? observed.connected : null, observedAt: observation.observed_at,
    requiresAdmin: true, retainsLocalCutoff: true };
  if (input.action !== 'lifecycle_reconcile') return { lifecycle: present(diagnosis), recovery, status: 200 };
  if (!eligible) return { lifecycle: present(diagnosis), recovery, status: 409 };
  const revision = Number(input.expected_revision);
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!Number.isSafeInteger(revision) || revision < 0 || reason.length < 8 || reason.length > 500) throw new Error('account_lifecycle_recovery_input_invalid');
  const completed = await rpc(admin, 'reconcile_whatsapp_account_lifecycle', { ...params(context),
    p_expected_revision: revision, p_reason: reason, p_observation: observation });
  return { lifecycle: present(completed), recovery: { ...recovery, reconciled: true }, status: 200 };
}

type WaAkgProvisionObservation = {
  confirmed: boolean; connected: boolean; state: string; webhookOwned: boolean; safetyConfirmed: boolean;
};

/**
 * A provision can be reconciled only after the provider proves the already-created
 * session is the expected isolated session, has its exact callback ownership, and
 * remains safe for manual pairing. This does not start a session, create a QR, or
 * release any local messaging gate.
 */
export async function recoverWaAkgProvisioning(admin: Admin, context: LifecycleContext, input: Row,
  observe: () => Promise<WaAkgProvisionObservation>,
): Promise<{ lifecycle: LifecycleResult; recovery: Row; status: number }> {
  const diagnosis = await rpc(admin, 'diagnose_wa_akg_provision_recovery', params(context));
  const observed = await observe();
  const qrReady = !observed.connected && ['SCAN_QR', 'QR'].includes(observed.state);
  const eligible = diagnosis.can_reconcile_provision === true && observed.confirmed && qrReady
    && observed.webhookOwned && observed.safetyConfirmed;
  const observation = {
    confirmed: observed.confirmed,
    connected: observed.connected,
    state: observed.state,
    webhook_owned: observed.webhookOwned,
    safety_confirmed: observed.safetyConfirmed,
    observed_at: new Date().toISOString(),
  };
  const recovery: Row = {
    eligible,
    reason: eligible ? 'provision_completion_observed' : (observed.confirmed ? diagnosis.reason : 'provider_state_not_confirmed'),
    observedConnected: observed.confirmed ? observed.connected : null,
    observedAt: observation.observed_at,
    requiresAdmin: true,
    retainsLocalCutoff: true,
  };
  if (input.action !== 'provision_reconcile') return { lifecycle: present(diagnosis), recovery, status: 200 };
  if (!eligible) return { lifecycle: present(diagnosis), recovery, status: 409 };
  const revision = Number(input.expected_revision);
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!Number.isSafeInteger(revision) || revision < 0 || reason.length < 8 || reason.length > 500) {
    throw new Error('account_lifecycle_recovery_input_invalid');
  }
  const completed = await rpc(admin, 'reconcile_wa_akg_provision_recovery', {
    ...params(context), p_expected_revision: revision, p_reason: reason, p_observation: observation,
  });
  return { lifecycle: present(completed), recovery: { ...recovery, reconciled: true }, status: 200 };
}
