import { describe, expect, it } from 'vitest';
import { deliveryLabel, deliveryStatusFromQueue } from './deliveryStatus';

describe('delivery status projection', () => {
  it('maps queue lifecycle to the message delivery states used by the Central', () => {
    expect(deliveryStatusFromQueue('queued')).toBe('queued');
    expect(deliveryStatusFromQueue('processing')).toBe('queued');
    expect(deliveryStatusFromQueue('retry')).toBe('queued');
    expect(deliveryStatusFromQueue('processed')).toBe('sent');
    expect(deliveryStatusFromQueue('failed')).toBe('failed');
    expect(deliveryStatusFromQueue('cancelled')).toBeNull();
  });

  it('keeps the user-facing distinction between queued and provider acceptance', () => {
    expect(deliveryLabel('queued')).toBe('Na fila');
    expect(deliveryLabel('sent')).toBe('Aceita pelo canal');
    expect(deliveryLabel(null)).toBe('Registrada');
  });
});
