import { supabase } from '@/lib/supabase';

type UnknownRecord = Record<string, unknown>;

export type CentralChannel = 'whatsapp' | 'email' | 'instagram';
export type CentralSituation = 'waiting' | 'ana' | 'human' | 'transfer' | 'failed' | 'closed' | 'blocked';
export type CentralMode = 'ana' | 'human' | 'waiting_human';

export type CentralInboxFilters = {
  view?: 'all' | 'unread' | 'waiting' | 'mine';
  situation?: 'all' | CentralSituation;
  channel?: 'all' | CentralChannel;
  mode?: 'all' | 'ana' | 'human';
  ownerId?: string;
  stage?: string;
  slaOverdue?: boolean;
  from?: string;
  to?: string;
};

export type CentralInboxItem = {
  leadId: string;
  protocol: string;
  contact: string;
  company: string;
  channel: CentralChannel;
  stage: string;
  stageLabel: string;
  ownerId: string | null;
  ownerName: string;
  situation: CentralSituation;
  preview: string;
  latestAt: string | null;
  unreadCount: number;
  slaDueAt: string | null;
  deliveryStatus: string | null;
  hasFailure: boolean;
};

export type CentralAttachment = {
  id: string;
  mediaType: string;
  mimeType: string | null;
  fileName: string | null;
  externalUrl: string | null;
};

export type CentralKnowledgeEvent = {
  eventType: string;
  presentationFormat: string;
  createdAt: string | null;
  itemName: string;
  itemType: string;
  sourceUrl: string | null;
  sourceLabel: string | null;
  sourceUpdatedAt: string | null;
};

export type CentralMessage = {
  id: string;
  sender: string;
  senderName: string;
  type: string;
  text: string;
  sentAt: string | null;
  createdAt: string;
  messageAt: string;
  providerMessageId: string | null;
  deliveryStatus: string | null;
  providerStatusAt: string | null;
  deliveryError: string | null;
  attempt: number;
  attachments: CentralAttachment[];
  knowledgeEvents: CentralKnowledgeEvent[];
};

export type CentralConversation = {
  leadId: string;
  protocol: string;
  contact: string;
  company: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  uf: string | null;
  origin: string | null;
  channel: CentralChannel;
  stage: string;
  stageLabel: string;
  ownerId: string | null;
  ownerName: string;
  mode: CentralMode;
  handoffId: string | null;
  handoffStatus: string | null;
  slaDueAt: string | null;
  slaLabel: string | null;
  blocked: boolean;
};

export type CentralQualification = {
  summary: string | null;
  technicalContext: Record<string, unknown>;
  missingFields: string[];
  updatedAt: string | null;
  updatedBy: string | null;
  sourceMessageId: string | null;
  sourceAgentRunId: string | null;
  evidence: Record<string, unknown>;
};

export type CentralTask = {
  id: string;
  text: string;
  dueAt: string | null;
  ownerId: string | null;
  ownerLabel: string | null;
  completed: boolean;
  createdAt: string | null;
};

export type CentralNote = {
  id: string;
  body: string;
  visibility: string;
  createdAt: string | null;
  authorName: string;
};

export type CentralActivity = {
  id: string;
  action: string;
  detail: string;
  actorName: string;
  createdAt: string | null;
};

export type CentralConversationDetail = {
  conversation: CentralConversation;
  messages: CentralMessage[];
  hasMoreMessages: boolean;
  qualification: CentralQualification | null;
  tasks: CentralTask[];
  notes: CentralNote[];
  activities: CentralActivity[];
};

export type CentralInboxPage = { items: CentralInboxItem[]; total: number; hasMore: boolean };
export type CentralInboxCounts = { all: number; unread: number; waiting: number; mine: number };

export type CentralTransferTarget = {
  userId: string;
  name: string;
  role: string;
  accountId: string | null;
  accountLabel: string | null;
  provider: 'zapi' | 'meta_cloud' | 'evolution_go' | 'wa_akg' | null;
  phoneSuffix: string | null;
  connectionStatus: string;
  channelReady: boolean;
  unavailableReason: string | null;
};

