import type { DeliveryStatus } from './MessagingProvider.ts';

type ObjectValue = Record<string, unknown>;

export type MetaWebhookEvent =
  | {
      kind: 'inbound';
      externalEventId: string;
      phoneNumberId: string;
      providerMessageId: string;
      from: string;
      occurredAt: string;
      messageType: string;
      text: string | null;
      mediaId: string | null;
    }
  | {
      kind: 'status';
      externalEventId: string;
      phoneNumberId: string;
      providerMessageId: string;
      recipientId: string | null;
      status: DeliveryStatus;
      occurredAt: string;
      error: { code: string | null; title: string | null } | null;
      pricingCategory: string | null;
    }
  | {
      kind: 'message_echo';
      externalEventId: string;
      phoneNumberId: string;
      providerMessageId: string;
      to: string | null;
      occurredAt: string;
      messageType: string;
      text: string | null;
      mediaId: string | null;
    }
  | {
      kind: 'history' | 'sync';
      externalEventId: string;
      phoneNumberId: string;
      occurredAt: string;
      cursor: string | null;
    }
  | { kind: 'ignored'; externalEventId: string; reason: string };

function object(value: unknown): ObjectValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {};
}

function text(value: unknown, maximum = 4_096): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function digits(value: unknown): string {
  const candidate = text(value, 80).replace(/\D/g, '');
  return /^[1-9]\d{4,39}$/.test(candidate) ? candidate : '';
}

function timestamp(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return new Date(0).toISOString();
  const date = new Date(numeric < 10_000_000_000 ? numeric * 1_000 : numeric);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function messageContent(message: ObjectValue): { messageType: string; text: string | null; mediaId: string | null } {
  const messageType = text(message.type, 40) || 'unknown';
  if (messageType === 'text') return { messageType, text: text(object(message.text).body) || null, mediaId: null };
  if (messageType === 'button') return { messageType, text: text(object(message.button).text) || null, mediaId: null };
  if (messageType === 'interactive') {
    const interactive = object(message.interactive);
    const reply = object(interactive.button_reply);
    const list = object(interactive.list_reply);
    return { messageType, text: text(reply.title) || text(list.title) || null, mediaId: null };
  }
  if (['image', 'audio', 'video', 'document', 'sticker'].includes(messageType)) {
    const media = object(message[messageType]);
    return { messageType, text: text(media.caption) || null, mediaId: text(media.id, 300) || null };
  }
  return { messageType, text: null, mediaId: null };
}

function firstStatusError(status: ObjectValue): { code: string | null; title: string | null } | null {
  const errors = Array.isArray(status.errors) ? status.errors : [];
  if (!errors.length) return null;
  const error = object(errors[0]);
  const code = typeof error.code === 'number' || typeof error.code === 'string'
    ? String(error.code).slice(0, 80)
    : null;
  const title = text(error.title, 240) || null;
  return { code, title };
}

function eventId(prefix: string, ...parts: unknown[]): string {
  return [prefix, ...parts.map((part) => text(part, 300) || 'missing')].join(':').slice(0, 900);
}

export function parseMetaWebhook(payload: unknown): MetaWebhookEvent[] {
  const root = object(payload);
  if (root.object !== 'whatsapp_business_account') {
    return [{ kind: 'ignored', externalEventId: 'unsupported-object', reason: 'unsupported_object' }];
  }
  const events: MetaWebhookEvent[] = [];
  const entries = Array.isArray(root.entry) ? root.entry : [];
  for (const rawEntry of entries) {
    const entry = object(rawEntry);
    const entryId = text(entry.id, 300) || 'entry';
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const rawChange of changes) {
      const change = object(rawChange);
      const field = text(change.field, 80);
      const value = object(change.value);
      const metadata = object(value.metadata);
      const phoneNumberId = digits(metadata.phone_number_id) || digits(value.phone_number_id);

      if (field === 'messages') {
        const messages = Array.isArray(value.messages) ? value.messages : [];
        for (const rawMessage of messages) {
          const message = object(rawMessage);
          const providerMessageId = text(message.id, 300);
          const from = digits(message.from);
          if (!phoneNumberId || !providerMessageId || !from) {
            events.push({ kind: 'ignored', externalEventId: eventId('message', entryId, providerMessageId), reason: 'message_identity_missing' });
            continue;
          }
          const content = messageContent(message);
          events.push({
            kind: 'inbound',
            externalEventId: eventId('inbound', providerMessageId),
            phoneNumberId,
            providerMessageId,
            from,
            occurredAt: timestamp(message.timestamp),
            ...content,
          });
        }

        const statuses = Array.isArray(value.statuses) ? value.statuses : [];
        for (const rawStatus of statuses) {
          const status = object(rawStatus);
          const providerMessageId = text(status.id, 300);
          const normalizedStatus = text(status.status, 40).toLowerCase();
          if (!phoneNumberId || !providerMessageId || !['sent', 'delivered', 'read', 'failed'].includes(normalizedStatus)) {
            events.push({ kind: 'ignored', externalEventId: eventId('status', entryId, providerMessageId, normalizedStatus), reason: 'status_unsupported' });
            continue;
          }
          const occurredAt = timestamp(status.timestamp);
          events.push({
            kind: 'status',
            externalEventId: eventId('status', providerMessageId, normalizedStatus, occurredAt),
            phoneNumberId,
            providerMessageId,
            recipientId: digits(status.recipient_id) || null,
            status: normalizedStatus as DeliveryStatus,
            occurredAt,
            error: firstStatusError(status),
            pricingCategory: text(object(status.pricing).category, 120) || null,
          });
        }
        if (!messages.length && !statuses.length) {
          events.push({ kind: 'ignored', externalEventId: eventId('messages', entryId), reason: 'empty_messages_change' });
        }
        continue;
      }

      if (field === 'smb_message_echoes') {
        const echoes = Array.isArray(value.messages) ? value.messages : Array.isArray(value.message_echoes) ? value.message_echoes : [];
        for (const rawEcho of echoes) {
          const echo = object(rawEcho);
          const providerMessageId = text(echo.id, 300);
          if (!phoneNumberId || !providerMessageId) {
            events.push({ kind: 'ignored', externalEventId: eventId('echo', entryId, providerMessageId), reason: 'echo_identity_missing' });
            continue;
          }
          const content = messageContent(echo);
          events.push({
            kind: 'message_echo',
            externalEventId: eventId('echo', providerMessageId),
            phoneNumberId,
            providerMessageId,
            to: digits(echo.to) || digits(echo.from) || null,
            occurredAt: timestamp(echo.timestamp),
            ...content,
          });
        }
        if (!echoes.length) events.push({ kind: 'ignored', externalEventId: eventId('echo', entryId), reason: 'empty_echo_change' });
        continue;
      }

      if (field === 'history' || field === 'smb_app_state_sync') {
        const occurredAt = timestamp(value.timestamp ?? entry.time);
        events.push({
          kind: field === 'history' ? 'history' : 'sync',
          externalEventId: eventId(field, entryId, occurredAt, value.event ?? value.sync_id),
          phoneNumberId,
          occurredAt,
          cursor: text(value.cursor, 500) || null,
        });
        continue;
      }

      events.push({ kind: 'ignored', externalEventId: eventId('change', entryId, field), reason: 'unsupported_change_field' });
    }
  }
  return events.length ? events : [{ kind: 'ignored', externalEventId: 'empty-webhook', reason: 'empty_webhook' }];
}

