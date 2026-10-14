import { supabase } from '@/lib/supabase';
import { runWaAkgAction } from '@/lib/crm/whatsappAccountsRepository';
import { buildContactDecisionPrompt, type ContactDecisionPrompt } from '@/lib/crm/contactDecisionPrompt';

type Row = Record<string, unknown>;

export type WaAkgContactState = 'agenda_protected' | 'unclassified' | 'lead_authorized';
export type WaAkgDirectoryContact = {
  phone: string;
  name: string;
  lastSyncedAt: string | null;
  state: WaAkgContactState;
  evidenceState: 'provider_verified' | 'operator_confirmed' | 'unverified';
  leadId: string | null;
  decisionRevision: number;
};
export type WaAkgDirectorySync = { imported: number; matched: number; skipped: number; truncated: boolean; status: 'complete' | 'partial' };
export type WaAkgContactPolicy = {
  leadId: string;
  accountId: string;
  phone: string;
  name: string;
  state: WaAkgContactState | 'unknown';
};

export type WaAkgContactDecision = 'keep' | 'promote';
export type WaAkgContactInitialMode = 'human' | 'ana';
export type WaAkgContactDecisionResult = {
  leadId: string | null;
  state: WaAkgContactState;
  decisionRevision: number;
};

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const number = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const record = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};

/**
 * The Central never derives a decision from browser directory data. The server
 * applies tenant, channel, canonical-phone, revision and dismissal rules first.
 */
export async function loadPendingWaAkgContactDecision(): Promise<ContactDecisionPrompt | null> {
  const { data, error } = await supabase.rpc('central_get_pending_wa_akg_contact_decision');
  if (error) throw error;
  const row = record(Array.isArray(data) ? data[0] : data);
  const candidate = buildContactDecisionPrompt({
    leadId: text(row.lead_id),
    accountId: text(row.account_id),
    phone: text(row.phone),
    name: text(row.name) || text(row.phone) || 'Novo contato',
    state: text(row.state) as ContactDecisionPrompt['state'],
    messageId: text(row.message_id),
    // `latest_inbound_text` is the v2 RPC contract. Keep `message_text` as a
    // harmless compatibility read while an already-open browser catches up
    // with the migration.
    latestInboundText: text(row.latest_inbound_text) || text(row.message_text),
    decisionRevision: number(row.decision_revision),
    canEnableAi: row.can_enable_ai === true,
  });
  if (!candidate?.leadId || !candidate.accountId || !candidate.phone || !candidate.messageId) return null;
  return candidate;
}

export async function dismissWaAkgContactDecisionPrompt(input: Pick<ContactDecisionPrompt, 'accountId' | 'phone' | 'messageId'>): Promise<{ dismissed: boolean }> {
  const { data, error } = await supabase.rpc('central_dismiss_wa_akg_contact_decision_prompt', {
    p_account_id: input.accountId,
    p_phone: input.phone,
    p_message_id: input.messageId,
  });
  if (error) throw error;
  const result = record(data);
  return { dismissed: result.dismissed !== false };
}

export async function decideWaAkgContactV2(input: {
  accountId: string;
  phone: string;
  decision: WaAkgContactDecision;
  ownerUserId?: string | null;
  initialMode?: WaAkgContactInitialMode;
  expectedRevision: number;
  requestId: string;
}): Promise<WaAkgContactDecisionResult> {
  const ownerUserId = text(input.ownerUserId);
  const initialMode = input.initialMode ?? 'human';
  // UI labels stay friendly and independent from the persisted CRM enum. The
  // RPC accepts the canonical `humano` / `ia` values only.
  const persistedInitialMode = initialMode === 'ana' ? 'ia' : 'humano';
  if (!text(input.accountId) || !text(input.phone) || !text(input.requestId) || !Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new Error('wa_akg_contact_decision_invalid');
  }
  if (input.decision === 'promote' && (!ownerUserId || (initialMode !== 'human' && initialMode !== 'ana'))) {
    throw new Error('wa_akg_contact_decision_owner_and_mode_required');
  }
  const { data, error } = await supabase.rpc('decide_wa_akg_contact_v2', {
    p_account_id: input.accountId,
    p_phone: input.phone,
    p_decision: input.decision,
    p_owner_user_id: input.decision === 'promote' ? ownerUserId : null,
    p_initial_mode: persistedInitialMode,
    p_expected_revision: input.expectedRevision,
    p_request_id: input.requestId,
  });
  if (error) throw error;
  const result = record(data);
  const state = text(result.state);
  if (state !== 'agenda_protected' && state !== 'unclassified' && state !== 'lead_authorized') {
    throw new Error('wa_akg_contact_decision_unconfirmed');
  }
  return {
    leadId: text(result.lead_id) || null,
    state,
    decisionRevision: number(result.decision_revision),
  };
}

export async function loadWaAkgContactDirectory(accountId: string): Promise<WaAkgDirectoryContact[]> {
  const { data, error } = await supabase.rpc('central_list_wa_akg_contact_directory', { p_account_id: accountId, p_limit: 250 });
  if (error) throw error;
  return Array.isArray(data) ? data.map((value) => {
    const row = value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
    const state = text(row.state);
    const evidenceState = text(row.evidence_state);
    const normalizedState: WaAkgContactState = state === 'agenda_protected' || state === 'lead_authorized' ? state : 'unclassified';
    const normalizedEvidenceState: WaAkgDirectoryContact['evidenceState'] = evidenceState === 'provider_verified' || evidenceState === 'operator_confirmed' ? evidenceState : 'unverified';
    return {
      phone: text(row.phone),
      name: text(row.name) || 'Contato sem nome',
      lastSyncedAt: text(row.last_synced_at) || null,
      state: normalizedState,
      evidenceState: normalizedEvidenceState,
      leadId: text(row.lead_id) || null,
      decisionRevision: Number.isFinite(Number(row.decision_revision)) ? Number(row.decision_revision) : 0,
    };
  }).filter((contact) => Boolean(contact.phone)) : [];
}

export async function syncWaAkgContactDirectory(accountId: string): Promise<WaAkgDirectorySync> {
  const result = await runWaAkgAction('sync_contacts', accountId) as unknown as Row;
  const sync = result.sync && typeof result.sync === 'object' && !Array.isArray(result.sync) ? result.sync as Row : {};
  return {
    imported: Number.isFinite(Number(sync.imported)) ? Number(sync.imported) : 0,
    matched: Number.isFinite(Number(sync.matched)) ? Number(sync.matched) : 0,
    skipped: Number.isFinite(Number(sync.skipped)) ? Number(sync.skipped) : 0,
    truncated: sync.truncated === true,
    status: sync.status === 'partial' ? 'partial' : 'complete',
  };
}
