import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { conversationToCrmRow, crmRowsToConversation, messageToCrmRow, type CrmConversationRow, type CrmMessageRow } from '@/lib/crm/conversationMapper';
import type { Conversa } from '@/mocks/atendimentoData';

export async function loadOperationalConversations(): Promise<Conversa[]> {
  const session = await resolveOrganizationSession();
  const { data: conversations, error: conversationsError } = await supabase
    .from('crm_conversations')
    .select('*')
    .eq('organization_id', session.organizationId)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (conversationsError) throw conversationsError;
  const rows = (conversations ?? []) as CrmConversationRow[];
  if (rows.length === 0) return [];

  const { data: messages, error: messagesError } = await supabase
    .from('crm_messages')
    .select('*')
    .eq('organization_id', session.organizationId)
    .in('conversation_id', rows.map((row) => row.id))
    .order('created_at', { ascending: true });
  if (messagesError) throw messagesError;
  const messagesByConversation = new Map<string, CrmMessageRow[]>();
  for (const message of (messages ?? []) as CrmMessageRow[]) {
    const current = messagesByConversation.get(message.conversation_id) ?? [];
    current.push(message);
    messagesByConversation.set(message.conversation_id, current);
  }
  return rows.map((row) => crmRowsToConversation(row, messagesByConversation.get(row.id) ?? []));
}

export async function persistOperationalConversations(previous: Conversa[], next: Conversa[]): Promise<Conversa[]> {
  const session = await resolveOrganizationSession();
  const previousById = new Map(previous.map((conversation) => [conversation.id, conversation]));
  const persisted: Conversa[] = [];

  for (const conversation of next) {
    const row = conversationToCrmRow(conversation, session.organizationId);
    const { error: conversationError } = previousById.has(conversation.id)
      ? await supabase.from('crm_conversations').update(row).eq('id', conversation.id).eq('organization_id', session.organizationId)
      : await supabase.from('crm_conversations').insert(row);
    if (conversationError) throw conversationError;

    const priorMessageIds = new Set((previousById.get(conversation.id)?.mensagens ?? []).map((message) => message.id));
    const freshMessages = conversation.mensagens.filter((message) => !priorMessageIds.has(message.id));
    if (freshMessages.length > 0) {
      const payload = freshMessages.map((message) => messageToCrmRow(message, session.organizationId, conversation.id));
      const { error: messagesError } = await supabase.from('crm_messages').insert(payload);
      if (messagesError) throw messagesError;
    }
    persisted.push(conversation);
  }
  return persisted;
}
