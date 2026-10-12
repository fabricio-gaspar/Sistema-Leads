import { supabase } from '@/lib/supabase';
import { runWaAkgAction } from '@/lib/crm/whatsappAccountsRepository';

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

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

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

export async function decideWaAkgContact(accountId: string, phone: string, decision: 'keep' | 'promote', leadId?: string | null) {
  const { data, error } = await supabase.rpc('decide_wa_akg_contact', {
    p_account_id: accountId,
    p_phone: phone,
    p_decision: decision,
    p_lead_id: leadId || null,
  });
  if (error) throw error;
  return data as { state: WaAkgContactState; evidence_state: string; lead_id: string | null; decision_revision: number };
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
