import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Meu WhatsApp WA-AKG', () => {
  it('preserves old links by redirecting the retired self-service route to the Central', () => {
    const page = readFileSync(resolve('src/pages/dashboard/meu-whatsapp/page.tsx'), 'utf8');
    const panel = readFileSync(resolve('src/components/feature/WaAkgPanel.tsx'), 'utf8');

    expect(page).toContain("import { Navigate } from 'react-router-dom'");
    expect(page).toContain('<Navigate to="/dashboard/atendimento" replace />');
    expect(panel).toContain('loadMyWaAkgAccount');
    expect(panel).toContain("mode === 'self-service'");
    expect(panel).toContain("'central-whatsapp-account'");
  });

  it('keeps connection, activation and Central access inside the seller workspace', () => {
    const panel = readFileSync(resolve('src/components/feature/WaAkgPanel.tsx'), 'utf8');

    expect(panel).toContain('Habilitar conta');
    expect(panel).toContain("runWaAkgAction('activate', selected.account.id)");
    expect(panel).toContain('Os controles administrativos de envio e da Ana permanecem separados.');
    expect(panel).toContain('Operação automática segura');
    expect(panel).toContain('Abrir Central de Atendimento');
    expect(panel).toContain('to="/dashboard/atendimento"');
    expect(panel).toContain("!inCentral && <Link to=\"/dashboard/atendimento\"");
    expect(panel).toContain('autoQr');
    expect(panel).toContain('void loadQr()');
    expect(panel).toContain("runWaAkgAction('refresh_status', accountId)");
    expect(panel).toContain("navigate('/dashboard/atendimento', { replace: true })");
    expect(panel).toContain('WhatsApp conectado. Abrindo a Central de Atendimento…');
  });

  it('keeps an unconfirmed reload distinct from an operational or protected channel', () => {
    const panel = readFileSync(resolve('src/components/feature/WaAkgPanel.tsx'), 'utf8');
    expect(panel).toContain("label: 'Estado não confirmado'");
    expect(panel).toContain("statusUnconfirmed ? 'Não confirmado'");
    expect(panel).toContain('await refreshAfterLifecycleError(error, refresh)');
    expect(panel).toContain('isWaAkgOperational(next) && !redirecting.current');
  });
});
