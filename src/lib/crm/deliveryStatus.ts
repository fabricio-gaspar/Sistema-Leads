export type QueueDeliveryStatus = 'queued' | 'processing' | 'processed' | 'failed' | 'retry' | 'cancelled' | null | undefined;

export function deliveryStatusFromQueue(status: QueueDeliveryStatus): string | null {
  switch (status) {
    case 'queued':
    case 'processing':
    case 'retry':
      return 'queued';
    case 'processed':
      return 'sent';
    case 'failed':
      return 'failed';
    default:
      return null;
  }
}

export function deliveryLabel(value: string | null | undefined): string {
  return ({
    queued: 'Na fila',
    pending: 'Na fila',
    sent: 'Aceita pelo canal',
    delivered: 'Entregue',
    read: 'Lida',
    failed: 'Falhou',
    reconciliation_required: 'Em reconciliação',
    received: 'Recebida',
    text: 'Registrada',
  } as Record<string, string>)[value ?? ''] ?? 'Registrada';
}
