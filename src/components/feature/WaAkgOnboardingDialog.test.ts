import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('WA-AKG first-access dialog', () => {
  it('keeps the CRM behind an accessible modal without exposing technical instance keys', () => {
    const dialog = readFileSync(resolve('src/components/feature/WaAkgOnboardingDialog.tsx'), 'utf8');
    const panel = readFileSync(resolve('src/components/feature/WaAkgPanel.tsx'), 'utf8');

    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain('aria-hidden');
    expect(dialog).toContain("setAttribute('inert', '')");
    expect(dialog).toContain("event.key !== 'Tab'");
    expect(dialog).toContain('surface="onboarding"');
    expect(panel).toContain("surface === 'onboarding'");
    expect(panel).toContain('Conexão do seu dispositivo');
    expect(panel).not.toContain('Instância do usuário');
    expect(panel).not.toContain('instanceName');
    expect(panel).toContain('Preparar pareamento');
    expect(panel).toContain('onConnected');
    expect(panel).toContain('qrRequestInFlight');
    expect(panel).toContain('runtimeRefreshInFlight');
  });
});
