type Payload = Record<string, unknown>;
const object = (value: unknown): Payload => value && typeof value === 'object' && !Array.isArray(value) ? value as Payload : {};
const text = (value: unknown, max = 4_000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const MAX_RECEIPT_IDS = 100;

export type ZapiEvent =
  | { kind: 'ignored'; reason: string }
  | {
      kind: 'receipt';
      reason: string;
      providerMessageIds: string[];
      expectedMessageCount: number;
      status: 'sent' | 'delivered' | 'read' | 'failed';
      occurredAt: string;
      providerError: boolean;
    }
  | { kind: 'inbound'; messageId: string; phone: string; text: string; mediaRequiresReview: boolean };

function providerMessageIds(payload: Payload): string[] {
  const values = [
    ...(Array.isArray(payload.ids) ? payload.ids : []),
    payload.messageId,
    payload.zaapId,
    payload.message_id,
  ];
  return [...new Set(values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.length <= 300))].slice(0, MAX_RECEIPT_IDS);
}

function occurredAt(...values: unknown[]): string {
  for (const value of values) {
    const timestamp = typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) continue;
    const date = new Date(timestamp < 10_000_000_000 ? timestamp * 1_000 : timestamp);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

// Z-API callbacks carry international digits. Do not strip arbitrary letters or JIDs.
export function providerPhone(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\+?[\d ()-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function storedPhone(value: unknown): string | null {
  const normalized = providerPhone(value);
  if (!normalized) return null;
  // WayFlex's existing local records are Brazilian DDD + subscriber number.
  // Never drop a country code or guess the mobile ninth digit.
  return typeof value === 'string' && !value.trim().startsWith('+') && [10, 11].includes(normalized.length)
    ? `55${normalized}` : normalized;
}

export function parseZapiEvent(value: unknown): ZapiEvent {
  const payload = object(value);
  if (payload.type === 'MessageStatusCallback' || payload.type === 'DeliveryCallback') {
    const rawBatchIds = [...new Set((Array.isArray(payload.ids) ? payload.ids : [])
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item.length <= 300))];
    if (rawBatchIds.length > MAX_RECEIPT_IDS) return { kind: 'ignored', reason: 'receipt_batch_too_large' };
    const ids = providerMessageIds(payload);
    if (!ids.length) return { kind: 'ignored', reason: 'receipt_message_id_required' };
    const providerError = typeof payload.error === 'string'
      ? payload.error.trim().length > 0
      : Boolean(payload.error && (typeof payload.error !== 'object' || Object.keys(object(payload.error)).length > 0));
    const rawStatus = text(payload.status, 40).toUpperCase();
    const status = providerError
      ? 'failed'
      : payload.type === 'DeliveryCallback' || rawStatus === 'SENT'
        ? 'sent'
        : ['READ', 'READ_BY_ME', 'PLAYED'].includes(rawStatus)
          ? 'read'
          : rawStatus === 'RECEIVED'
            ? 'delivered'
            : ['FAILED', 'ERROR'].includes(rawStatus)
              ? 'failed'
            : null;
    if (!status) return { kind: 'ignored', reason: 'unsupported_receipt_status' };
    return {
      kind: 'receipt',
      reason: providerError ? 'provider_delivery_failed' : `provider_${status}`,
      providerMessageIds: ids,
      expectedMessageCount: rawBatchIds.length || 1,
      status,
      occurredAt: occurredAt(payload.momment, payload.moment, payload.timestamp, payload.createdAt),
      providerError,
    };
  }
  if (payload.type !== 'ReceivedCallback') return { kind: 'ignored', reason: 'unsupported_callback' };
  if (payload.fromMe !== false) return { kind: 'ignored', reason: 'outgoing_or_unknown_direction' };
  if (payload.isGroup !== false || payload.isNewsletter === true || payload.broadcast === true) return { kind: 'ignored', reason: 'non_direct_conversation' };
  if (payload.notification || payload.reaction || payload.isEdit === true || payload.waitingMessage === true) return { kind: 'ignored', reason: 'non_message_event' };
  const messageId = text(payload.messageId, 300);
  if (!messageId || messageId.length > 160) return { kind: 'ignored', reason: 'stable_message_id_required' };
  const phone = providerPhone(payload.phone);
  if (!phone) return { kind: 'ignored', reason: 'invalid_phone' };
  const content = text(payload.text) || text(object(payload.text).message);
  const media = ['image', 'audio', 'video', 'document', 'sticker'].find((key) => Object.keys(object(payload[key])).length > 0);
  if (!content && !media) return { kind: 'ignored', reason: 'unsupported_message_content' };
  return {
    kind: 'inbound', messageId, phone,
    text: content || `[${media} recebido; conteúdo ainda não extraído. Revisão humana necessária.]`,
    mediaRequiresReview: Boolean(media),
  };
}
