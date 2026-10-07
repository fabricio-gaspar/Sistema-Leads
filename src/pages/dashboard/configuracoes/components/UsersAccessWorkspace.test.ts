import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Configurações > Usuários', () => {
  const source = readFileSync(resolve('src/pages/dashboard/configuracoes/components/UsersAccessWorkspace.tsx'), 'utf8');

  it('mostra cadastro direto com papel e senha temporária, sem fluxo administrativo de convites', () => {
    expect(source).toContain('Criar usuário');
    expect(source).toContain('Senha temporária');
    expect(source).toContain('Confirmar senha');
    expect(source).toContain('createTeamMember({ name: createForm.name.trim(), email: createForm.email.trim(), password: createForm.password, role: createForm.role })');
    expect(source).not.toContain("['invites', 'Convites'");
    expect(source).not.toContain('loadOrganizationInvites()');
    expect(source).not.toContain('resendOrganizationInvite(');
  });
});