const asRecord = (value: unknown): UnknownRecord => value && typeof value === 'object' && !Array.isArray(value)
  ? value as UnknownRecord
  : {};
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asString = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
const asNumber = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const asBool = (value: unknown): boolean => value === true;

function channel(value: unknown): CentralChannel {
  return value === 'email' || value === 'instagram' ? value : 'whatsapp';
}

function situation(value: unknown): CentralSituation {
  const valid: CentralSituation[] = ['waiting', 'ana', 'human', 'transfer', 'failed', 'closed', 'blocked'];
  return typeof value === 'string' && valid.includes(value as CentralSituation) ? value as CentralSituation : 'ana';
}

function messageFromRecord(value: unknown): CentralMessage {
  const row = asRecord(value);
  return {
    id: asString(row.id) ?? crypto.randomUUID(),
    sender: asString(row.sender) ?? 'system',
    senderName: asString(row.sender_name) ?? 'Sistema',
    type: asString(row.type) ?? 'text',
    text: asString(row.text) ?? '',
    sentAt: asString(row.sent_at),
    createdAt: asString(row.created_at) ?? new Date(0).toISOString(),
    messageAt: asString(row.message_at) ?? asString(row.created_at) ?? new Date(0).toISOString(),
    providerMessageId: asString(row.provider_message_id),
    deliveryStatus: asString(row.delivery_status),
    providerStatusAt: asString(row.provider_status_at),
    deliveryError: asString(row.delivery_error),
    attempt: asNumber(row.attempt),
    attachments: asArray(row.attachments).map((entry) => {
      const attachment = asRecord(entry);
      return {
        id: asString(attachment.id) ?? crypto.randomUUID(),
        mediaType: asString(attachment.media_type) ?? 'arquivo',
        mimeType: asString(attachment.mime_type),
        fileName: asString(attachment.file_name),
        externalUrl: asString(attachment.external_url),
      };
    }),
    knowledgeEvents: asArray(row.knowledge_events).map((entry) => {
      const event = asRecord(entry);
      return {
        eventType: asString(event.event_type) ?? 'used',
        presentationFormat: asString(event.presentation_format) ?? 'text',
        createdAt: asString(event.created_at),
        itemName: asString(event.item_name) ?? 'Fonte aprovada',
        itemType: asString(event.item_type) ?? 'conteúdo',
        sourceUrl: asString(event.source_url),
        sourceLabel: asString(event.source_label),
        sourceUpdatedAt: asString(event.source_updated_at),
      };
    }),
  };
}

export function mapCentralInboxPage(payload: unknown): CentralInboxPage {
  const root = asRecord(payload);
  return {
    items: asArray(root.items).map((value) => {
      const row = asRecord(value);
      return {
        leadId: asString(row.lead_id) ?? '',
        protocol: asString(row.protocol) ?? '—',
        contact: asString(row.contact) ?? 'Contato não informado',
        company: asString(row.company) ?? 'Empresa não informada',
        channel: channel(row.channel),
        stage: asString(row.stage) ?? 'novo',
        stageLabel: asString(row.stage_label) ?? asString(row.stage) ?? 'Novo',
        ownerId: asString(row.owner_id),
        ownerName: asString(row.owner_name) ?? 'Ana',
        situation: situation(row.situation),
        preview: asString(row.preview) ?? 'Sem mensagens ainda.',
        latestAt: asString(row.latest_at),
        unreadCount: Math.max(0, Math.floor(asNumber(row.unread_count))),
        slaDueAt: asString(row.sla_due_at),
        deliveryStatus: asString(row.delivery_status),
        hasFailure: asBool(row.has_failure),
      };
    }).filter((item) => Boolean(item.leadId)),
    total: Math.max(0, Math.floor(asNumber(root.total))),
    hasMore: asBool(root.has_more),
  };
}

