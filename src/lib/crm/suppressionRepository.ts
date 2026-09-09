import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';

export interface ContactSuppression {
  id: string;
  contact: string;
  channel: string;
  reason: string | null;
  leadId: string | null;
  createdAt: string | null;
}

function normalizeContact(contact: string): string {
  const value = contact.trim().toLowerCase();
  return value.includes('@') ? value.replace(/\s+/g, '') : value.replace(/\D/g, '');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, '0')).join('');
}

export async function loadContactSuppressions(): Promise<ContactSuppression[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase.from('contact_suppressions')
    .select('id,contact,channel,reason,lead_id,created_at').eq('organization_id', session.organizationId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((item) => ({ id: item.id, contact: item.contact || 'Contato protegido', channel: item.channel, reason: item.reason, leadId: item.lead_id, createdAt: item.created_at }));
}

export async function addContactSuppression(input: { contact: string; channel: string; reason: string; leadId?: string }): Promise<void> {
  const session = await resolveOrganizationSession();
  const contact = normalizeContact(input.contact);
  if (!contact) throw new Error('contact_required');
  const contactHash = await sha256(contact);
  const { error } = await supabase.from('contact_suppressions').upsert({
    organization_id: session.organizationId,
    contact,
    contact_hash: contactHash,
    channel: input.channel.toLowerCase(),
    reason: input.reason.trim() || 'Solicitação de não contato',
    lead_id: input.leadId ?? null,
  }, { onConflict: 'organization_id,contact_hash' });
  if (error) throw error;
}

export async function removeContactSuppression(id: string): Promise<void> {
  const session = await resolveOrganizationSession();
  const { error } = await supabase.from('contact_suppressions').delete().eq('id', id).eq('organization_id', session.organizationId);
  if (error) throw error;
}
