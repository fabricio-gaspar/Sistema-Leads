import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: invokeMock },
  },
}));

vi.mock('@/lib/transportador', () => ({
  detalheDoErroDeFuncao: vi.fn().mockResolvedValue('transport_error'),
}));

vi.mock('@/lib/organizationSession', () => ({
  resolveOrganizationSession: vi.fn(),
}));

import {
  createEvolutionGoAccount,
  createEvolutionGoInstance,
  loadEvolutionGoAccounts,
  loadMyEvolutionGoAccount,
  requestEvolutionGoPairingCode,
  requestEvolutionGoQr,
  runEvolutionGoAction,
  saveEvolutionGoConfiguration,
  loadMyWaAkgAccount,
  requestWaAkgQr,
  runWaAkgAction,
} from './whatsappAccountsRepository';

const accountId = '11111111-1111-4111-8111-111111111111';
const ownerUserId = '22222222-2222-4222-8222-222222222222';

function ok(data: Record<string, unknown> = {}) {
  invokeMock.mockResolvedValueOnce({ data: { ok: true, ...data }, error: null });
}

describe('Evolution GO multi-account repository', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['WA-AKG activate', () => runWaAkgAction('activate', accountId)],
    ['Evolution activate', () => runEvolutionGoAction('activate', accountId)],
    ['WA-AKG QR', () => requestWaAkgQr(accountId)],
    ['Evolution QR', () => requestEvolutionGoQr(accountId)],
  ])('does not mistake a pending acknowledgement for successful %s', async (_label, call) => {
    ok({ lifecycle: { state: 'pending', revision: 2, desiredAction: 'activate', errorCode: null } });
    await expect(call()).rejects.toThrow('account_lifecycle_pending');
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it('allows read-only inspection of a pending WA-AKG account', async () => {
    ok({ account: null, lifecycle: { state: 'pending', revision: 2, desiredAction: 'connect', errorCode: null } });
    await expect(loadMyWaAkgAccount()).resolves.toMatchObject({ lifecycle: { state: 'pending' } });
  });

  it.each([
    ['WA-AKG', () => runWaAkgAction('connect', accountId)],
    ['Evolution', () => runEvolutionGoAction('connect', accountId)],
  ])('surfaces a %s HTTP 409 lifecycle code without inventing success or consuming the response', async (_label, call) => {
    const context = new Response(JSON.stringify({ ok: false, error: 'account_lifecycle_needs_review' }), { status: 409 });
    invokeMock.mockResolvedValueOnce({ data: null, error: { context } });
    await expect(call()).rejects.toThrow('account_lifecycle_needs_review');
    expect(context.bodyUsed).toBe(false);
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it('loads the authorized collection without requesting secrets or QR data', async () => {
    ok({ accounts: [], canManage: false });

    await expect(loadEvolutionGoAccounts()).resolves.toEqual(expect.objectContaining({ accounts: [], canManage: false }));
    expect(invokeMock).toHaveBeenCalledWith('evolution-go', { body: { action: 'list' } });
  });

  it('loads the self-service account without accepting an account id or requesting secrets', async () => {
    ok({ configured: false, account: null, integration: null, controls: null, canManage: false, canConnect: false, canViewQr: false });

    await expect(loadMyEvolutionGoAccount()).resolves.toMatchObject({ account: null, canManage: false });
    expect(invokeMock).toHaveBeenCalledWith('evolution-go', { body: { action: 'my_account' } });
    const body = invokeMock.mock.calls[0]?.[1]?.body;
    expect(body).not.toHaveProperty('account_id');
    expect(body).not.toHaveProperty('global_api_key');
    expect(body).not.toHaveProperty('instance_token');
  });

  it('creates a seller account with a client-generated id and explicit owner', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(accountId);
    ok({ configured: false, account: { id: accountId } });

    await createEvolutionGoAccount({ accountType: 'seller', ownerUserId, label: 'WhatsApp da Ana' });

    const body = invokeMock.mock.calls[0]?.[1]?.body;
    expect(body).toEqual({
      action: 'create_account',
      account_id: accountId,
      account_type: 'seller',
      owner_user_id: ownerUserId,
      label: 'WhatsApp da Ana',
    });
    expect(body).not.toHaveProperty('global_api_key');
    expect(body).not.toHaveProperty('instance_token');
    expect(body).not.toHaveProperty('base_url');
  });

  it('forces a corporate account to have no owner', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(accountId);
    ok({ configured: false, account: { id: accountId } });

    await createEvolutionGoAccount({ accountType: 'corporate', ownerUserId, label: 'WhatsApp corporativo' });

    expect(invokeMock.mock.calls[0]?.[1]?.body).toEqual(expect.objectContaining({
      account_type: 'corporate',
      owner_user_id: null,
    }));
  });

  it('scopes every operational and pairing action to the selected account', async () => {
    ok();
    await runEvolutionGoAction('refresh_status', accountId);
    ok({ qr: { qrcode: null, code: null, expiresAt: null } });
    await requestEvolutionGoQr(accountId);
    ok({ pairingCode: '12345678' });
    await requestEvolutionGoPairingCode(accountId, '5511999999999');

    expect(invokeMock.mock.calls.map((call) => call[1].body)).toEqual([
      { action: 'refresh_status', account_id: accountId },
      { action: 'qr', account_id: accountId },
      { action: 'pair', account_id: accountId, phone: '5511999999999' },
    ]);
  });

  it('requests server-side provisioning without sending provider credentials', async () => {
    ok();

    await createEvolutionGoInstance(accountId, { label: 'WhatsApp corporativo' });

    const body = invokeMock.mock.calls[0]?.[1]?.body;
    expect(body).toEqual(expect.objectContaining({
      action: 'create_instance',
      account_id: accountId,
      label: 'WhatsApp corporativo',
    }));
    expect(body).not.toHaveProperty('global_api_key');
    expect(body).not.toHaveProperty('instance_token');
    expect(body).not.toHaveProperty('base_url');
    expect(body).not.toHaveProperty('instance_id');
  });

  it('forwards blind configuration fields only to the selected account', async () => {
    ok();

    await saveEvolutionGoConfiguration(accountId, {
      label: 'WhatsApp da Ana',
      baseUrl: 'https://evolution.example.test',
      globalApiKey: 'global-secret',
      instanceToken: 'instance-secret',
      instanceName: 'ana-sales',
      instanceId: 'instance-id',
    });

    expect(invokeMock.mock.calls[0]?.[1]?.body).toEqual({
      action: 'save',
      account_id: accountId,
      label: 'WhatsApp da Ana',
      base_url: 'https://evolution.example.test',
      global_api_key: 'global-secret',
      instance_token: 'instance-secret',
      instance_name: 'ana-sales',
      instance_id: 'instance-id',
    });
  });
});
