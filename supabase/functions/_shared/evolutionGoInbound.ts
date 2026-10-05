type Payload = Record<string, unknown>;
const object = (value: unknown): Payload => value && typeof value === 'object' && !Array.isArray(value) ? value as Payload : {};
const text = (value: unknown, max = 4_000): string => typeof value === 'string' ? value.trim().slice(0, max) : '';

export type EvolutionGoInboundEvent =
  | { kind: 'ignored'; reason: string }
  | { kind: 'inbound'; messageId: string; phone: string; text: string; mediaKind?: 'image' | 'audio' | 'video' | 'document'; occurredAt?: string }
  | { kind: 'receipt'; providerMessageIds: string[]; status: 'sent' | 'delivered' | 'read' | 'failed'; occurredAt?: string }
  | { kind: 'connection'; state: 'connected' | 'disconnected' | 'logged_out'; occurredAt?: string };

function eventName(payload: Payload): string {
  return text(payload.event ?? payload.type ?? payload.action, 100).toLowerCase().replace(/[^a-z]/g, '');
}

function dateValue(value: unknown): string | undefined {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  const date = new Date(numeric < 10_000_000_000 ? numeric * 1_000 : numeric);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function cleanPhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const jid = value.trim().toLowerCase();
  if (!jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid.includes('@lid')) return null;
  const local = jid.includes('@') ? jid.split('@')[0] : jid;
  if (!/^\+?[\d ()-]+$/.test(local)) return null;
  const digits = local.replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

function messageContent(message: Payload): { value: string; mediaKind?: 'image' | 'audio' | 'video' | 'document' } {
  const direct = text(message.conversation) || text(object(message.extendedTextMessage).text);
  if (direct) return { value: direct };
  const mediaKinds = [
    ['imageMessage', 'image'], ['audioMessage', 'audio'], ['videoMessage', 'video'], ['documentMessage', 'document'],
  ] as const;
  for (const [field, mediaKind] of mediaKinds) {
    const candidate = object(message[field]);
    if (!Object.keys(candidate).length) continue;
    const caption = text(candidate.caption);
    return { value: caption || `[${mediaKind} recebido; conteúdo ainda não extraído. Revisão humana necessária.]`, mediaKind };
  }
  return { value: '' };
}

function receiptStatus(value: unknown): 'sent' | 'delivered' | 'read' | 'failed' | null {
  const state = text(value, 50).toLowerCase();
  if (['sent', 'serverack', 'ack'].includes(state)) return 'sent';
  if (['delivered', 'delivery', 'deliveredack'].includes(state)) return 'delivered';
  if (['read', 'played'].includes(state)) return 'read';
  if (['failed', 'error'].includes(state)) return 'failed';
  return null;
}

/** Parse the documented Evolution GO event families without treating unknown payloads as a lead reply. */
export function parseEvolutionGoEvent(value: unknown): EvolutionGoInboundEvent {
  const payload = object(value);
  const name = eventName(payload);
  const data = object(payload.data);
  const occurredAt = dateValue(data.timestamp ?? data.messageTimestamp ?? payload.timestamp ?? payload.date);

  if (name.includes('connection') || name === 'connected' || name === 'disconnected' || name === 'loggedout') {
    const state = name.includes('logout') ? 'logged_out' : name.includes('disconnect') ? 'disconnected' : 'connected';
    return { kind: 'connection', state, occurredAt };
  }

  if (name.includes('receipt') || name.includes('readreceipt') || name.includes('sendmessage')) {
    const ids = [...new Set([
      object(data.key).id, data.id, object(data.info).id, object(data.Info).ID,
      ...(Array.isArray(data.ids) ? data.ids : []),
    ].filter((id): id is string => typeof id === 'string' && id.trim().length > 0 && id.trim().length <= 300)
      .map((id) => id.trim()))].slice(0, 100);
    const status = receiptStatus(data.status ?? data.type ?? payload.status);
    if (!ids.length || !status) return { kind: 'ignored', reason: 'unsupported_receipt' };
    return { kind: 'receipt', providerMessageIds: ids, status, occurredAt };
  }

  if (!name.includes('message')) return { kind: 'ignored', reason: 'unsupported_event' };
  const key = object(data.key);
  if (key.fromMe !== false || data.fromMe === true) return { kind: 'ignored', reason: 'outgoing_or_unknown_direction' };
  const messageId = text(key.id ?? data.id, 300);
  const phone = cleanPhone(key.remoteJid ?? data.remoteJid ?? data.from ?? data.sender);
  const content = messageContent(object(data.message ?? data));
  if (!messageId || !phone || !content.value) return { kind: 'ignored', reason: 'message_identity_or_content_invalid' };
  return { kind: 'inbound', messageId, phone, text: content.value, mediaKind: content.mediaKind, occurredAt };
}

/** Removes credentials/QR values before persistence or diagnostic logging. */
export function sanitizeEvolutionGoPayload(value: unknown): Payload {
  const payload = object(value);
  const event = text(payload.event ?? payload.type ?? payload.action, 100);
  const data = object(payload.data);
  const key = object(data.key);
  const message = object(data.message);
  const parsed = parseEvolutionGoEvent(payload);
  return {
    event,
    message_id: parsed.kind === 'inbound' ? parsed.messageId : undefined,
    provider_message_ids: parsed.kind === 'receipt' ? parsed.providerMessageIds : undefined,
    status: parsed.kind === 'receipt' ? parsed.status : undefined,
    state: parsed.kind === 'connection' ? parsed.state : undefined,
    remote_jid: text(key.remoteJid ?? data.remoteJid, 160) || undefined,
    from_me: key.fromMe === true || data.fromMe === true,
    timestamp: parsed.kind !== 'ignored' ? parsed.occurredAt : undefined,
    text: parsed.kind === 'inbound' ? parsed.text : undefined,
    media_kind: parsed.kind === 'inbound' ? parsed.mediaKind : undefined,
    has_message: Object.keys(message).length > 0,
  };
}