export function mapCentralInboxCounts(payload: unknown): CentralInboxCounts {
  const row = asRecord(payload);
  return {
    all: Math.max(0, Math.floor(asNumber(row.all))),
    unread: Math.max(0, Math.floor(asNumber(row.unread))),
    waiting: Math.max(0, Math.floor(asNumber(row.waiting))),
    mine: Math.max(0, Math.floor(asNumber(row.mine))),
  };
}

export function mapCentralConversationDetail(payload: unknown): CentralConversationDetail | null {
  const root = asRecord(payload);
  const conversationRow = asRecord(root.conversation);
  const leadId = asString(conversationRow.lead_id);
  if (!leadId) return null;
  const rawMode = asString(conversationRow.mode);
  const mode: CentralMode = rawMode === 'human' || rawMode === 'waiting_human' ? rawMode : 'ana';
  const qualificationRow = root.qualification === null ? null : asRecord(root.qualification);
  return {
    conversation: {
      leadId,
      protocol: asString(conversationRow.protocol) ?? '—',
      contact: asString(conversationRow.contact) ?? 'Contato não informado',
      company: asString(conversationRow.company) ?? 'Empresa não informada',
      phone: asString(conversationRow.phone),
      whatsapp: asString(conversationRow.whatsapp),
      email: asString(conversationRow.email),
      city: asString(conversationRow.city),
      uf: asString(conversationRow.uf),
      origin: asString(conversationRow.origin),
      channel: channel(conversationRow.channel),
      stage: asString(conversationRow.stage) ?? 'novo',
      stageLabel: asString(conversationRow.stage_label) ?? asString(conversationRow.stage) ?? 'Novo',
      ownerId: asString(conversationRow.owner_id),
      ownerName: asString(conversationRow.owner_name) ?? 'Ana',
      mode,
      handoffId: asString(conversationRow.handoff_id),
      handoffStatus: asString(conversationRow.handoff_status),
      slaDueAt: asString(conversationRow.sla_due_at),
      slaLabel: asString(conversationRow.sla_label),
      blocked: asBool(conversationRow.blocked),
    },
    messages: asArray(root.messages).map(messageFromRecord),
    hasMoreMessages: asBool(root.has_more_messages),
    qualification: qualificationRow && Object.keys(qualificationRow).length ? {
      summary: asString(qualificationRow.summary),
      technicalContext: asRecord(qualificationRow.technical_context),
      missingFields: asArray(qualificationRow.missing_fields).map(asString).filter((value): value is string => Boolean(value)),
      updatedAt: asString(qualificationRow.updated_at),
      updatedBy: asString(qualificationRow.updated_by),
      sourceMessageId: asString(qualificationRow.source_message_id),
      sourceAgentRunId: asString(qualificationRow.source_agent_run_id),
      evidence: asRecord(qualificationRow.evidence),
    } : null,
    tasks: asArray(root.tasks).map((value) => {
      const task = asRecord(value);
      return {
        id: asString(task.id) ?? crypto.randomUUID(), text: asString(task.text) ?? 'Sem descrição',
        dueAt: asString(task.due_at), ownerId: asString(task.owner_id), ownerLabel: asString(task.owner_label),
        completed: asBool(task.completed), createdAt: asString(task.created_at),
      };
    }),
    notes: asArray(root.notes).map((value) => {
      const note = asRecord(value);
      return {
        id: asString(note.id) ?? crypto.randomUUID(), body: asString(note.body) ?? '', visibility: asString(note.visibility) ?? 'internal',
        createdAt: asString(note.created_at), authorName: asString(note.author_name) ?? 'Equipe',
      };
    }),
    activities: asArray(root.activities).map((value) => {
      const activity = asRecord(value);
      return {
        id: asString(activity.id) ?? crypto.randomUUID(), action: asString(activity.action) ?? 'Atualização',
        detail: asString(activity.detail) ?? '', actorName: asString(activity.actor_name) ?? 'Sistema', createdAt: asString(activity.created_at),
      };
    }),
  };
}

