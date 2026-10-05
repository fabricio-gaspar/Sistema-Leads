import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import type { Conversa, Mensagem } from '@/mocks/atendimentoData';
import { isUuid, persistentLeadId } from '@/lib/crm/leadMapper';

interface LeadRow {
  id: string;
  company: string;
  contact: string | null;
  active_channel: string | null;
  ai_paused: boolean;
  automation_status: string | null;
  modo_atendimento: string | null;
  last_contact: string | null;
  updated_at: string;
  whatsapp_account_id: string | null;
}

interface WhatsappAccountRow {
  id: string;
  label: string;
  connected_phone_suffix: string | null;
  provider: 'zapi' | 'meta_cloud' | 'evolution_go' | 'wa_akg';
}

interface MessageRow {
  id: string;
  lead_id: string;
  sender: string;
  sender_name: string;
  type: string;
  text: string;
  sent_at: string | null;
  created_at: string;
  provider_message_id: string | null;
}

export interface OutreachRow {
  id: string;
  lead_id: string;
  status: string;
  provider_message_id: string | null;
  error: string | null;
  attempt: number | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

export interface ConversationPersistencePlan {
  messages: Array<{ organizationId?: string; leadId: string; message: Mensagem }>;
  leadPatches: Array<{ leadId: string; patch: { active_channel?: Conversa['canal']; last_contact?: string } }>;
}

function channel(value: string | null): Conversa['canal'] {
  return value === 'email' || value === 'instagram' ? value : 'whatsapp';
}

export function messageDeliveryStatus(messageType: string, outreach?: Pick<OutreachRow, 'status' | 'sent_at' | 'delivered_at' | 'read_at'>): Mensagem['statusEnvio'] {
  if (messageType === 'reconciliation_required') return 'reconciliacao';
  if (outreach?.status === 'failed' || messageType === 'failed') return 'falhou';
  if (outreach?.status === 'read' || outreach?.read_at) return 'lida';
  if (outreach?.status === 'delivered' || outreach?.delivered_at) return 'entregue';
  if (outreach?.status === 'sent' || outreach?.sent_at) return 'aceita';
  if (outreach?.status === 'pending' || messageType === 'queued') return 'aguardando';
  if (outreach?.status === 'replied') {
    if (outreach.read_at) return 'lida';
    if (outreach.delivered_at) return 'entregue';
    if (outreach.sent_at) return 'aceita';
  }
  return messageType === 'sent' ? 'aceita' : undefined;
}

function messageFromRow(row: MessageRow, outreach?: OutreachRow): Mensagem {
  const sender = row.sender.toLowerCase();
  const type = row.type.toLowerCase();
  const history: NonNullable<Mensagem['historicoStatus']> = [
    { label: 'criada', at: row.created_at },
  ];
  if (type === 'queued' || outreach?.status === 'pending') history.push({ label: 'na fila', at: row.sent_at ?? row.created_at });
  if (outreach?.sent_at) history.push({ label: 'aceita pelo provedor', at: outreach.sent_at });
  if (outreach?.delivered_at) history.push({ label: 'entregue', at: outreach.delivered_at });
  if (outreach?.read_at) history.push({ label: 'lida', at: outreach.read_at });
  if (outreach?.failed_at || type === 'failed') history.push({ label: 'falhou', at: outreach?.failed_at ?? row.sent_at ?? row.created_at });
  if (type === 'received') history.push({ label: 'recebida', at: row.sent_at ?? row.created_at });

  return {
    id: row.id,
    autor: sender === 'lead' || sender === 'contact' || sender === 'cliente'
      ? 'cliente'
      : sender === 'ana' || sender === 'assistant'
        ? 'ana'
        : sender === 'system' || sender === 'sistema'
          ? 'sistema'
          : 'vendedor',
    nome: row.sender_name || 'Sistema',
    texto: type === 'draft'
      ? `Rascunho da Ana — aprovação necessária: ${row.text}`
      : type === 'pending_channel'
        ? `Rascunho da Ana — canal pendente: ${row.text}`
        : row.text,
    hora: new Date(row.sent_at ?? row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    notaInterna: ['internal', 'draft', 'pending_channel'].includes(type),
    statusEnvio: messageDeliveryStatus(type, outreach),
    criadoEm: row.created_at,
    enviadoEm: outreach?.sent_at ?? (type === 'sent' ? row.sent_at : null),
    entregueEm: outreach?.delivered_at ?? null,
    lidoEm: outreach?.read_at ?? null,
    providerMessageId: outreach?.provider_message_id ?? row.provider_message_id,
    correlationId: outreach?.id ?? null,
    tentativas: outreach?.attempt ?? 0,
    erroTecnico: outreach?.error ?? null,
    historicoStatus: history,
  };
}

function messageToRow(message: Mensagem, organizationId: string, leadId: string, now: string) {
  const sender = message.autor === 'cliente' ? 'lead' : message.autor === 'ana' ? 'ana' : message.autor === 'sistema' ? 'system' : 'human';
  return {
    id: persistentLeadId(message.id),
    organization_id: organizationId,
    lead_id: leadId,
    sender,
    sender_name: message.nome || (sender === 'ana' ? 'Ana' : 'Você'),
    type: message.notaInterna ? 'internal' : 'text',
    text: message.texto,
    sent_at: now,
  };
}

export function planOperationalConversationPersistence(previous: Conversa[], next: Conversa[], now: string): ConversationPersistencePlan {
  const previousByLead = new Map(previous.map((conversation) => [conversation.leadId ?? conversation.id, conversation]));
  const plan: ConversationPersistencePlan = { messages: [], leadPatches: [] };
  for (const conversation of next) {
    const leadId = conversation.leadId ?? conversation.id;
    if (!isUuid(leadId)) continue;
    const prior = previousByLead.get(leadId);
    const priorMessageIds = new Set((prior?.mensagens ?? []).map((message) => message.id));
    const fresh = conversation.mensagens.filter((message) => !priorMessageIds.has(message.id));
    for (const message of fresh) plan.messages.push({ leadId, message });

    const patch: { active_channel?: Conversa['canal']; last_contact?: string } = {};
    if (prior && prior.canal !== conversation.canal) patch.active_channel = conversation.canal;
    if (fresh.some((message) => !message.notaInterna && message.autor !== 'sistema')) patch.last_contact = now;
    if (Object.keys(patch).length) plan.leadPatches.push({ leadId, patch });
  }
  return plan;
}

export async function loadOperationalConversations(): Promise<Conversa[]> {
  const session = await resolveOrganizationSession();
  const { data: leads, error: leadsError } = await supabase.from('leads')
    .select('id, company, contact, active_channel, ai_paused, automation_status, modo_atendimento, last_contact, updated_at, whatsapp_account_id')
    .eq('organization_id', session.organizationId).order('updated_at', { ascending: false });
  if (leadsError) throw leadsError;
  const rows = (leads ?? []) as LeadRow[];
  if (!rows.length) return [];

  const leadIds = rows.map((lead) => lead.id);
  const accountIds = [...new Set(rows.map((lead) => lead.whatsapp_account_id).filter((id): id is string => Boolean(id)))];
  const [messageRead, outreachRead, accountRead] = await Promise.all([
    supabase.from('lead_messages')
      .select('id, lead_id, sender, sender_name, type, text, sent_at, created_at, provider_message_id')
      .eq('organization_id', session.organizationId).in('lead_id', leadIds)
      .order('sent_at', { ascending: true }),
    supabase.from('lead_outreach')
      .select('id, lead_id, status, provider_message_id, error, attempt, sent_at, delivered_at, read_at, failed_at, created_at, updated_at, metadata')
      .eq('organization_id', session.organizationId).in('lead_id', leadIds)
      .order('updated_at', { ascending: false }),
    accountIds.length
      ? supabase.from('whatsapp_accounts').select('id,label,connected_phone_suffix,provider')
        .eq('organization_id', session.organizationId).in('id', accountIds)
      : Promise.resolve({ data: [] as WhatsappAccountRow[], error: null }),
  ]);
  if (messageRead.error) throw messageRead.error;
  if (outreachRead.error) throw outreachRead.error;
  if (accountRead.error) throw accountRead.error;

  const accountsById = new Map(((accountRead.data ?? []) as WhatsappAccountRow[]).map((account) => [account.id, account]));

  const outreachByMessage = new Map<string, OutreachRow>();
  for (const outreach of (outreachRead.data ?? []) as OutreachRow[]) {
    const messageId = typeof outreach.metadata?.message_id === 'string' ? outreach.metadata.message_id : '';
    if (messageId && !outreachByMessage.has(messageId)) outreachByMessage.set(messageId, outreach);
  }
  const messagesByLead = new Map<string, Mensagem[]>();
  for (const row of (messageRead.data ?? []) as MessageRow[]) {
    const current = messagesByLead.get(row.lead_id) ?? [];
    current.push(messageFromRow(row, outreachByMessage.get(row.id)));
    messagesByLead.set(row.lead_id, current);
  }

  return rows.map((lead) => {
    const conversationMessages = messagesByLead.get(lead.id) ?? [];
    const latest = conversationMessages.at(-1);
    const human = lead.ai_paused || lead.modo_atendimento === 'humano' || lead.automation_status === 'human';
    const account = lead.whatsapp_account_id ? accountsById.get(lead.whatsapp_account_id) : undefined;
    return {
      id: lead.id,
      leadId: lead.id,
      protocolo: `#CRM-${lead.id.slice(0, 8).toUpperCase()}`,
      contato: lead.contact || 'Contato não informado',
      empresa: lead.company,
      canal: channel(lead.active_channel),
      status: human ? 'transferido' : latest?.autor === 'cliente' ? 'aguardando' : 'ativo',
      sla: '—',
      fila: human ? 'Atendimento humano' : 'Ana',
      ultimaMensagem: latest?.texto ?? 'Sem mensagens ainda.',
      hora: latest?.hora ?? new Date(lead.last_contact ?? lead.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      naoLidas: latest?.autor === 'cliente' ? 1 : 0,
      mensagens: conversationMessages,
      whatsappAccountId: lead.whatsapp_account_id,
      whatsappAccountLabel: account?.label ?? null,
      whatsappPhoneSuffix: account?.connected_phone_suffix ?? null,
      whatsappProvider: account?.provider ?? null,
    } satisfies Conversa;
  });
}

export async function persistOperationalConversations(previous: Conversa[], next: Conversa[]): Promise<Conversa[]> {
  const session = await resolveOrganizationSession();
  const now = new Date().toISOString();
  const plan = planOperationalConversationPersistence(previous, next, now);
  if (plan.messages.length) {
    const { error } = await supabase.from('lead_messages').insert(plan.messages.map(({ leadId, message }) => messageToRow(message, session.organizationId, leadId, now)));
    if (error) throw error;
  }
  for (const item of plan.leadPatches) {
    const { error } = await supabase.from('leads').update(item.patch)
      .eq('id', item.leadId).eq('organization_id', session.organizationId);
    if (error) throw error;
  }
  return next;
}
