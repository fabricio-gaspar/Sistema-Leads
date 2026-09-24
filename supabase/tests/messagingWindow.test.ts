import { describe, expect, it } from 'vitest';
import { metaServiceWindow, requiresApprovedTemplate } from '../functions/_shared/messaging/messagingWindow.ts';

describe('Meta service window', () => {
  it('keeps free-form messaging open for exactly 24 hours after the latest customer message', () => {
    const state = metaServiceWindow('2026-09-24T10:00:00.000Z', new Date('2026-09-25T09:59:59.999Z'));
    expect(state).toMatchObject({ isOpen: true, expiresAt: '2026-09-25T10:00:00.000Z', remainingMs: 1 });
    expect(requiresApprovedTemplate('2026-09-24T10:00:00.000Z', new Date('2026-09-25T10:00:00.000Z'))).toBe(true);
  });

  it('fails closed when no reliable customer timestamp exists', () => {
    expect(metaServiceWindow(null)).toEqual({ isOpen: false, openedAt: null, expiresAt: null, remainingMs: 0 });
    expect(metaServiceWindow('invalid')).toEqual({ isOpen: false, openedAt: null, expiresAt: null, remainingMs: 0 });
  });
});

