import type { Conversa, Mensagem } from '@/mocks/atendimentoData';
import { isUuid, persistentLeadId } from '@/lib/crm/leadMapper';

export interface CrmConversationRow {
  id: string;
  organization_id: string;
  lead_id: string;
  channel: 'whatsapp' | 'email' | 'instagram' | 'web' | 'phone';
  status: 'open' | 'waiting_human' | 'closed';
  protocol: string | null;
  queue_name: string | null;
  unread_count: number;
  last_message_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CrmMessageRow {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound' | 'internal';
  sender_type: 'contact' | 'member' | 'assistant' | 'system';
  body: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const displayStatuses = new Set<Conversa['status']>(['ativo', 'aguardando', 'resolvido', 'transferido']);

function databaseStatus(status: Conversa['status']): CrmConversationRow['status'] {
  if (status === 'transferido') return 'waiting_human';
  if (status === 'resolvido') return 'closed';
  return 'open';
}

function displayStatus(row: CrmConversationRow): Conversa['status'] {
  const fromMetadata = row.metadata?.displayStatus;
  if (typeof fromMetadata === 'string' && displayStatuses.has(fromMetadata as Conversa['status'])) {
    return fromMetadata as Conversa['status'];
  }
  if (row.status === 'waiting_human') return 'transferido';
  if (row.status === 'closed') return 'resolvido';
  return 'ativo';
}

export function conversationToCrmRow(conversation: Conversa, organizationId: string): Partial<CrmConversationRow> & { organization_id: string; lead_id: string; channel: CrmConversationRow['channel']; status: CrmConversationRow['status'] } {
  if (!conversation.leadId || !isUuid(conversation.leadId)) {
    throw new Error('conversation_lead_required');
  }
  return {
    id: persistentLeadId(conversation.id),
    organization_id: organizationId,
    lead_id: conversation.leadId,
    channel: conversation.canal,
    status: databaseStatus(conversation.status),
    protocol: conversation.protocolo,
    queue_name: conversation.fila,
    unread_count: Math.max(0, conversation.naoLidas),
    last_message_at: new Date().toISOString(),
    metadata: {
      contato: conversation.contato,
      empresa: conversation.empresa,
      sla: conversation.sla,
      ultimaMensagem: conversation.ultimaMensagem,
      hora: conversation.hora,
      displayStatus: conversation.status,
    },
  };
}

export function messageToCrmRow(message: Mensagem, organizationId: string, conversationId: string): Partial<CrmMessageRow> & { organization_id: string; conversation_id: string; direction: CrmMessageRow['direction']; sender_type: CrmMessageRow['sender_type']; body: string } {
  const direction = message.autor === 'cliente' ? 'inbound' : message.autor === 'sistema' || message.notaInterna ? 'internal' : 'outbound';
  const senderType = message.autor === 'cliente' ? 'contact' : message.autor === 'ana' ? 'assistant' : message.autor === 'sistema' ? 'system' : 'member';
  return {
    id: persistentLeadId(message.id),
    organization_id: organizationId,
    conversation_id: conversationId,
    direction,
    sender_type: senderType,
    body: message.texto,
    metadata: {
      nome: message.nome,
      hora: message.hora,
      notaInterna: Boolean(message.notaInterna),
      opcoesHorario: message.opcoesHorario,
    },
  };
}

export function crmRowsToConversation(row: CrmConversationRow, messages: CrmMessageRow[]): Conversa {
  const mappedMessages: Mensagem[] = messages.map((message) => ({
    id: message.id,
    autor: message.sender_type === 'contact' ? 'cliente' : message.sender_type === 'assistant' ? 'ana' : message.sender_type === 'member' ? 'vendedor' : 'sistema',
    nome: typeof message.metadata?.nome === 'string' ? message.metadata.nome : 'Sistema',
    texto: message.body,
    hora: typeof message.metadata?.hora === 'string' ? message.metadata.hora : new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    notaInterna: message.metadata?.notaInterna === true,
    opcoesHorario: Array.isArray(message.metadata?.opcoesHorario) ? message.metadata.opcoesHorario as Mensagem['opcoesHorario'] : undefined,
  }));
  const latest = mappedMessages.at(-1);
  return {
    id: row.id,
    protocolo: row.protocol ?? `#CRM-${row.id.slice(0, 8).toUpperCase()}`,
    contato: typeof row.metadata?.contato === 'string' ? row.metadata.contato : 'Contato',
    empresa: typeof row.metadata?.empresa === 'string' ? row.metadata.empresa : 'Empresa',
    canal: row.channel === 'web' || row.channel === 'phone' ? 'whatsapp' : row.channel,
    status: displayStatus(row),
    sla: typeof row.metadata?.sla === 'string' ? row.metadata.sla : '—',
    fila: row.queue_name ?? 'Qualificação',
    ultimaMensagem: latest?.texto ?? (typeof row.metadata?.ultimaMensagem === 'string' ? row.metadata.ultimaMensagem : ''),
    hora: typeof row.metadata?.hora === 'string' ? row.metadata.hora : 'agora',
    naoLidas: row.unread_count,
    mensagens: mappedMessages,
    leadId: row.lead_id,
  };
}
