import { phoneFromPersonalJid, inboundMedia, type InboundMedia } from './messaging/inboundIdentity.ts';
type Row = Record<string, unknown>;

export type WaAkgInboundEvent =
  | { kind: 'inbound'; externalId: string; messageId: string; phone: string; senderJid: string; text: string; occurredAt: string; messageType: string; media?: InboundMedia }
  | { kind: 'receipt'; externalId: string; providerMessageIds: string[]; status: 'sent' | 'delivered' | 'read' | 'failed'; occurredAt: string }
  | { kind: 'connection'; externalId: string; state: 'connected' | 'disconnected' | 'qr'; occurredAt: string }
  | { kind: 'ignored'; reason: string; externalId: string; occurredAt: string };

const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Row
  : {};
const text = (value: unknown, max = 4_096): string => typeof value === 'string'
  ? value.trim().slice(0, max)
  : '';

function instant(value: unknown): string {
  const raw = text(value, 80);
  if (raw && Number.isFinite(Date.parse(raw))) return new Date(raw).toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1_000;
    return new Date(millis).toISOString();
  }
  return new Date().toISOString();
}

function status(value: unknown): 'sent' | 'delivered' | 'read' | 'failed' | null {
  const normalized = text(value, 40).toUpperCase();
  if (normalized === 'READ') return 'read';
  if (normalized === 'DELIVERED') return 'delivered';
  if (normalized === 'ERROR' || normalized === 'FAILED') return 'failed';
  return normalized === 'SENT' ? 'sent' : null;
}

function stableExternalId(event: string, sessionId: string, data: Row, key: Row, occurredAt: string): string {
  const id = text(key.id ?? data.id, 300);
  if (id) return `${event}:${id}`;
  return `${event}:${sessionId || 'unknown'}:${occurredAt}`.slice(0, 300);
}

export function parseWaAkgEvent(input: unknown): WaAkgInboundEvent {
  const payload = object(input);
  const event = text(payload.event ?? payload.type, 80).toLowerCase();
  const data = object(payload.data);
  const key = object(data.key);
  const session = text(payload.sessionId ?? payload.session_id ?? data.sessionId, 120);
  const occurredAt = instant(payload.timestamp ?? data.timestamp ?? data.messageTimestamp);
  const externalId = stableExternalId(event || 'unknown', session, data, key, occurredAt);

  if (event === 'connection.update') {
    const rawState = text(data.status ?? data.state ?? payload.status, 80).toUpperCase();
    const state = rawState === 'CONNECTED'
      ? 'connected'
      : rawState === 'SCAN_QR' || rawState === 'QR'
        ? 'qr'
        : 'disconnected';
    return { kind: 'connection', externalId, state, occurredAt };
  }

  if (event === 'message.status') {
    // keyId is the versioned WA-AKG receipt contract; retain earlier adapters.
    const id = text(data.keyId ?? key.id ?? data.messageId ?? data.id, 300);
    if (!id) return { kind: 'ignored', reason: 'receipt_message_id_missing', externalId, occurredAt };
    const receiptStatus = status(data.status ?? payload.status);
    if (!receiptStatus) return { kind: 'ignored', reason: 'receipt_status_unsupported', externalId, occurredAt };
    return {
      kind: 'receipt',
      // Do not use timestamps: identical callbacks can be retried with a new time.
      // A status transition is a new event; an identical transition is not.
      externalId: `message.status:${receiptStatus}:${id}`,
      providerMessageIds: [id],
      status: receiptStatus,
      occurredAt,
    };
  }

  if (event !== 'message.received') {
    return { kind: 'ignored', reason: 'event_not_supported', externalId, occurredAt };
  }
  if (key.fromMe === true || data.fromMe === true) {
    return { kind: 'ignored', reason: 'outbound_echo', externalId, occurredAt };
  }
  const jid = text(key.remoteJid ?? data.from ?? data.remoteJid, 200);
  if (!jid || /@g\.us$|@broadcast$|status@broadcast$|@newsletter$/.test(jid)) {
    return { kind: 'ignored', reason: 'non_personal_chat', externalId, occurredAt };
  }
  const phone = phoneFromPersonalJid(jid) ?? '';
  // Preserve unresolved personal identities for human review. Do not derive a
  // phone from @lid or accept an unverified mapping supplied in arbitrary fields.
  const content = object(data.content ?? data.message);
  const messageType = text(data.type ?? payload.messageType, 40).toLowerCase() || 'text';
  const media = inboundMedia(messageType, data.fileUrl ?? content.fileUrl ?? content.url,
    data.mimeType ?? content.mimetype, data.fileName ?? content.fileName);
  const body = text(
    typeof data.content === 'string' ? data.content
      : data.text ?? data.caption ?? content.text ?? content.caption ?? content.conversation,
    4_096,
  );
  if (!body && !media) {
    return { kind: 'ignored', reason: 'message_content_unsupported', externalId, occurredAt };
  }
  const messageId = text(key.id ?? data.id, 300);
  if (!messageId) return { kind: 'ignored', reason: 'message_id_missing', externalId, occurredAt };
  return { kind: 'inbound', externalId, messageId, phone, senderJid: jid,
    text: body || `[${media?.kind} recebido; revisão humana necessária.]`, occurredAt, messageType, media };
}

/** Only the normalized fields required by the worker are persisted. */
export function sanitizeWaAkgPayload(input: unknown): Row {
  const parsed = parseWaAkgEvent(input);
  return parsed.kind === 'inbound'
    ? { kind: parsed.kind, external_id: parsed.externalId, message_id: parsed.messageId, phone: parsed.phone,
      remote_jid: parsed.senderJid, identity_requires_review: !parsed.phone, media: parsed.media,
      text: parsed.text, occurred_at: parsed.occurredAt, message_type: parsed.messageType }
    : parsed.kind === 'receipt'
      ? { kind: parsed.kind, external_id: parsed.externalId, provider_message_ids: parsed.providerMessageIds, status: parsed.status, occurred_at: parsed.occurredAt }
      : parsed.kind === 'connection'
        ? { kind: parsed.kind, external_id: parsed.externalId, state: parsed.state, occurred_at: parsed.occurredAt }
        : { kind: parsed.kind, external_id: parsed.externalId, reason: parsed.reason, occurred_at: parsed.occurredAt };
}
