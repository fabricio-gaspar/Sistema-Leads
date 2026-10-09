import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadMyWaAkgAccount, requestWaAkgQr, reviewChannelLifecycle, runWaAkgAction, unlinkWaAkgDevice } from './whatsappAccountsRepository';
import { sessionContext } from '@/lib/sessionContext';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: invokeMock } } }));
vi.mock('@/lib/transportador', () => ({ detalheDoErroDeFuncao: vi.fn().mockResolvedValue('transport_error') }));

const accountId = '11111111-1111-4111-8111-111111111111';
const ownerUserId = '22222222-2222-4222-8222-222222222222';
const diagnosis = { lifecycle: { state: 'needs_review', revision: 7, desiredAction: 'activate', errorCode: null }, recovery: { eligible: true, reason: 'read_only', observedConnected: true, observedAt: null, requiresAdmin: true, retainsLocalCutoff: true } };

describe('WA-AKG channel repository', () => {
  beforeEach(() => { invokeMock.mockReset(); sessionContext.replace(ownerUserId, accountId); });
  afterEach(() => { sessionContext.replace(null); vi.restoreAllMocks(); });

  it('diagnoses only the WA-AKG lifecycle without connect, QR or activation', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, ...diagnosis }, error: null });
    await expect(reviewChannelLifecycle('wa_akg', accountId)).resolves.toMatchObject(diagnosis);
    expect(invokeMock).toHaveBeenCalledExactlyOnceWith('wa-akg', { body: { action: 'lifecycle_diagnose', account_id: accountId } });
  });

  it('requires a confirmed reconciliation response', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, ...diagnosis }, error: null });
    await expect(reviewChannelLifecycle('wa_akg', accountId, { expectedRevision: 7, reason: 'Consulta revisada' })).rejects.toThrow('lifecycle_recovery_unconfirmed');
  });

  it('keeps a pending account read-only', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, account: null, lifecycle: { state: 'pending', revision: 2, desiredAction: 'connect', errorCode: null } }, error: null });
    await expect(loadMyWaAkgAccount()).resolves.toMatchObject({ lifecycle: { state: 'pending' } });
  });

  it.each([
    ['activate', () => runWaAkgAction('activate', accountId)],
    ['QR', () => requestWaAkgQr(accountId)],
  ])('does not mistake a pending acknowledgement for successful %s', async (_label, call) => {
    invokeMock.mockResolvedValue({ data: { ok: true, lifecycle: { state: 'pending', revision: 2, desiredAction: 'activate', errorCode: null } }, error: null });
    await expect(call()).rejects.toThrow('account_lifecycle_pending');
  });

  it('does not retry a lifecycle network failure', async () => {
    invokeMock.mockRejectedValue(new Error('Failed to fetch'));
    await expect(reviewChannelLifecycle('wa_akg', accountId)).rejects.toThrow('Failed to fetch');
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it('requests a device-only logout without starting QR, pairing or activation', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, account: null, lifecycle: { state: 'completed', revision: 3, desiredAction: 'logout', errorCode: null } }, error: null });
    await unlinkWaAkgDevice(accountId);
    expect(invokeMock).toHaveBeenCalledExactlyOnceWith('wa-akg', { body: { action: 'logout', account_id: accountId } });
  });
});
