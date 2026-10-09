import { supabase } from '@/lib/supabase';
import { runWaAkgAction } from '@/lib/crm/whatsappAccountsRepository';

type Row = Record<string, unknown>;

export type WaAkgDirectoryContact = { phone: string; name: string; lastSyncedAt: string | null };
export type WaAkgDirectorySync = { imported: number; skipped: number; truncated: boolean; status: 'complete' | 'partial' };

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export async function loadWaAkgContactDirectory(accountId: string): Promise<WaAkgDirectoryContact[]> {
  const { data, error } = await supabase.rpc('central_list_wa_akg_contact_directory', { p_account_id: accountId, p_limit: 250 });
  if (error) throw error;
  return Array.isArray(data) ? data.map((value) => {
    const row = value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
    return { phone: text(row.phone), name: text(row.name) || 'Contato sem nome', lastSyncedAt: text(row.last_synced_at) || null };
  }).filter((contact) => Boolean(contact.phone)) : [];
}

export async function syncWaAkgContactDirectory(accountId: string): Promise<WaAkgDirectorySync> {
  const result = await runWaAkgAction('sync_contacts', accountId) as unknown as Row;
  const sync = result.sync && typeof result.sync === 'object' && !Array.isArray(result.sync) ? result.sync as Row : {};
  return {
    imported: Number.isFinite(Number(sync.imported)) ? Number(sync.imported) : 0,
    skipped: Number.isFinite(Number(sync.skipped)) ? Number(sync.skipped) : 0,
    truncated: sync.truncated === true,
    status: sync.status === 'partial' ? 'partial' : 'complete',
  };
}

