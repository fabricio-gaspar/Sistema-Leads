import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Central de Atendimento > conexão WA-AKG', () => {
  it('solicita o layout individual próprio da Central sem abrir credenciais administrativas', () => {
    const page = readFileSync(resolve('src/pages/dashboard/atendimento/page.tsx'), 'utf8');
    const panel = readFileSync(resolve('src/components/feature/WaAkgPanel.tsx'), 'utf8');

    expect(page).toContain('<WaAkgPanel mode="self-service" surface="central" />');
    expect(panel).toContain("type Surface = 'whatsapp' | 'central'");
    expect(panel).toContain('Conectar o telefone');
    expect(panel).toContain('Gerar novo QR');
    expect(panel).toContain("!selected.canViewQr || channelLifecycleBlocked(selected.lifecycle)");
    expect(panel).toContain('Operação automática segura');
    expect(panel).toContain('A URL e a chave ficam somente no cofre do backend');
  });
});
