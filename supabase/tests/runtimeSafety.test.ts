import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { anaEventKey, anaResponseSucceeded, automationBlockReason, zapiBaseUrl } from '../functions/_shared/runtimeSafety';
import { parseZapiEvent, providerPhone, storedPhone } from '../functions/_shared/zapiInbound';

const ready = {
  company: { active: true, sandbox_mode: false, can_use_ia: true, ai_actions_enabled: true },
  ai: { enabled: true, connected: true, paused: false },
  runtime: { killSwitchGlobal: false },
  lead: { owner_id: 'owner', modo_atendimento: 'ia', ai_paused: false, opt_out: false, contact_approval_status: 'approved' },
};
describe('backend safety authority', () => {
  it('allows only explicitly ready automation', () => expect(automationBlockReason(ready)).toBeNull());
  it('requires recorded approval for proactive automation', () => {
    expect(automationBlockReason({ ...ready, lead: { ...ready.lead, contact_approval_status: 'pending' }, requiresApprovedContact: true })).toBe('contact_approval_required');
    expect(automationBlockReason({ ...ready, lead: { ...ready.lead, contact_approval_status: 'pending' } })).toBeNull();
  });
  it.each([
    [{ ...ready, company: null }, 'company_inactive'],
    [{ ...ready, company: { ...ready.company, active: false } }, 'company_inactive'],
    [{ ...ready, company: { ...ready.company, sandbox_mode: true } }, 'sandbox_mode'],
    [{ ...ready, company: { ...ready.company, sandbox_mode: undefined } }, 'sandbox_mode'],
    [{ ...ready, company: { ...ready.company, can_use_ia: false } }, 'company_ai_disabled'],
    [{ ...ready, company: { ...ready.company, ai_actions_enabled: false } }, 'company_ai_disabled'],
    [{ ...ready, runtime: null }, 'kill_switch_or_config_missing'],
    [{ ...ready, runtime: { killSwitchGlobal: true } }, 'kill_switch_or_config_missing'],
    [{ ...ready, runtime: { killSwitchGlobal: 'false' } }, 'kill_switch_or_config_missing'],
    [{ ...ready, ai: null }, 'ai_integration_not_ready'],
    [{ ...ready, ai: { ...ready.ai, connected: false } }, 'ai_integration_not_ready'],
    [{ ...ready, ai: { ...ready.ai, enabled: false } }, 'ai_integration_not_ready'],
    [{ ...ready, ai: { ...ready.ai, paused: true } }, 'ai_integration_not_ready'],
    [{ ...ready, ai: { ...ready.ai, paused: null } }, 'ai_integration_not_ready'],
    [{ ...ready, lead: null }, 'lead_owner_required'],
    [{ ...ready, lead: { ...ready.lead, modo_atendimento: 'humano' } }, 'human_mode'],
    [{ ...ready, lead: { ...ready.lead, ai_paused: true } }, 'lead_paused'],
    [{ ...ready, lead: { ...ready.lead, opt_out: true } }, 'lead_opt_out'],
  ])('fails closed: %#', (input, reason) => expect(automationBlockReason(input)).toBe(reason));
  it('permits explicit sandbox simulation, still respects human pause', () => {
    expect(automationBlockReason({ ...ready, company: { ...ready.company, sandbox_mode: true }, dryRun: true })).toBeNull();
    expect(automationBlockReason({ ...ready, lead: { ...ready.lead, ai_paused: true }, dryRun: true })).toBe('lead_paused');
  });
  it('uses a stable inbound occurrence, not the clock', () => {
    expect(anaEventKey('message.received', 'lead', 'provider-id', 'request-1')).toBe(anaEventKey('message.received', 'lead', 'provider-id', 'request-2'));
    expect(() => anaEventKey('message.received', 'lead', '', 'request')).toThrow('inbound_message_id_required');
    expect(() => anaEventKey('timeout.48h', 'lead', '', 'request')).toThrow('timeout_owned_by_server_scheduler');
  });
  it.each([[200, { ok: true }, true], [200, { ok: false }, false], [200, { duplicate: true }, false], [500, { ok: true }, false], [200, null, false], [202, { ok: true, skipped: true }, true]])('checks semantic completion: %#', (status, body, expected) => {
    expect(anaResponseSucceeded(status as number, body)).toBe(expected);
  });
  it.each(['http://api.z-api.io', 'https://evil.example', 'https://api.z-api.io.evil.example', 'https://api.z-api.io/private', 'https://user:secret@api.z-api.io', 'https://api.z-api.io?token=secret'])('rejects credential exfiltration URL %s', (url) => expect(() => zapiBaseUrl(url)).toThrow());
  it('accepts only the official HTTPS provider origin', () => expect(zapiBaseUrl(undefined)).toBe('https://api.z-api.io'));
});

