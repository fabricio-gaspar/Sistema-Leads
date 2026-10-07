import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Central de Atendimento > conexão Evolution GO', () => {
  it('solicita o layout individual próprio da Central sem abrir credenciais administrativas', () => {
    const page = readFileSync(resolve('src/pages/dashboard/atendimento/page.tsx'), 'utf8');
    const panel = readFileSync(resolve('src/components/feature/EvolutionGoPanel.tsx'), 'utf8');

    expect(page).toContain('<EvolutionGoPanel mode="self-service" surface="central" />');
    expect(panel).toContain("export type EvolutionGoPanelSurface = 'default' | 'central'");
    expect(panel).toContain('QR Code da minha instância');
    expect(panel).toContain('Status de validação');
    expect(panel).toContain('Como conectar seu WhatsApp');
    expect(panel).toContain('Dados da minha conexão');
    expect(panel).toContain('Seu acesso é individual. URL, chave global e token da instância ficam protegidos no servidor');
  });
});
