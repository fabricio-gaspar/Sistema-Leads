import { describe, expect, it } from 'vitest';
import { handoffErrorMessage } from './handoffsRepository';

describe('handoffErrorMessage', () => {
  it.each([
    ['handoff_target_whatsapp_account_required', 'não possui um canal de WhatsApp próprio'],
    ['handoff_target_whatsapp_account_not_ready', 'não está conectado'],
    ['handoff_target_whatsapp_integration_not_ready', 'pausada ou indisponível'],
    ['handoff_target_whatsapp_provider_not_ready', 'não está liberado para envio'],
    ['handoff_assignee_cannot_reply', 'não possui permissão'],
  ])('maps %s to an actionable operator message', (code, expected) => {
    expect(handoffErrorMessage({ message: `RPC failed: ${code}` })).toContain(expected);
  });

  it('does not expose an unknown backend detail', () => {
    expect(handoffErrorMessage({ message: 'sensitive_internal_detail' }))
      .toBe('Não foi possível concluir a transferência. Os dados atuais foram preservados.');
  });
});
