import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createTeamMember, inviteTeamMember, loadTeamMembers, removeTeamMember, roleLabel, setTeamMemberStatus, updateTeamRole, type TeamMember, type TeamRole } from '@/lib/crm/teamMembersRepository';

const roles: TeamRole[] = ['administrador', 'vendedor', 'sdr', 'cx'];
const errors: Record<string, string> = {
  organization_access_denied: 'Seu usuário não possui permissão administrativa para gerenciar a equipe.',
  last_administrator_protected: 'A empresa precisa manter ao menos um administrador ativo.',
  invalid_member_email: 'Informe um e-mail válido.',
  member_invitation_failed: 'Não foi possível enviar o convite. Verifique o e-mail e tente novamente.',
  invalid_member_name: 'Informe o nome do novo membro.',
  invalid_member_password: 'Use uma senha com 8 a 128 caracteres.',
  member_email_already_registered: 'Este e-mail já possui uma conta. Use os controles da lista para ajustar seu acesso.',
  member_creation_failed: 'Não foi possível criar o acesso direto.',
  member_invite_conflict: 'Este e-mail possui um convite ativo para outra organização.',
  member_invitation_preparation_failed: 'Não foi possível preparar o vínculo com a Wayflex.',
  member_self_deletion_protected: 'Você não pode remover o próprio acesso por esta tela.',
  member_linked_to_another_organization: 'Este membro também pertence a outra organização e não pode ser excluído por esta tela.',
  member_identity_deletion_failed: 'Não foi possível remover a identidade deste membro.',
};

function errorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return errors[code] ?? 'A alteração não foi concluída. O estado anterior foi preservado.';
}

