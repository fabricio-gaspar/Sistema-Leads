type Payload = Record<string, unknown>;
const object = (value: unknown): Payload => value && typeof value === 'object' && !Array.isArray(value) ? value as Payload : {};
const text = (value: unknown, max = 4_000) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export type ZapiEvent =
  | { kind: 'ignored'; reason: string }
  | { kind: 'receipt'; reason: string }
  | { kind: 'inbound'; messageId: string; phone: string; text: string; mediaRequiresReview: boolean };

export function providerPhone(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\+?[\d ()-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function parseZapiEvent(value: unknown): ZapiEvent {
  const payload = object(value);
  if (payload.type === 'MessageStatusCallback' || payload.type === 'DeliveryCallback') return { kind: 'receipt', reason: 'receipt_reconciliation_pending' };
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
    kind: 'inbound',
    messageId,
    phone,
    text: content || `[${media} recebido; conteúdo ainda não extraído. Revisão humana necessária.]`,
    mediaRequiresReview: Boolean(media),
  };
}
