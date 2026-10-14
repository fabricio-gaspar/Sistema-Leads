import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from } }));
vi.mock('@/lib/crm/whatsappAccountsRepository', () => ({ runWaAkgAction: vi.fn() }));

describe('WA-AKG contact decision RPC boundary', () => {
  beforeEach(() => { rpc.mockReset(); from.mockReset(); });

  it('loads the next pending contact only from the server authority', async () => {
    const { loadPendingWaAkgContactDecision } = await import('./waAkgContactDirectoryRepository');
    rpc.mockResolvedValue({ data: [{
      lead_id: 'lead-1', account_id: 'account-1', phone: '5511999999999', name: 'Carlos', state: 'agenda_protected',
      message_id: 'message-1', latest_inbound_text: 'Olá', decision_revision: 7, can_enable_ai: false,
    }], error: null });

    await expect(loadPendingWaAkgContactDecision()).resolves.toEqual({
      leadId: 'lead-1', accountId: 'account-1', phone: '5511999999999', name: 'Carlos', state: 'agenda_protected',
      messageId: 'message-1', latestInboundText: 'Olá', decisionRevision: 7, canEnableAi: false,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('central_get_pending_wa_akg_contact_decision');
    expect(from).not.toHaveBeenCalled();
  });

  it('persists a dismissal on the server instead of hiding the prompt locally', async () => {
    const { dismissWaAkgContactDecisionPrompt } = await import('./waAkgContactDirectoryRepository');
    rpc.mockResolvedValue({ data: { dismissed: true }, error: null });

    await expect(dismissWaAkgContactDecisionPrompt({ accountId: 'account-1', phone: '5511999999999', messageId: 'message-1' })).resolves.toEqual({ dismissed: true });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('central_dismiss_wa_akg_contact_decision_prompt', {
      p_account_id: 'account-1', p_phone: '5511999999999', p_message_id: 'message-1',
    });
  });

  it('requires owner and explicit mode when promoting and carries the idempotency key', async () => {
    const { decideWaAkgContactV2 } = await import('./waAkgContactDirectoryRepository');
    rpc.mockResolvedValue({ data: { lead_id: 'lead-1', state: 'lead_authorized', decision_revision: 8 }, error: null });

    await decideWaAkgContactV2({
      accountId: 'account-1', phone: '5511999999999', decision: 'promote', ownerUserId: 'owner-1',
      initialMode: 'human', expectedRevision: 7, requestId: 'request-1',
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('decide_wa_akg_contact_v2', {
      p_account_id: 'account-1', p_phone: '5511999999999', p_decision: 'promote', p_owner_user_id: 'owner-1',
      p_initial_mode: 'humano', p_expected_revision: 7, p_request_id: 'request-1',
    });
  });

  it('maps the Central human/Ana choices to the database contract', async () => {
    const { decideWaAkgContactV2 } = await import('./waAkgContactDirectoryRepository');
    rpc.mockResolvedValue({ data: { lead_id: 'lead-1', state: 'lead_authorized', decision_revision: 8 }, error: null });

    await decideWaAkgContactV2({
      accountId: 'account-1', phone: '5511999999999', decision: 'promote', ownerUserId: 'owner-1',
      initialMode: 'ana', expectedRevision: 7, requestId: 'request-ana',
    });

    expect(rpc).toHaveBeenCalledExactlyOnceWith('decide_wa_akg_contact_v2', {
      p_account_id: 'account-1', p_phone: '5511999999999', p_decision: 'promote', p_owner_user_id: 'owner-1',
      p_initial_mode: 'ia', p_expected_revision: 7, p_request_id: 'request-ana',
    });
  });

  it('rejects a promotion without an owner before it can reach the server', async () => {
    const { decideWaAkgContactV2 } = await import('./waAkgContactDirectoryRepository');

    await expect(decideWaAkgContactV2({
      accountId: 'account-1', phone: '5511999999999', decision: 'promote', initialMode: 'human', expectedRevision: 7, requestId: 'request-2',
    })).rejects.toThrow('wa_akg_contact_decision_owner_and_mode_required');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('keeps the protected decision server-side with a revision and idempotency key', async () => {
    const { decideWaAkgContactV2 } = await import('./waAkgContactDirectoryRepository');
    rpc.mockResolvedValue({ data: { lead_id: 'lead-1', state: 'agenda_protected', decision_revision: 8 }, error: null });

    await expect(decideWaAkgContactV2({
      accountId: 'account-1', phone: '5511999999999', decision: 'keep', expectedRevision: 7, requestId: 'request-3',
    })).resolves.toEqual({ leadId: 'lead-1', state: 'agenda_protected', decisionRevision: 8 });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('decide_wa_akg_contact_v2', {
      p_account_id: 'account-1', p_phone: '5511999999999', p_decision: 'keep', p_owner_user_id: null,
      p_initial_mode: 'humano', p_expected_revision: 7, p_request_id: 'request-3',
    });
  });

  it('does not expose the revoked legacy decision RPC to new interface code', async () => {
    const repository = await import('./waAkgContactDirectoryRepository');

    expect('decideWaAkgContact' in repository).toBe(false);
  });
});
