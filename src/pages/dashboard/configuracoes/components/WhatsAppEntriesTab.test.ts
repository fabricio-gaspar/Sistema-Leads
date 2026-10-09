import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Configurações > Canais', () => {
  it('expõe WA-AKG como canal protegido e mantém a ativação explicitamente separada', () => {
    const source = readFileSync(resolve('src/pages/dashboard/configuracoes/components/WhatsAppEntriesTab.tsx'), 'utf8');

    expect(source).toContain("import WaAkgPanel from '@/components/feature/WaAkgPanel'");
    expect(source).toContain('<WaAkgPanel />');
    expect(source).toContain('Canal protegido');
    expect(source).toContain('não inicia WhatsApp nem libera mensagens');
    expect(source).not.toContain('WhatsappProviderControlPanel');
    expect(source).not.toContain('WhatsappAccountPanel');
    expect(source).not.toContain('Entrada do site');
    expect(source).not.toContain('Contingência e migração');
  });

  it('mantém o WA-AKG separado do gerenciamento de usuários', () => {
    const usersSource = readFileSync(resolve('src/pages/dashboard/configuracoes/components/UsersAccessWorkspace.tsx'), 'utf8');

    expect(usersSource).toContain('Equipe e acessos');
  });
});
