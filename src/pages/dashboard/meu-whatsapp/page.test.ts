import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Meu WhatsApp Evolution GO', () => {
  it('preserves old links by redirecting the retired self-service route to the Central', () => {
    const page = readFileSync(resolve('src/pages/dashboard/meu-whatsapp/page.tsx'), 'utf8');
    const panel = readFileSync(resolve('src/components/feature/EvolutionGoPanel.tsx'), 'utf8');

    expect(page).toContain("import { Navigate } from 'react-router-dom'");
    expect(page).toContain('<Navigate to="/dashboard/atendimento" replace />');
    expect(panel).toContain('loadMyEvolutionGoAccount');
    expect(panel).toContain("mode === 'self-service'");
    expect(panel).toContain("'my-evolution-go-account'");
  });

  it('keeps connection, activation and Central access inside the seller workspace', () => {
    const panel = readFileSync(resolve('src/components/feature/EvolutionGoPanel.tsx'), 'utf8');

    expect(panel).toContain('Habilitar minha conta');
    expect(panel).toContain("action('activate'");
    expect(panel).toContain('Os controles administrativos de recebimento, envio e Ana não foram alterados.');
    expect(panel).toContain('isEvolutionGoAutomationReady(selected)');
    expect(panel).toContain('Abrir Central de Atendimento');
    expect(panel).toContain('to="/dashboard/atendimento"');
    expect(panel).toContain('autoQrRequest');
    expect(panel).toContain('void loadQr()');
    expect(panel).toContain("action('refresh_status'");
  });

  it('keeps an unconfirmed reload distinct from an operational or protected channel', () => {
    const panel = readFileSync(resolve('src/components/feature/EvolutionGoPanel.tsx'), 'utf8');
    expect(panel).toContain("label: 'Estado não confirmado'");
    expect(panel).toContain("statusUnconfirmed ? 'Não confirmado'");
    expect(panel).toContain('await refreshAfterLifecycleError(error, () => refresh(false))');
    expect(panel).toContain('isEvolutionGoOperational(selected)');
  });
});
