import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../migrations/20261003223000_transfer_whatsapp_channel_with_assignee.sql', import.meta.url),
  'utf8',
);

describe('human handoff switches the outbound WhatsApp channel atomically', () => {
  it('requires the target seller account and validates every readiness gate', () => {
    expect(migration).toContain("account.account_type = 'seller'");
    expect(migration).toContain('account.owner_user_id = v_target_user_id');
    expect(migration).toContain("v_target_account.connection_status <> 'connected'");
    expect(migration).toContain('integration.connected');
    expect(migration).toContain('control.send_enabled');
    expect(migration).toContain('not control.kill_switch');
  });

  it('changes assignee, owner and account in the same RPC transaction', () => {
    expect(migration).toContain('assigned_to = v_target_user_id');
    expect(migration).toContain('owner_id = v_target_user_id');
    expect(migration).toContain('whatsapp_account_id = v_target_account.id');
    expect(migration).toContain("active_channel = 'whatsapp'");
    expect(migration).toContain('previous_whatsapp_account_id');
  });

  it('preserves old account identity without restoring it as the active channel', () => {
    expect(migration).toContain('lead_whatsapp_account_bindings');
    expect(migration).toContain("'account_history_identity'::text");
    expect(migration).toContain('l.whatsapp_account_id is distinct from p_account_id');
  });

  it('exposes only safe channel metadata to the transfer dialog', () => {
    expect(migration).toContain('central_list_transfer_targets');
    expect(migration).toContain('connected_phone_suffix');
    expect(migration).not.toMatch(/returns table[\s\S]{0,700}(token|secret|api_key)/i);
  });
});

describe('late inbound messages do not roll back the transferred channel', () => {
  const handlers = [
    '../functions/webhook-whatsapp/index.ts',
    '../functions/webhook-meta-whatsapp/index.ts',
    '../functions/evolution-go-worker/index.ts',
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));

  it.each(handlers)('guards the active account in every inbound handler', (source) => {
    expect(source).toContain("account_history_identity");
    expect(source).toMatch(/whatsapp_account_id\s*=/);
  });

  it('rejects customer-data persistence for a disabled Evolution account even when the shared provider is active', () => {
    const source = readFileSync(new URL('../functions/webhook-evolution-go/index.ts', import.meta.url), 'utf8');
    expect(source).toContain('account.enabled !== true');
    expect(source).toContain('integration.enabled !== true');
    expect(source).toContain('integration.connected !== true');
    expect(source).toContain('integration.paused === true');
    expect(source).toContain("reason: 'evolution_go_account_disabled'");
  });
});
