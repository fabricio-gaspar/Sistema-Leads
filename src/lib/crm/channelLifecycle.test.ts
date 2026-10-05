import { describe, expect, it, vi } from 'vitest';
import { assertChannelActionCompleted, channelLifecycleBlocked, channelLifecycleMessage, refreshAfterLifecycleError, type ChannelLifecycle } from './channelLifecycle';

const lifecycle = (state: ChannelLifecycle['state']): ChannelLifecycle => ({ state, revision: 2, desiredAction: 'connect', errorCode: null });

describe('channel lifecycle consumer contract', () => {
  it.each(['account_lifecycle_pending', 'account_lifecycle_needs_review', 'account_lifecycle_persistence_failed', 'wa_akg_connection_validation_required', 'evolution_go_connection_validation_required', 'Failed to fetch'])('reloads canonical status once after %s without repeating the action', async (code) => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    await refreshAfterLifecycleError(new Error(code), refresh);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('does not turn an unambiguous preflight denial into a lifecycle retry', async () => {
    const refresh = vi.fn();
    await refreshAfterLifecycleError(new Error('permission_denied'), refresh);
    expect(refresh).not.toHaveBeenCalled();
  });
  it.each(['pending', 'in_flight', 'needs_review', 'failed'] as const)('does not report %s as operational or return an old QR', (state) => {
    expect(channelLifecycleBlocked(lifecycle(state))).toBe(true);
    expect(channelLifecycleMessage(lifecycle(state))).toBeTruthy();
    expect(() => assertChannelActionCompleted('qr', lifecycle(state))).toThrow(/account_lifecycle_/);
    expect(() => assertChannelActionCompleted('activate', lifecycle(state))).toThrow(/account_lifecycle_/);
  });
  it.each(['idle', 'completed'] as const)('accepts a %s lifecycle', (state) => {
    expect(channelLifecycleBlocked(lifecycle(state))).toBe(false);
    expect(channelLifecycleMessage(lifecycle(state))).toBeNull();
    expect(() => assertChannelActionCompleted('connect', lifecycle(state))).not.toThrow();
  });
  it('permits read-only status while pending and supports the previous response format', () => {
    expect(() => assertChannelActionCompleted('my_account', lifecycle('pending'))).not.toThrow();
    expect(() => assertChannelActionCompleted('status', lifecycle('needs_review'))).not.toThrow();
    expect(() => assertChannelActionCompleted('list', lifecycle('in_flight'))).not.toThrow();
    expect(() => assertChannelActionCompleted('connect', undefined)).not.toThrow();
    expect(channelLifecycleBlocked(null)).toBe(false);
  });
});