export default function TeamAccessTab() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'vendedor' as TeamRole });
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'administrador' as TeamRole });

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setMembers(await loadTeamMembers()); setError(''); }
    catch { setError('Não foi possível carregar os membros reais da empresa.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const changeRole = async (member: TeamMember, role: TeamRole) => {
    if (role === member.role) return;
    setBusy(member.userId);
    try { await updateTeamRole(member.userId, role); await refresh(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(null); }
  };
  const changeStatus = async (member: TeamMember) => {
    const enabled = member.status !== 'active';
    if (!window.confirm(enabled ? `Liberar o acesso de ${member.name}?` : `Bloquear o acesso de ${member.name}?`)) return;
    setBusy(member.userId);
    try { await setTeamMemberStatus(member.userId, enabled); await refresh(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(null); }
  };
  const remove = async (member: TeamMember) => {
    if (!window.confirm(`Remover ${member.name} da empresa? Essa pessoa perde o acesso imediatamente.`)) return;
    setBusy(member.userId);
    try { await removeTeamMember(member.userId); await refresh(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(null); }
  };
  const invite = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError('Preencha nome e e-mail antes de enviar o convite.'); return; }
    setBusy('invite');
    try { await inviteTeamMember({ name: form.name.trim(), email: form.email.trim(), role: form.role }); setInviteOpen(false); setForm({ name: '', email: '', role: 'vendedor' }); await refresh(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(null); }
  };
  const create = async () => {
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password) {
      setError('Preencha nome, e-mail e senha antes de criar o acesso.'); return;
    }
    setBusy('create');
    try {
      await createTeamMember({ ...createForm, name: createForm.name.trim(), email: createForm.email.trim() });
      setCreateOpen(false); setCreateForm({ name: '', email: '', password: '', role: 'administrador' }); await refresh();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(null); }
  };

  return <div className="space-y-5">
    {error && <div className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800">{error}</div>}
    <section className="wf-surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-background-200/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-700">Acessos reais</p><h2 className="mt-1 font-heading text-xl font-bold text-foreground-950">Equipe e responsáveis</h2><p className="mt-1 text-sm text-foreground-500">Convites, papéis e bloqueios são aplicados aos membros da organização.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setCreateOpen(true)} className="wf-btn-secondary"><i className="ri-user-add-line" />Criar acesso</button><button type="button" onClick={() => setInviteOpen(true)} className="wf-btn-primary"><i className="ri-mail-add-line" />Convidar membro</button></div></div>
      {loading ? <p className="px-5 py-10 text-sm text-foreground-500">Carregando equipe…</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-background-100/70 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground-500"><th className="px-5 py-3">Membro</th><th className="px-5 py-3">Papel</th><th className="px-5 py-3">Acesso</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody>{members.map((member) => <tr key={member.userId} className="border-t border-background-200/70"><td className="px-5 py-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">{member.name.charAt(0).toUpperCase()}</div><div><p className="font-semibold text-foreground-800">{member.name}</p><p className="text-xs text-foreground-500">{member.email}</p></div></div></td><td className="px-5 py-3"><select aria-label={`Papel de ${member.name}`} disabled={busy === member.userId} value={member.role} onChange={(event) => void changeRole(member, event.target.value as TeamRole)} className="rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-xs font-medium text-foreground-700 disabled:opacity-60">{roles.map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></td><td className="px-5 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${member.status === 'active' ? 'bg-primary-50 text-primary-800' : 'bg-background-100 text-foreground-600'}`}>{member.status === 'active' ? 'Ativo' : 'Bloqueado'}</span></td><td className="px-5 py-3"><div className="flex justify-end gap-2"><button type="button" disabled={busy === member.userId} onClick={() => void changeStatus(member)} className="wf-btn-secondary text-xs disabled:opacity-60">{member.status === 'active' ? 'Bloquear' : 'Liberar'}</button><button type="button" disabled={busy === member.userId} onClick={() => void remove(member)} className="rounded-xl px-3 py-2 text-xs font-semibold text-accent-700 hover:bg-accent-50 disabled:opacity-60">Remover</button></div></td></tr>)}</tbody></table>{members.length === 0 && <p className="px-5 py-10 text-sm text-foreground-500">Nenhum membro ativo nesta empresa.</p>}</div>}
    </section>
    {inviteOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={() => setInviteOpen(false)}><section className="w-full max-w-md rounded-2xl border border-background-200 bg-background-50 shadow-xl" onClick={(event) => event.stopPropagation()}><header className="flex items-center justify-between border-b border-background-200/70 px-5 py-4"><div><h3 className="font-heading font-bold text-foreground-950">Convidar membro</h3><p className="mt-0.5 text-xs text-foreground-500">O convite é enviado para o e-mail informado.</p></div><button type="button" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={() => setInviteOpen(false)} aria-label="Fechar"><i className="ri-close-line" /></button></header><div className="space-y-4 p-5"><Field label="Nome"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nome da pessoa" /></Field><Field label="E-mail"><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="email@empresa.com" /></Field><Field label="Papel"><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as TeamRole })}>{roles.map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></Field></div><footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={() => setInviteOpen(false)}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={busy === 'invite'} onClick={() => void invite()}>{busy === 'invite' ? 'Enviando…' : 'Enviar convite'}</button></footer></section></div>}
    {createOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={() => setCreateOpen(false)}><section className="w-full max-w-md rounded-2xl border border-background-200 bg-background-50 shadow-xl" onClick={(event) => event.stopPropagation()}><header className="flex items-center justify-between border-b border-background-200/70 px-5 py-4"><div><h3 className="font-heading font-bold text-foreground-950">Criar acesso</h3><p className="mt-0.5 text-xs text-foreground-500">O acesso é liberado diretamente nesta organização.</p></div><button type="button" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={() => setCreateOpen(false)} aria-label="Fechar"><i className="ri-close-line" /></button></header><div className="space-y-4 p-5"><Field label="Nome"><input value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} placeholder="Nome da pessoa" /></Field><Field label="E-mail"><input type="email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} placeholder="email@empresa.com" /></Field><Field label="Senha"><input type="password" autoComplete="new-password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} placeholder="Mínimo de 8 caracteres" /></Field><Field label="Papel"><select value={createForm.role} onChange={(event) => setCreateForm({ ...createForm, role: event.target.value as TeamRole })}>{roles.map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></Field></div><footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={() => setCreateOpen(false)}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={busy === 'create'} onClick={() => void create()}>{busy === 'create' ? 'Criando…' : 'Criar e liberar acesso'}</button></footer></section></div>}
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-semibold text-foreground-700"><span className="mb-1.5 block">{label}</span><span className="block [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-background-200 [&_input]:bg-background-100 [&_input]:px-3.5 [&_input]:py-2.5 [&_input]:text-sm [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-background-200 [&_select]:bg-background-100 [&_select]:px-3.5 [&_select]:py-2.5 [&_select]:text-sm">{children}</span></label>;
}
