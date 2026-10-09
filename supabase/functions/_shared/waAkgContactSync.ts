import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { WaAkgCrmContact, WaAkgProvider } from './messaging/WaAkgProvider.ts';

const text = (value: unknown, max = 200): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const personalJid = /^([1-9][0-9]{7,14})(?::[0-9]{1,5})?@(s\.whatsapp\.net|c\.us)$/;

export type WaAkgContactSyncResult = { imported: number; skipped: number; truncated: boolean; status: 'complete' | 'partial' };

function directoryRow(organizationId: string, accountId: string, value: WaAkgCrmContact) {
  const remoteJid = text(value.remoteJid, 200);
  const match = remoteJid.match(personalJid);
  if (!match) return null;
  return {
    organization_id: organizationId,
    whatsapp_account_id: accountId,
    remote_jid: remoteJid,
    phone: match[1],
    agenda_name: text(value.agendaName, 160) || null,
    whatsapp_name: text(value.whatsappName, 160) || null,
    public_name: text(value.publicName, 160) || null,
    last_synced_at: new Date().toISOString(),
  };
}

/** Persists only the current account's personal directory; groups and unresolved JIDs are excluded. */
export async function syncWaAkgContactDirectory(
  admin: SupabaseClient,
  input: { organizationId: string; accountId: string; provider: WaAkgProvider },
): Promise<WaAkgContactSyncResult> {
  const snapshot = await input.provider.crmSync();
  const source = snapshot.contacts.slice(0, 1_000).map((contact) => directoryRow(input.organizationId, input.accountId, contact));
  const rows = source.filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (rows.length) {
    const { error } = await admin.from('whatsapp_contact_directory').upsert(rows, {
      onConflict: 'organization_id,whatsapp_account_id,remote_jid',
    });
    if (error) throw new Error('wa_akg_contact_directory_save_failed');
  }
  const status = snapshot.truncated || snapshot.contacts.length > 1_000 ? 'partial' : 'complete';
  const { error: stateError } = await admin.from('whatsapp_sync_state').upsert({
    whatsapp_account_id: input.accountId,
    organization_id: input.organizationId,
    sync_kind: 'contacts', status, last_completed_at: new Date().toISOString(), last_error_code: null,
    metadata: { imported_contacts: rows.length, skipped_contacts: snapshot.contacts.length - rows.length, provider_truncated: snapshot.truncated === true },
  }, { onConflict: 'whatsapp_account_id' });
  if (stateError) throw new Error('wa_akg_contact_sync_state_save_failed');
  return { imported: rows.length, skipped: snapshot.contacts.length - rows.length, truncated: status === 'partial', status };
}

