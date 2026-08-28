import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import type { Conversa, Mensagem } from '@/mocks/atendimentoData';
import { isUuid, persistentLeadId } from '@/lib/crm/leadMapper';

interface LeadRow { id: string; company: string; contact: string | null; active_channel: string | null; ai_paused: boolean; last_contact: string | null; updated_at: string; }
interface MessageRow { id: string; lead_id: string; sender: string; sender_name: string; type: string; text: string; sent_at: string | null; created_at: string; }

function channel(value: string | null): Conversa['canal'] {
  return value === 'email' || value === 'instagram' ? value : 'whatsapp';
}

function messageFromRow(row: MessageRow): Mensagem {
  const sender = row.sender.toLowerCase();
  return {
    id: row.id,
    autor: sender === 'lead' || sender === 'contact' || sender === 'cliente' ? 'cliente' : sender === 'ana' || sender === 'assistant' ? 'ana' : sender === 'system' || sender === 'sistema' ? 'sistema' : 'vendedor',
    nome: row.sender_name || 'Sistema',
    texto: row.text,
    hora: new Date(row.sent_at ?? row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    notaInterna: row.type === 'internal',
  };
}

function messageToRow(message: Mensagem, organizationId: string, leadId: string) {
  const sender = message.autor === 'cliente' ? 'lead' : message.autor === 'ana' ? 'ana' : message.autor === 'sistema' ? 'system' : 'human';
  return {
    id: persistentLeadId(message.id), organization_id: organizationId, lead_id: leadId, sender,
    sender_name: message.nome || (sender === 'ana' ? 'Ana' : 'Você'), type: message.notaInterna ? 'internal' : 'text', text: message.texto,
    sent_at: new Date().toISOString(),
  };
}

export async function loadOperationalConversations(): Promise<Conversa[]> {
  const session = await resolveOrganizationSession();
  const { data: leads, error: leadsError } = await supabase.from('leads')
    .select('id, company, contact, active_channel, ai_paused, last_contact, updated_at')
    .eq('organization_id', session.organizationId).order('updated_at', { ascending: false });
  if (leadsError) throw leadsError;
  const rows = (leads ?? []) as LeadRow[];
  if (!rows.length) return [];

  const { data: messages, error: messagesError } = await supabase.from('lead_messages')
    .select('id, lead_id, sender, sender_name, type, text, sent_at, created_at')
    .eq('organization_id', session.organizationId).in('lead_id', rows.map((lead) => lead.id))
    .order('sent_at', { ascending: true });
  if (messagesError) throw messagesError;
  const messagesByLead = new Map<string, Mensagem[]>();
  for (const row of (messages ?? []) as MessageRow[]) {
    const current = messagesByLead.get(row.lead_id) ?? [];
    current.push(messageFromRow(row));
    messagesByLead.set(row.lead_id, current);
  }

  return rows.map((lead) => {
    const conversationMessages = messagesByLead.get(lead.id) ?? [];
    const latest = conversationMessages.at(-1);
    return {
      id: lead.id, leadId: lead.id, protocolo: `#CRM-${lead.id.slice(0, 8).toUpperCase()}`,
      contato: lead.contact || 'Contato não informado', empresa: lead.company, canal: channel(lead.active_channel),
      status: lead.ai_paused ? 'transferido' : latest?.autor === 'cliente' ? 'aguardando' : 'ativo',
      sla: '—', fila: lead.ai_paused ? 'Atendimento humano' : 'Ana', ultimaMensagem: latest?.texto ?? 'Sem mensagens ainda.',
      hora: latest?.hora ?? new Date(lead.last_contact ?? lead.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      naoLidas: latest?.autor === 'cliente' ? 1 : 0, mensagens: conversationMessages,
    } satisfies Conversa;
  });
}

export async function persistOperationalConversations(previous: Conversa[], next: Conversa[]): Promise<Conversa[]> {
  const session = await resolveOrganizationSession();
  const previousByLead = new Map(previous.map((conversation) => [conversation.leadId ?? conversation.id, conversation]));
  for (const conversation of next) {
    const leadId = conversation.leadId ?? conversation.id;
    if (!isUuid(leadId)) continue;
    const priorMessageIds = new Set((previousByLead.get(leadId)?.mensagens ?? []).map((message) => message.id));
    const fresh = conversation.mensagens.filter((message) => !priorMessageIds.has(message.id));
    if (fresh.length) {
      const { error } = await supabase.from('lead_messages').insert(fresh.map((message) => messageToRow(message, session.organizationId, leadId)));
      if (error) throw error;
    }
    const { error: leadError } = await supabase.from('leads')
      .update({ ai_paused: conversation.status === 'transferido', active_channel: conversation.canal, last_contact: new Date().toISOString() })
      .eq('id', leadId).eq('organization_id', session.organizationId);
    if (leadError) throw leadError;
  }
  return next;
}
