import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('WA-AKG first-access dialog', () => {
  it('keeps the CRM behind an accessible modal and identifies the seller instance', () => {
    const dialog = readFileSync(resolve('src/components/feature/WaAkgOnboardingDialog.tsx'), 'utf8');
    const panel = readFileSync(resolve('src/components/feature/WaAkgPanel.tsx'), 'utf8');

    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain('surface="onboarding"');
    expect(panel).toContain("surface === 'onboarding'");
    expect(panel).toContain('Instância');
    expect(panel).toContain('Preparar pareamento');
    expect(panel).toContain('onConnected');
  });
});