const inbound = { type: 'ReceivedCallback', fromMe: false, isGroup: false, messageId: 'SYNTHETIC-MESSAGE-1', phone: '5511999990000', text: { message: 'Quero uma peça de borracha' } };
describe('Z-API contract — synthetic payloads only', () => {
  it('extracts the real nested text shape', () => expect(parseZapiEvent(inbound)).toMatchObject({ kind: 'inbound', text: 'Quero uma peça de borracha', mediaRequiresReview: false }));
  it.each([
    { fromMe: true }, { fromMe: undefined }, { isGroup: true }, { isGroup: undefined }, { isNewsletter: true }, { broadcast: true },
    { notification: 'PROFILE_NAME_UPDATED' }, { reaction: { value: '❤️' } }, { isEdit: true }, { waitingMessage: true },
    { type: 'ConnectedCallback' }, { messageId: '' }, { phone: '5511999990000-group' }, { phone: '81896604192873@lid' },
  ])('does not feed non-inbound event %# to Ana', (patch) => expect(parseZapiEvent({ ...inbound, ...patch }).kind).toBe('ignored'));
  it('keeps provider receipts separate from inbound lead replies with their ordered status', () => {
    expect(parseZapiEvent({ type: 'DeliveryCallback', messageId: 'provider-sent' })).toMatchObject({ kind: 'receipt', status: 'sent', expectedMessageCount: 1 });
    expect(parseZapiEvent({ type: 'MessageStatusCallback', status: 'RECEIVED', ids: ['provider-delivered'] })).toMatchObject({ kind: 'receipt', status: 'delivered', expectedMessageCount: 1 });
    expect(parseZapiEvent({ type: 'MessageStatusCallback', status: 'READ', ids: ['provider-read'] })).toMatchObject({ kind: 'receipt', status: 'read', expectedMessageCount: 1 });
  });
  it('preserves every unique ID and the exact expected batch size for receipt reconciliation', () => {
    expect(parseZapiEvent({
      type: 'MessageStatusCallback', status: 'READ', ids: ['provider-1', 'provider-2', 'provider-1'], moment: 1_772_494_009_341,
    })).toMatchObject({
      kind: 'receipt',
      providerMessageIds: ['provider-1', 'provider-2'],
      expectedMessageCount: 2,
      occurredAt: '2026-03-02T23:26:49.341Z',
    });
  });
  it('treats an explicit provider error as failed and rejects oversized receipt batches', () => {
    expect(parseZapiEvent({ type: 'DeliveryCallback', messageId: 'provider-error', error: 'synthetic provider failure' })).toMatchObject({ kind: 'receipt', status: 'failed', providerError: true });
    expect(parseZapiEvent({ type: 'MessageStatusCallback', status: 'READ', ids: Array.from({ length: 101 }, (_, index) => `provider-${index}`) })).toEqual({ kind: 'ignored', reason: 'receipt_batch_too_large' });
  });
  it.each(['image', 'audio', 'video', 'document', 'sticker'])('marks %s as unprocessed media, never invented text', (kind) => {
    expect(parseZapiEvent({ ...inbound, text: undefined, [kind]: { mimeType: 'test', url: 'https://example.invalid/media' } })).toMatchObject({ kind: 'inbound', mediaRequiresReview: true, text: expect.stringContaining('ainda não extraído') });
  });
  it('does not drop media when there is also a caption/text', () => expect(parseZapiEvent({ ...inbound, image: { imageUrl: 'https://example.invalid/photo' } })).toMatchObject({ mediaRequiresReview: true }));
  it('normalizes only explicit phone identities', () => {
    expect(storedPhone('(11) 99999-0000')).toBe('5511999990000');
    expect(storedPhone('+55 (11) 99999-0000')).toBe('5511999990000');
    expect(storedPhone('+1 (202) 555-0123')).toBe('12025550123');
    expect(providerPhone('5511999990000-group')).toBeNull();
    expect(storedPhone('99999-0000')).toBe('999990000');
    expect(storedPhone('+54 11 99999-0000')).not.toBe(storedPhone('+55 11 99999-0000'));
  });
});

