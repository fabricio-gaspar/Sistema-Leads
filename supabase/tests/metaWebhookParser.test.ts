import { describe, expect, it } from 'vitest';
import { parseMetaWebhook } from '../functions/_shared/messaging/metaWebhookParser.ts';

const envelope = (field: string, value: Record<string, unknown>) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: 'waba-1', changes: [{ field, value }] }],
});

describe('Meta webhook parser', () => {
  it('parses an individual inbound message without retaining the full payload', () => {
    const [event] = parseMetaWebhook(envelope('messages', {
      metadata: { phone_number_id: '1234567890', display_phone_number: '5511999999999' },
      contacts: [{ wa_id: '5511988887777', profile: { name: 'Cliente sintético' } }],
      messages: [{ id: 'wamid.inbound-1', from: '5511988887777', timestamp: '1789750800', type: 'text', text: { body: 'Olá' } }],
      provider_secret: 'must-not-be-copied',
    }));

    expect(event).toMatchObject({
      kind: 'inbound', phoneNumberId: '1234567890', providerMessageId: 'wamid.inbound-1',
      from: '5511988887777', messageType: 'text', text: 'Olá', mediaId: null,
    });
    expect(JSON.stringify(event)).not.toContain('must-not-be-copied');
    expect(JSON.stringify(event)).not.toContain('Cliente sintético');
  });

  it('keeps status timestamps so out-of-order notifications can be reconciled in the database', () => {
    const events = parseMetaWebhook(envelope('messages', {
      metadata: { phone_number_id: '1234567890' },
      statuses: [
        { id: 'wamid.outbound-1', status: 'read', timestamp: '1789750900', recipient_id: '5511988887777', pricing: { category: 'service' } },
        { id: 'wamid.outbound-1', status: 'delivered', timestamp: '1789750850', recipient_id: '5511988887777' },
      ],
    }));
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'status', status: 'read', occurredAt: '2026-09-18T17:01:40.000Z', pricingCategory: 'service' }),
      expect.objectContaining({ kind: 'status', status: 'delivered', occurredAt: '2026-09-18T17:00:50.000Z' }),
    ]));
  });

  it('recognizes supported Coexistence echo and sync fields defensively', () => {
    const [echo] = parseMetaWebhook(envelope('smb_message_echoes', {
      metadata: { phone_number_id: '1234567890' },
      messages: [{ id: 'wamid.echo-1', to: '5511988887777', timestamp: '1789750800', type: 'text', text: { body: 'Resposta pelo aplicativo' } }],
    }));
    const [sync] = parseMetaWebhook(envelope('smb_app_state_sync', {
      phone_number_id: '1234567890', timestamp: '1789750800', sync_id: 'sync-1', cursor: 'cursor-1',
    }));
    expect(echo).toMatchObject({ kind: 'message_echo', to: '5511988887777', text: 'Resposta pelo aplicativo' });
    expect(sync).toMatchObject({ kind: 'sync', phoneNumberId: '1234567890', cursor: 'cursor-1' });
  });

  it('does not invent identities for incomplete events', () => {
    expect(parseMetaWebhook(envelope('messages', { messages: [{ type: 'text', text: { body: 'Sem identidade' } }] }))[0])
      .toMatchObject({ kind: 'ignored', reason: 'message_identity_missing' });
    expect(parseMetaWebhook({ object: 'not-whatsapp' })[0])
      .toMatchObject({ kind: 'ignored', reason: 'unsupported_object' });
  });
});

