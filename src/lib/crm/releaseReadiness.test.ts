import { describe, expect, it } from 'vitest';
import { evaluateReleaseReadiness, type ReadinessInput } from './releaseReadiness';

const readyInput = (): ReadinessInput => ({
  channel: { provider: 'wa_akg', connected: true, inboundEnabled: true, sendEnabled: true, automationEnabled: true, killSwitch: false },
  ai: { configured: true, connected: true, lastTestedAt: '2026-10-12T10:00:00.000Z' },
  contactProtection: { enabled: true, syncConfirmed: true },
  queue: { idempotencyConfirmed: true, reconciliationConfirmed: true },
  environment: 'sandbox',
});

describe('evaluateReleaseReadiness', () => {
  it('approves a fully confirmed sandbox without external side effects', () => {
    const result = evaluateReleaseReadiness(readyInput());
    expect(result.ready).toBe(true);
    expect(Object.values(result.gates).every((gate) => gate.ok)).toBe(true);
  });

  it('blocks a legacy channel even when its connection appears healthy', () => {
    const input = readyInput();
    input.channel.provider = 'legacy';
    const result = evaluateReleaseReadiness(input);
    expect(result.ready).toBe(false);
    expect(result.gates.channel.ok).toBe(false);
  });

  it('blocks automation until contact protection and reconciliation are confirmed', () => {
    const input = readyInput();
    input.contactProtection.syncConfirmed = false;
    input.queue.reconciliationConfirmed = false;
    const result = evaluateReleaseReadiness(input);
    expect(result.ready).toBe(false);
    expect(result.gates.contact_protection.ok).toBe(false);
    expect(result.gates.queue.ok).toBe(false);
  });
});