export async function loadCentralInbox(input: { query?: string; filters?: CentralInboxFilters; limit?: number; offset?: number }): Promise<CentralInboxPage> {
  const filters = input.filters ?? {};
  const { data, error } = await supabase.rpc('central_list_conversations', {
    p_query: input.query?.trim() || null,
    p_filters: {
      view: filters.view ?? 'all',
      situation: filters.situation ?? 'all',
      channel: filters.channel ?? 'all',
      mode: filters.mode ?? 'all',
      owner_id: filters.ownerId ?? null,
      stage: filters.stage ?? null,
      sla_overdue: filters.slaOverdue === true,
      from: filters.from ?? null,
      to: filters.to ?? null,
    },
    p_limit: input.limit ?? 25,
    p_offset: input.offset ?? 0,
  });
  if (error) throw error;
  return mapCentralInboxPage(data);
}

export async function loadCentralInboxCounts(input: { query?: string; filters?: CentralInboxFilters }): Promise<CentralInboxCounts> {
  const filters = input.filters ?? {};
  const { data, error } = await supabase.rpc('central_get_inbox_counts', {
    p_query: input.query?.trim() || null,
    p_filters: {
      situation: filters.situation ?? 'all',
      channel: filters.channel ?? 'all',
      mode: filters.mode ?? 'all',
      owner_id: filters.ownerId ?? null,
      stage: filters.stage ?? null,
      sla_overdue: filters.slaOverdue === true,
      from: filters.from ?? null,
      to: filters.to ?? null,
    },
  });
  if (error) throw error;
  return mapCentralInboxCounts(data);
}

export async function loadCentralConversationDetail(leadId: string, before?: string | null): Promise<CentralConversationDetail | null> {
  const { data, error } = await supabase.rpc('central_get_conversation_detail', {
    p_lead_id: leadId,
    p_before: before ?? null,
    p_limit: 40,
  });
  if (error) throw error;
  return mapCentralConversationDetail(data);
}

export async function markCentralConversationRead(leadId: string): Promise<void> {
  const { error } = await supabase.rpc('central_mark_conversation_read', { p_lead_id: leadId });
  if (error) throw error;
}

export async function markCentralConversationUnread(leadId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('central_mark_conversation_unread', { p_lead_id: leadId });
  if (error) throw error;
  return data === true;
}

/**
 * Resolves only the provider already pinned to the lead. This intentionally
 * does not expose account credentials or select a different WhatsApp account.
 */
export async function loadCentralChannelProvider(leadId: string): Promise<'zapi' | 'meta_cloud' | 'evolution_go' | 'wa_akg' | null> {
  const { data, error } = await supabase.rpc('central_get_conversation_channel_provider', { p_lead_id: leadId });
  if (error) throw error;
  return data === 'meta_cloud' || data === 'zapi' || data === 'evolution_go' || data === 'wa_akg' ? data : null;
}

export async function loadCentralTransferTargets(leadId: string): Promise<CentralTransferTarget[]> {
  const { data, error } = await supabase.rpc('central_list_transfer_targets', { p_lead_id: leadId });
  if (error) throw error;
  return asArray(data).map((value) => {
    const row = asRecord(value);
    const provider = asString(row.account_provider);
    const normalizedProvider: CentralTransferTarget['provider'] = provider === 'zapi' || provider === 'meta_cloud' || provider === 'evolution_go' || provider === 'wa_akg'
      ? provider
      : null;
    return {
      userId: asString(row.user_id) ?? '',
      name: asString(row.member_name) ?? 'Usuário',
      role: asString(row.member_role) ?? 'membro',
      accountId: asString(row.account_id),
      accountLabel: asString(row.account_label),
      provider: normalizedProvider,
      phoneSuffix: asString(row.phone_suffix),
      connectionStatus: asString(row.connection_status) ?? 'unconfigured',
      channelReady: asBool(row.channel_ready),
      unavailableReason: asString(row.unavailable_reason),
    };
  }).filter((target) => Boolean(target.userId));
}