describe('Z-API direct-test reservation migration', () => {
  it('keeps PostgreSQL special forms unqualified', () => {
    const migration = readFileSync(
      new URL('../migrations/20260917150914_fix_whatsapp_direct_test_reservation_special_forms.sql', import.meta.url),
      'utf8',
    );

    expect(migration).toContain('v_actor_name := coalesce(');
    expect(migration).toContain("nullif(pg_catalog.left(pg_catalog.btrim(p_actor_name), 160), ''::text)");
    expect(migration).not.toContain('pg_catalog.coalesce(');
    expect(migration).not.toContain('pg_catalog.nullif(');
  });
});

describe('Ana automatic dashboard control migration', () => {
  it('keeps the one-click control atomic, server-only and fail-closed', () => {
    const migration = readFileSync(
      new URL('../migrations/20260927130054_dashboard_ana_automatic_control.sql', import.meta.url),
      'utf8',
    );

    expect(migration).toContain('security invoker');
    expect(migration).toContain("integration.key in ('ai', 'apify', 'scheduler', 'whatsapp', 'zapi_webhook')");
    expect(migration).toContain("agent.active_version_id is not null");
    expect(migration).toContain("runtime.data -> 'killSwitchGlobal' = 'false'::jsonb");
    expect(migration).toContain("run.status in ('queued', 'running', 'awaiting_approval')");
    expect(migration).toContain("run.status in ('queued', 'awaiting_approval')");
    expect(migration).toContain('grant execute on function public.set_ana_automatic_operation');
    expect(migration).toContain('to service_role');
    expect(migration).toContain('from public, anon, authenticated');
  });
});

describe('WhatsApp provider connection-state migration', () => {
  it('does not turn an intentionally paused provider into a false connection error', () => {
    const migration = readFileSync(
      new URL('../migrations/20260927160000_preserve_whatsapp_connection_state_when_provider_paused.sql', import.meta.url),
      'utf8',
    );

    expect(migration).toContain("when new.connected then 'connected'");
    expect(migration).toContain("when new.last_error is not null then 'error'");
    expect(migration).not.toContain("when new.paused then 'error'");
    expect(migration).toContain("where a.integration_id = i.id");
  });
});

describe('WhatsApp account resolver migration', () => {
  it('qualifies resolver columns that collide with RETURNS TABLE output names', () => {
    const migration = readFileSync(
      new URL('../migrations/20260927193046_fix_whatsapp_account_resolver_ambiguity.sql', import.meta.url),
      'utf8',
    );

    expect(migration).toContain('wa.owner_user_id in (v_lead.assigned_to, v_lead.owner_id)');
    expect(migration).toContain("case when wa.connection_status = 'connected'");
    expect(migration).toContain('and wa.is_default');
    expect(migration).not.toMatch(/^\s+and owner_user_id is not null/m);
    expect(migration).not.toMatch(/^\s+case when connection_status =/m);
    expect(migration).not.toMatch(/^\s+and is_default\b/m);
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('to service_role');
  });
});

describe('Provider acceptance proposal projection migration', () => {
  it('orders outreach records by columns that exist on outreach_jobs', () => {
    const migration = readFileSync(
      new URL('../migrations/20260927195156_fix_proposal_delivery_outreach_ordering.sql', import.meta.url),
      'utf8',
    );

    expect(migration).toContain('order by j.run_at desc, j.id desc');
    expect(migration).not.toContain('j.created_at');
    expect(migration).toContain('if v_proposal_id is null then');
    expect(migration).toContain('return new;');
  });
});
