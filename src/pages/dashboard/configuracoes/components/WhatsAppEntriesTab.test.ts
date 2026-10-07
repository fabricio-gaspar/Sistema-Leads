import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Configurações > Canais', () => {
  it('expõe somente o Evolution GO e mantém o aviso de preservação histórica', () => {
    const source = readFileSync(resolve('src/pages/dashboard/configuracoes/components/WhatsAppEntriesTab.tsx'), 'utf8');

    expect(source).toContain("import EvolutionGoPanel from '@/components/feature/EvolutionGoPanel'");
    expect(source).toContain('<EvolutionGoPanel />');
    expect(source).toContain('Canal exclusivo');
    expect(source).toContain('registros históricos permanecem preservados');
    expect(source).not.toContain('WhatsappProviderControlPanel');
    expect(source).not.toContain('WaAkgPanel');
    expect(source).not.toContain('WhatsappAccountPanel');
    expect(source).not.toContain('Entrada do site');
    expect(source).not.toContain('Contingência e migração');
  });

  it('mantém o servidor Evolution GO somente em Canais, sem duplicá-lo em Usuários', () => {
    const usersSource = readFileSync(resolve('src/pages/dashboard/configuracoes/components/UsersAccessWorkspace.tsx'), 'utf8');

    expect(usersSource).not.toContain('EvolutionGoPanel');
    expect(usersSource).toContain('Equipe e acessos');
  });
});
