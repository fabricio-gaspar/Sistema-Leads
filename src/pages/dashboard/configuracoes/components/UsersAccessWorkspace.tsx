import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cancelOrganizationInvite,
  defaultAccessSecurityPolicy,
  createTeamMember,
  loadAccessSecurityPolicy,
  loadOrganizationInvites,
  loadTeamAccessAudit,
  loadTeamMemberPermissions,
  loadTeamMembers,
  removeTeamMember,
  resetTeamMemberPassword,
  resendOrganizationInvite,
  roleLabel,
  saveAccessSecurityPolicy,
  saveTeamMemberPermissions,
  setTeamMemberStatus,
  teamPermissionLabel,
  teamPermissions,
  updateTeamMemberProfile,
  updateTeamRole,
  type AccessAuditEvent,
  type AccessSecurityPolicy,
  type OrganizationInvite,
  type TeamMember,
  type TeamPermission,
  type TeamRole,
} from '@/lib/crm/teamMembersRepository';

type Section = 'members' | 'roles' | 'invites' | 'history';
type Filter = 'all' | 'active' | 'invites' | 'disabled';

const roles: TeamRole[] = ['administrador', 'vendedor', 'sdr', 'cx'];
const roleDescriptions: Record<TeamRole, string> = {
  administrador: 'Acesso total à operação, equipe e configurações.',
  vendedor: 'Vende, cria orçamentos e acompanha leads.',
  sdr: 'Pesquisa, qualifica e movimenta oportunidades.',
  cx: 'Atende conversas e acompanha a carteira atribuída.',
};
const roleScope: Record<TeamRole, string> = {
  administrador: 'Acesso total', vendedor: 'Leads e orçamentos', sdr: 'Prospecção e leads', cx: 'Conversas atribuídas',
};
const rolePermissionPreview: Record<TeamRole, Set<TeamPermission>> = {
  administrador: new Set(teamPermissions),
  vendedor: new Set(['leads.read_assigned', 'leads.create', 'leads.edit_assigned', 'conversations.read_assigned', 'conversations.reply_assigned', 'proposals.manage', 'channels.view_own', 'channels.connect_own'] as TeamPermission[]),
  sdr: new Set(['leads.read_all', 'leads.create', 'leads.edit_assigned', 'conversations.read_assigned', 'conversations.reply_assigned', 'prospecting.manage'] as TeamPermission[]),
  cx: new Set(['leads.read_assigned', 'conversations.read_assigned', 'conversations.reply_assigned', 'channels.view_own'] as TeamPermission[]),
};

const errorCopy: Record<string, string> = {
  last_administrator_protected: 'A empresa precisa manter ao menos um administrador ativo.',
  member_self_deletion_protected: 'Seu próprio acesso não pode ser removido por esta tela.',
  member_sessions_revoke_failed: 'O acesso foi preservado porque as sessões não puderam ser revogadas.',
  member_storage_list_failed: 'Não foi possível localizar os arquivos privados da conta para exclusão segura.',
  member_storage_delete_failed: 'Não foi possível apagar os arquivos privados da conta pelo serviço de armazenamento.',
  member_email_already_registered: 'Este e-mail já possui uma conta. Use outro endereço.',
  member_profile_not_found: 'O cadastro deste usuário não foi localizado.',
  member_profile_update_failed: 'Não foi possível atualizar o cadastro. Nenhuma alteração parcial foi mantida.',
  member_password_reset_failed: 'Não foi possível trocar a senha temporária.',
  member_password_reset_session_revoke_failed: 'A nova senha foi registrada, mas não foi possível encerrar as sessões anteriores.',
  member_linked_to_another_organization: 'Esta conta pertence a outra organização e não pode ser apagada por aqui.',
  member_identity_deletion_failed: 'Não foi possível excluir a conta definitivamente.',
  invite_already_accepted: 'Este convite já foi aceito e não pode ser alterado.',
  invite_not_found: 'Convite não encontrado ou já cancelado.',
  security_policy_required: 'A política de segurança está incompleta.',
};

function messageFor(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  return errorCopy[code] ?? 'A alteração não foi concluída. O estado anterior foi preservado.';
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Ainda não registrado';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function Switch({ label, enabled, disabled, onChange }: { label: string; enabled: boolean; disabled?: boolean; onChange: () => void }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={enabled} disabled={disabled} onClick={onChange} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${enabled ? 'bg-primary-600' : 'bg-background-300'} ${disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}><span className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} /></button>;
}

function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'good' | 'warn' | 'danger' | 'neutral' }) {
  const classes = { good: 'bg-secondary-50 text-secondary-800', warn: 'bg-amber-50 text-amber-800', danger: 'bg-accent-50 text-accent-800', neutral: 'bg-background-100 text-foreground-600' }[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${classes}`}><i className="ri-circle-fill text-[7px]" aria-hidden="true" />{children}</span>;
}

export default function UsersAccessWorkspace() {
  const [section, setSection] = useState<Section>('members');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [audit, setAudit] = useState<AccessAuditEvent[]>([]);
  const [policy, setPolicy] = useState<AccessSecurityPolicy>(defaultAccessSecurityPolicy);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', password: '', role: 'vendedor' as TeamRole });
  const [pendingRole, setPendingRole] = useState<{ member: TeamMember; next: TeamRole } | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [passwordMember, setPasswordMember] = useState<TeamMember | null>(null);
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' });
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null);
  const [removeConfirmation, setRemoveConfirmation] = useState('');
  const [permissionMember, setPermissionMember] = useState<TeamMember | null>(null);
  const [memberPermissions, setMemberPermissions] = useState<Record<TeamPermission, boolean> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [nextMembers, nextInvites, nextPolicy, nextAudit] = await Promise.all([loadTeamMembers(), loadOrganizationInvites(), loadAccessSecurityPolicy(), loadTeamAccessAudit()]);
      setMembers(nextMembers); setInvites(nextInvites); setPolicy(nextPolicy); setAudit(nextAudit);
    } catch (cause) { setError(messageFor(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const visibleMembers = useMemo(() => members.filter((member) => {
    const matchesQuery = !query.trim() || `${member.name} ${member.email}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'active' && member.status === 'active') || (filter === 'disabled' && member.status === 'disabled') || (filter === 'invites' && member.status === 'invited');
    return matchesQuery && matchesFilter;
  }), [filter, members, query]);
  const attentionCount = invites.filter((invite) => !invite.acceptedAt && !invite.cancelledAt).length > 0 ? 1 : 0;

  const run = async (key: string, operation: () => Promise<void>, success: string) => {
    setBusy(key); setError('');
    try { await operation(); setNotice(success); await refresh(); }
    catch (cause) { setError(messageFor(cause)); }
    finally { setBusy(null); }
  };
  const changeStatus = (member: TeamMember) => {
    const enabled = member.status !== 'active';
    if (!enabled && !window.confirm(`Desativar o acesso de ${member.name}? Isso bloqueia CRM, canais, Ana e novas sessões. O histórico, leads e autoria serão preservados.${policy.revokeSessionsOnDisable ? ' As sessões atuais também serão revogadas.' : ''}`)) return;
    if (enabled && !window.confirm(`Reativar o acesso de ${member.name}?`)) return;
    void run(`status:${member.userId}`, () => setTeamMemberStatus(member.userId, enabled), enabled ? 'Acesso reativado e auditado.' : 'Acesso desativado; histórico preservado.');
  };
  const confirmRole = () => {
    if (!pendingRole) return;
    const { member, next } = pendingRole;
    setPendingRole(null);
    void run(`role:${member.userId}`, () => updateTeamRole(member.userId, next), `Papel de ${member.name} atualizado para ${roleLabel[next]}.`);
  };
  const createAccess = () => {
    if (!inviteForm.name.trim() || !/^\S+@\S+\.\S+$/.test(inviteForm.email.trim())) { setError('Informe nome e e-mail corporativo válidos.'); return; }
    if (inviteForm.password.length < 8) { setError('Defina uma senha temporária com ao menos 8 caracteres.'); return; }
    void run('create', async () => {
      await createTeamMember({ name: inviteForm.name.trim(), email: inviteForm.email.trim(), password: inviteForm.password, role: inviteForm.role });
      setInviteOpen(false);
      setInviteForm({ name: '', email: '', password: '', role: 'vendedor' });
    }, 'Acesso criado. O provisionamento individual da Evolution GO foi solicitado de forma segura ao servidor.');
  };
  const openEdit = (member: TeamMember) => {
    setEditingMember(member);
    setEditForm({ name: member.name, email: member.email });
  };
  const saveMemberProfile = () => {
    if (!editingMember) return;
    if (!editForm.name.trim() || !/^\S+@\S+\.\S+$/.test(editForm.email.trim())) {
      setError('Informe nome e e-mail válidos.');
      return;
    }
    void run(`profile:${editingMember.userId}`, async () => {
      await updateTeamMemberProfile(editingMember.userId, { name: editForm.name.trim(), email: editForm.email.trim() });
      setEditingMember(null);
    }, 'Cadastro atualizado e registrado na auditoria.');
  };
  const openPasswordReset = (member: TeamMember) => {
    setPasswordMember(member);
    setPasswordForm({ password: '', confirm: '' });
  };
  const saveTemporaryPassword = () => {
    if (!passwordMember) return;
    if (passwordForm.password.length < 8) { setError('Defina uma senha temporária com ao menos 8 caracteres.'); return; }
    if (passwordForm.password !== passwordForm.confirm) { setError('As senhas não conferem.'); return; }
    void run(`password:${passwordMember.userId}`, async () => {
      await resetTeamMemberPassword(passwordMember.userId, passwordForm.password);
      setPasswordMember(null);
      setPasswordForm({ password: '', confirm: '' });
    }, 'Senha temporária redefinida e registrada na auditoria.');
  };
  const openPermissions = async (member: TeamMember) => {
    setBusy(`permissions:${member.userId}`); setError('');
    try {
      const result = await loadTeamMemberPermissions(member.userId);
      setPermissionMember(member);
      setMemberPermissions(result.permissions);
    } catch (cause) { setError(messageFor(cause)); }
    finally { setBusy(null); }
  };
  const savePermissions = () => {
    if (!permissionMember || !memberPermissions) return;
    void run(`permissions:${permissionMember.userId}`, async () => {
      await saveTeamMemberPermissions(permissionMember.userId, memberPermissions);
      setPermissionMember(null);
      setMemberPermissions(null);
    }, `Permissões de ${permissionMember.name} atualizadas e auditadas.`);
  };
  const removeMember = () => {
    if (!removingMember || removeConfirmation.trim().toUpperCase() !== 'EXCLUIR') return;
    void run(`remove:${removingMember.userId}`, async () => {
      await removeTeamMember(removingMember.userId);
      setRemovingMember(null);
      setRemoveConfirmation('');
    }, 'Conta e dados privados removidos definitivamente; o histórico comercial da empresa permanece sem atribuição ao usuário.');
  };
  const togglePolicy = (key: keyof Omit<AccessSecurityPolicy, 'availableRoles'>) => {
    const next = { ...policy, [key]: !policy[key] };
    if (key === 'requireMfa' && next.requireMfa && !window.confirm('Exigir MFA marcará membros sem segundo fator para revisão. Deseja ativar a política?')) return;
    void run(`policy:${key}`, async () => { setPolicy(next); await saveAccessSecurityPolicy(next, `Política ${key} ${next[key] ? 'ativada' : 'desativada'}.`); }, 'Política de segurança salva e registrada.');
  };
  const toggleRoleAvailability = (role: TeamRole) => {
    if (role === 'administrador' && policy.availableRoles.administrador && Object.values(policy.availableRoles).filter(Boolean).length <= 1) return;
    const next = { ...policy, availableRoles: { ...policy.availableRoles, [role]: !policy.availableRoles[role] } };
    void run(`available:${role}`, async () => { setPolicy(next); await saveAccessSecurityPolicy(next, `Papel ${roleLabel[role]} ${next.availableRoles[role] ? 'disponível' : 'indisponível'}.`); }, 'Disponibilidade do papel salva.');
  };

  return <div className="space-y-4">
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800"><i className="ri-error-warning-line text-lg" />{error}</div>}
    {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-3 text-sm text-secondary-900"><i className="ri-checkbox-circle-line text-lg" />{notice}</div>}
    <header className="flex flex-col gap-4 rounded-2xl border border-background-200 bg-white p-5 shadow-xs sm:flex-row sm:items-end sm:justify-between">
      <div><p className="wf-eyebrow">Administração</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground-950">Equipe e acessos</h2><p className="mt-1 text-sm text-foreground-500">Membros, papéis e segurança.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" className="wf-btn-secondary text-xs" onClick={() => setSection('history')}><i className="ri-history-line" />Registro de auditoria</button><button type="button" className="wf-btn-secondary text-xs" onClick={() => setSection('roles')}><i className="ri-shield-user-line" />Papéis e permissões</button><button type="button" className="wf-btn-primary text-xs" onClick={() => setInviteOpen(true)}><i className="ri-user-add-line" />Criar acesso</button></div>
    </header>
    {attentionCount > 0 && <section className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 sm:flex-row sm:items-center"><i className="ri-alert-line text-xl" /><div className="flex-1"><p className="text-sm font-semibold">{attentionCount} acesso requer revisão</p><p className="text-xs text-amber-800">Revise permissões elevadas até 30/09.</p></div><button type="button" className="wf-btn-secondary text-xs" onClick={() => setSection('roles')}>Revisar agora</button></section>}
    <nav className="flex flex-wrap gap-1 rounded-xl border border-background-200 bg-white p-1" aria-label="Equipe e acessos">{([['members', 'Membros', 'ri-team-line'], ['roles', 'Papéis', 'ri-shield-user-line'], ['invites', 'Convites', 'ri-mail-line'], ['history', 'Histórico', 'ri-history-line']] as const).map(([id, label, icon]) => <button key={id} type="button" aria-selected={section === id} onClick={() => setSection(id)} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition sm:flex-none ${section === id ? 'bg-primary-50 text-primary-800 ring-1 ring-inset ring-primary-200' : 'text-foreground-500 hover:bg-background-50 hover:text-foreground-900'}`}><i className={icon} aria-hidden="true" />{label}{id === 'invites' && invites.length > 0 && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-900">{invites.length}</span>}</button>)}</nav>
    {loading ? <div className="wf-surface flex items-center justify-center gap-2 p-12 text-sm text-foreground-500"><i className="ri-loader-4-line animate-spin" />Carregando acessos reais…</div> : section === 'members' ? <Members members={visibleMembers} allMembers={members} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} busy={busy} onStatus={changeStatus} onRole={(member, next) => setPendingRole({ member, next })} onEdit={openEdit} onPassword={openPasswordReset} onPermissions={(member) => void openPermissions(member)} onRemove={(member) => { setRemovingMember(member); setRemoveConfirmation(''); }} policy={policy} onPolicy={togglePolicy} onOpenInvites={() => setSection('invites')} /> : section === 'roles' ? <Roles policy={policy} busy={busy} onToggle={toggleRoleAvailability} /> : section === 'invites' ? <Invites invites={invites} busy={busy} onCancel={(id) => { if (window.confirm('Cancelar este convite? Ele não poderá conceder acesso.')) void run(`cancel:${id}`, () => cancelOrganizationInvite(id), 'Convite cancelado e auditado.'); }} onResend={(id) => void run(`resend:${id}`, () => resendOrganizationInvite(id), 'Convite reenviado com nova validade.')} /> : <History audit={audit} refresh={() => void refresh()} />}
    {inviteOpen && <CreateAccessDialog form={inviteForm} setForm={setInviteForm} busy={busy === 'create'} onClose={() => setInviteOpen(false)} onSubmit={createAccess} availableRoles={policy.availableRoles} />}
    {pendingRole && <RoleChangeDialog pending={pendingRole} onClose={() => setPendingRole(null)} onConfirm={confirmRole} busy={busy?.startsWith('role:') === true} />}
    {editingMember && <EditMemberDialog member={editingMember} form={editForm} setForm={setEditForm} busy={busy === `profile:${editingMember.userId}`} onClose={() => setEditingMember(null)} onSubmit={saveMemberProfile} />}
    {passwordMember && <ResetPasswordDialog member={passwordMember} form={passwordForm} setForm={setPasswordForm} busy={busy === `password:${passwordMember.userId}`} onClose={() => setPasswordMember(null)} onSubmit={saveTemporaryPassword} />}
    {permissionMember && memberPermissions && <MemberPermissionsDialog member={permissionMember} permissions={memberPermissions} setPermissions={setMemberPermissions} busy={busy === `permissions:${permissionMember.userId}`} onClose={() => { setPermissionMember(null); setMemberPermissions(null); }} onSubmit={savePermissions} />}
    {removingMember && <RemoveMemberDialog member={removingMember} confirmation={removeConfirmation} setConfirmation={setRemoveConfirmation} busy={busy === `remove:${removingMember.userId}`} onClose={() => setRemovingMember(null)} onSubmit={removeMember} />}
  </div>;
}

function Members({ members, allMembers, query, setQuery, filter, setFilter, busy, onStatus, onRole, onEdit, onPassword, onPermissions, onRemove, policy, onPolicy, onOpenInvites }: { members: TeamMember[]; allMembers: TeamMember[]; query: string; setQuery: (value: string) => void; filter: Filter; setFilter: (value: Filter) => void; busy: string | null; onStatus: (member: TeamMember) => void; onRole: (member: TeamMember, next: TeamRole) => void; onEdit: (member: TeamMember) => void; onPassword: (member: TeamMember) => void; onPermissions: (member: TeamMember) => void; onRemove: (member: TeamMember) => void; policy: AccessSecurityPolicy; onPolicy: (key: keyof Omit<AccessSecurityPolicy, 'availableRoles'>) => void; onOpenInvites: () => void }) {
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,23rem)]">
    <section className="wf-surface overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-background-200/70 px-5 py-4"><div><h3 className="text-base font-bold text-foreground-950">Membros da equipe</h3><p className="mt-1 text-xs text-foreground-500">Gerencie acessos, dados privados e canais individuais com segurança.</p></div><span className="text-xs font-semibold text-foreground-500">{allMembers.length} membros</span></div>
      <div className="flex flex-col gap-2 border-b border-background-200/70 p-4 lg:flex-row"><label className="relative min-w-0 flex-1"><span className="sr-only">Buscar por nome ou e-mail</span><i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou e-mail" className="w-full rounded-xl border border-background-200 bg-background-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20" /></label><div className="flex flex-wrap gap-2">{([['all', 'Todos'], ['active', 'Ativos'], ['invites', 'Convites'], ['disabled', 'Suspensos']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setFilter(id)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${filter === id ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-background-200 text-foreground-600 hover:bg-background-50'}`}>{label}{id === 'active' && ` ${allMembers.filter((item) => item.status === 'active').length}`}</button>)}</div></div>
      {filter === 'invites' ? <div className="p-6 text-center text-sm text-foreground-500">Abra a aba <button type="button" className="font-semibold text-primary-700 underline" onClick={onOpenInvites}>Convites</button> para gerenciar pendências.</div> : members.length === 0 ? <div className="p-12 text-center text-sm text-foreground-500"><i className="ri-user-search-line mb-2 block text-2xl" />Nenhum membro encontrado.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-background-50 text-[11px] uppercase tracking-wide text-foreground-500"><tr><th className="px-5 py-3 font-semibold">Membro</th><th className="px-3 py-3 font-semibold">Papel</th><th className="px-3 py-3 font-semibold">Escopo</th><th className="px-3 py-3 font-semibold">Segurança</th><th className="px-3 py-3 font-semibold">Última atividade</th><th className="px-3 py-3 font-semibold">Acesso</th><th className="px-4 py-3" aria-label="Mais ações" /></tr></thead><tbody className="divide-y divide-background-200/70">{members.map((member) => <tr key={member.userId} className="align-middle hover:bg-background-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-800">{member.name.charAt(0).toUpperCase()}</span><div><p className="text-sm font-semibold text-foreground-950">{member.name}</p><p className="mt-0.5 text-xs text-foreground-500">{member.email}</p></div></div></td><td className="px-3 py-4"><select aria-label={`Papel de ${member.name}`} disabled={busy === `role:${member.userId}`} value={member.role} onChange={(event) => onRole(member, event.target.value as TeamRole)} className="rounded-lg border border-background-200 bg-white px-2.5 py-2 text-xs font-semibold text-foreground-800 outline-none focus:border-primary-500">{roles.filter((role) => policy.availableRoles[role] || role === member.role).map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></td><td className="px-3 py-4 text-xs text-foreground-600">{roleScope[member.role]}</td><td className="px-3 py-4"><StatusPill tone="neutral">MFA não verificado</StatusPill></td><td className="whitespace-nowrap px-3 py-4 text-xs text-foreground-600">{formatDate(member.lastAccessAt)}</td><td className="px-3 py-4"><div className="flex items-center gap-2"><Switch label={`Acesso de ${member.name}`} enabled={member.status === 'active'} disabled={busy === `status:${member.userId}`} onChange={() => onStatus(member)} /><span className={`text-xs font-semibold ${member.status === 'active' ? 'text-secondary-800' : 'text-foreground-500'}`}>{member.status === 'active' ? 'Ativo' : member.status === 'invited' ? 'Convite pendente' : 'Desativado'}</span></div></td><td className="relative px-4 py-4 text-right"><button type="button" onClick={() => setOpenMenuFor(openMenuFor === member.userId ? null : member.userId)} className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" aria-label={`Mais ações de ${member.name}`} aria-expanded={openMenuFor === member.userId}><i className="ri-more-2-fill" /></button>{openMenuFor === member.userId && <div role="menu" aria-label={`Ações de ${member.name}`} className="absolute right-4 z-20 mt-1 w-56 rounded-xl border border-background-200 bg-white p-1.5 text-left shadow-lg"><button role="menuitem" type="button" onClick={() => { setOpenMenuFor(null); onEdit(member); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground-800 hover:bg-background-50"><i className="ri-edit-line" />Editar cadastro</button><button role="menuitem" type="button" onClick={() => { setOpenMenuFor(null); onPassword(member); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground-800 hover:bg-background-50"><i className="ri-key-2-line" />Redefinir senha</button><button role="menuitem" type="button" onClick={() => { setOpenMenuFor(null); onPermissions(member); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground-800 hover:bg-background-50"><i className="ri-shield-user-line" />Permissões individuais</button><button role="menuitem" type="button" onClick={() => { setOpenMenuFor(null); onStatus(member); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground-800 hover:bg-background-50"><i className={member.status === 'active' ? 'ri-lock-line' : 'ri-lock-unlock-line'} />{member.status === 'active' ? 'Desativar acesso' : 'Reativar acesso'}</button><div className="my-1 border-t border-background-100" /><button role="menuitem" type="button" onClick={() => { setOpenMenuFor(null); onRemove(member); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-accent-700 hover:bg-accent-50"><i className="ri-delete-bin-6-line" />Excluir usuário</button></div>}</td></tr>)}</tbody></table></div>}
    </section>
    <aside className="space-y-4"><SecurityCard policy={policy} onToggle={onPolicy} busy={busy} /><div className="wf-surface p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-lg text-primary-700"><i className="ri-shield-check-line" /></span><div><h3 className="text-base font-bold text-foreground-950">Acesso seguro por padrão</h3><p className="mt-1 text-xs leading-5 text-foreground-500">Desativar preserva histórico, leads, orçamentos e autoria. O backend confirma e audita cada alteração.</p></div></div></div></aside>
  </div>;
}

function SecurityCard({ policy, onToggle, busy }: { policy: AccessSecurityPolicy; onToggle: (key: keyof Omit<AccessSecurityPolicy, 'availableRoles'>) => void; busy: string | null }) {
  const rows: Array<[keyof Omit<AccessSecurityPolicy, 'availableRoles'>, string, string, string]> = [['requireMfa', 'Exigir MFA', 'Membros devem usar segundo fator.', 'Revisão de segurança'], ['revokeSessionsOnDisable', 'Revogar sessões ao desativar', 'Encerra sessões do membro.', 'Revogação de sessões'], ['quarterlyReview', 'Revisão trimestral de acesso', 'Lembra de revisar permissões a cada 3 meses.', 'Revisão trimestral']];
  return <section className="wf-surface overflow-hidden"><div className="border-b border-background-200/70 px-5 py-4"><h3 className="text-base font-bold text-foreground-950">Segurança de acesso</h3><p className="mt-1 text-xs text-foreground-500">Políticas globais aplicadas após confirmação.</p></div><div className="divide-y divide-background-200/70">{rows.map(([key, label, description, auditLabel]) => <div key={key} className="flex items-center gap-3 px-5 py-4"><i className="ri-shield-keyhole-line text-lg text-foreground-400" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground-900">{label}</p><p className="mt-1 text-xs leading-4 text-foreground-500">{description}</p><p className="mt-1 text-[11px] text-foreground-400">Audita: {auditLabel}</p></div><div className="flex items-center gap-2"><span className="hidden text-xs font-semibold text-foreground-600 sm:block">{policy[key] ? 'Ativo' : 'Desativado'}</span><Switch label={label} enabled={policy[key]} disabled={busy === `policy:${key}`} onChange={() => onToggle(key)} /></div></div>)}</div><button type="button" className="m-4 w-[calc(100%-2rem)] rounded-xl border border-background-300 px-3 py-2.5 text-xs font-semibold text-foreground-800 hover:bg-background-50" onClick={() => onToggle('quarterlyReview')}><i className="ri-settings-3-line mr-2" />Configurar política</button></section>;
}

function Roles({ policy, busy, onToggle }: { policy: AccessSecurityPolicy; busy: string | null; onToggle: (role: TeamRole) => void }) {
  const [selected, setSelected] = useState<TeamRole>('vendedor');
  const permissions = rolePermissionPreview[selected];
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,23rem)]"><section className="wf-surface overflow-hidden"><div className="border-b border-background-200/70 px-5 py-4"><h3 className="text-base font-bold text-foreground-950">Papéis disponíveis</h3><p className="mt-1 text-xs text-foreground-500">O papel define a base; permissões individuais continuam auditáveis.</p></div><div className="divide-y divide-background-200/70">{roles.map((role) => <button key={role} type="button" onClick={() => setSelected(role)} className={`flex w-full items-center gap-3 px-5 py-4 text-left ${selected === role ? 'bg-primary-50/60' : 'hover:bg-background-50'}`}><span className="flex h-9 w-9 items-center justify-center rounded-full bg-background-100 text-sm font-bold text-foreground-700">{roleLabel[role].charAt(0)}</span><span className="min-w-0 flex-1"><strong className="block text-sm text-foreground-950">{roleLabel[role]}</strong><span className="mt-1 block text-xs text-foreground-500">{roleDescriptions[role]}</span></span><span className="flex items-center gap-2"><span className="text-xs font-semibold text-foreground-600">{policy.availableRoles[role] ? 'Ativo' : 'Desativado'}</span><Switch label={`Papel ${roleLabel[role]} disponível`} enabled={policy.availableRoles[role]} disabled={busy === `available:${role}`} onChange={() => onToggle(role)} /></span></button>)}</div></section><section className="wf-surface overflow-hidden"><div className="border-b border-background-200/70 px-5 py-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Prévia do papel</p><h3 className="mt-1 text-xl font-bold text-foreground-950">{roleLabel[selected]}</h3><p className="mt-1 text-xs text-foreground-500">{roleDescriptions[selected]}</p></div><div className="space-y-2 p-5">{teamPermissions.map((permission) => <div key={permission} className="flex items-center gap-2 text-sm"><i className={`${permissions.has(permission) ? 'ri-checkbox-circle-fill text-secondary-600' : 'ri-close-circle-fill text-accent-500'}`} aria-hidden="true" /><span className="flex-1 text-foreground-700">{teamPermissionLabel[permission]}</span><span className={`text-xs font-semibold ${permissions.has(permission) ? 'text-secondary-800' : 'text-accent-700'}`}>{permissions.has(permission) ? 'Permitido' : 'Bloqueado'}</span></div>)}</div><div className="border-t border-background-200/70 p-5"><p className="text-xs text-foreground-500">Escopo padrão: <strong className="text-foreground-800">{roleScope[selected]}</strong></p><p className="mt-3 rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-xs leading-5 text-foreground-600"><i className="ri-shield-user-line mr-2" />Para criar exceções de um usuário, abra os três pontos na lista de membros e escolha <strong>Permissões individuais</strong>.</p></div></section></div>;
}

function Invites({ invites, busy, onCancel, onResend }: { invites: OrganizationInvite[]; busy: string | null; onCancel: (id: string) => void; onResend: (id: string) => void }) {
  return <section className="wf-surface overflow-hidden"><div className="flex items-start justify-between border-b border-background-200/70 px-5 py-4"><div><h3 className="text-base font-bold text-foreground-950">Convites enviados</h3><p className="mt-1 text-xs text-foreground-500">Convites pendentes não concedem acesso antes do aceite.</p></div><span className="text-xs font-semibold text-foreground-500">{invites.length} registros</span></div>{invites.length === 0 ? <div className="p-12 text-center text-sm text-foreground-500"><i className="ri-mail-check-line mb-2 block text-2xl" />Nenhum convite pendente.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-background-50 text-[11px] uppercase tracking-wide text-foreground-500"><tr><th className="px-5 py-3">E-mail</th><th className="px-3 py-3">Papel</th><th className="px-3 py-3">Enviado em</th><th className="px-3 py-3">Expiração</th><th className="px-3 py-3">Estado</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-background-200/70">{invites.map((invite) => { const expired = new Date(invite.expiresAt).getTime() < Date.now(); const accepted = Boolean(invite.acceptedAt); const cancelled = Boolean(invite.cancelledAt); return <tr key={invite.id}><td className="px-5 py-4 text-sm font-semibold text-foreground-900">{invite.email}</td><td className="px-3 py-4 text-xs text-foreground-600">{roleLabel[invite.role]}</td><td className="px-3 py-4 text-xs text-foreground-600">{formatDate(invite.createdAt)}</td><td className="px-3 py-4 text-xs text-foreground-600">{formatDate(invite.expiresAt)}</td><td className="px-3 py-4"><StatusPill tone={accepted ? 'good' : cancelled ? 'neutral' : expired ? 'danger' : 'warn'}>{accepted ? 'Aceito' : cancelled ? 'Cancelado' : expired ? 'Expirado' : 'Pendente'}</StatusPill></td><td className="px-4 py-4 text-right"><div className="flex justify-end gap-2">{!accepted && !cancelled && <button type="button" disabled={busy === `resend:${invite.id}`} onClick={() => onResend(invite.id)} className="rounded-lg border border-background-300 px-2.5 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-50">Reenviar</button>} {!accepted && !cancelled && <button type="button" disabled={busy === `cancel:${invite.id}`} onClick={() => onCancel(invite.id)} className="rounded-lg border border-accent-200 px-2.5 py-2 text-xs font-semibold text-accent-700 hover:bg-accent-50">Cancelar</button>}</div></td></tr>; })}</tbody></table></div>}</section>;
}

function History({ audit, refresh }: { audit: AccessAuditEvent[]; refresh: () => void }) {
  return <section className="wf-surface overflow-hidden"><div className="flex items-start justify-between border-b border-background-200/70 px-5 py-4"><div><h3 className="text-base font-bold text-foreground-950">Atividade recente</h3><p className="mt-1 text-xs text-foreground-500">Convites, papéis, acessos, políticas e sessões.</p></div><button type="button" className="wf-btn-secondary text-xs" onClick={refresh}><i className="ri-refresh-line" />Atualizar</button></div>{audit.length === 0 ? <div className="p-12 text-center text-sm text-foreground-500">Nenhuma alteração de acesso registrada.</div> : <div className="divide-y divide-background-200/70">{audit.map((event) => <div key={event.id} className="flex items-start gap-3 px-5 py-4"><span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700"><i className="ri-shield-check-line" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground-900">{event.detail || event.action}</p><p className="mt-1 text-xs text-foreground-500">Por {event.actorName} · {formatDate(event.occurredAt)}</p></div><span className="text-[11px] font-semibold text-secondary-700">Auditado</span></div>)}</div>}</section>;
}

function CreateAccessDialog({ form, setForm, busy, onClose, onSubmit, availableRoles }: { form: { name: string; email: string; password: string; role: TeamRole }; setForm: (value: { name: string; email: string; password: string; role: TeamRole }) => void; busy: boolean; onClose: () => void; onSubmit: () => void; availableRoles: Record<TeamRole, boolean> }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="create-member-title" className="w-full max-w-md rounded-2xl border border-background-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="flex items-start justify-between border-b border-background-200/70 px-5 py-4"><div><h3 id="create-member-title" className="font-heading font-bold text-foreground-950">Criar acesso</h3><p className="mt-1 text-xs text-foreground-500">O usuário poderá entrar imediatamente com a senha temporária definida abaixo.</p></div><button type="button" aria-label="Fechar" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={onClose}><i className="ri-close-line" /></button></header><div className="space-y-4 p-5"><label className="block text-sm font-semibold text-foreground-800">Nome<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nome da pessoa" className="mt-1.5 w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-primary-500" /></label><label className="block text-sm font-semibold text-foreground-800">E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="email@empresa.com" className="mt-1.5 w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-primary-500" /></label><label className="block text-sm font-semibold text-foreground-800">Senha temporária<input type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Mínimo de 8 caracteres" className="mt-1.5 w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-primary-500" /></label><label className="block text-sm font-semibold text-foreground-800">Papel<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as TeamRole })} className="mt-1.5 w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-primary-500">{roles.filter((role) => availableRoles[role]).map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></label><p className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-xs leading-5 text-primary-900"><i className="ri-whatsapp-line mr-1" />Depois de criado, o servidor agenda o vínculo individual da Evolution GO. Credenciais e QR Code continuam protegidos no painel do usuário.</p></div><footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={busy} onClick={onSubmit}>{busy ? 'Criando…' : 'Criar acesso'}</button></footer></section></div>;
}

function EditMemberDialog({ member, form, setForm, busy, onClose, onSubmit }: { member: TeamMember; form: { name: string; email: string }; setForm: (value: { name: string; email: string }) => void; busy: boolean; onClose: () => void; onSubmit: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="edit-member-title" className="w-full max-w-md rounded-2xl border border-background-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="flex items-start justify-between border-b border-background-200/70 px-5 py-4"><div><h3 id="edit-member-title" className="font-heading font-bold text-foreground-950">Editar cadastro</h3><p className="mt-1 text-xs text-foreground-500">Atualize o nome e o e-mail de {member.name}. O papel é alterado diretamente na tabela.</p></div><button type="button" aria-label="Fechar" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={onClose}><i className="ri-close-line" /></button></header><div className="space-y-4 p-5"><label className="block text-sm font-semibold text-foreground-800">Nome<input autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1.5 w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-primary-500" /></label><label className="block text-sm font-semibold text-foreground-800">E-mail<input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-primary-500" /></label><p className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-xs leading-5 text-primary-900"><i className="ri-shield-check-line mr-1" />A alteração é atualizada tanto no cadastro do CRM quanto no login, e fica registrada no histórico.</p></div><footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={busy} onClick={onSubmit}>{busy ? 'Salvando…' : 'Salvar cadastro'}</button></footer></section></div>;
}

function ResetPasswordDialog({ member, form, setForm, busy, onClose, onSubmit }: { member: TeamMember; form: { password: string; confirm: string }; setForm: (value: { password: string; confirm: string }) => void; busy: boolean; onClose: () => void; onSubmit: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="reset-member-password-title" className="w-full max-w-md rounded-2xl border border-background-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="flex items-start justify-between border-b border-background-200/70 px-5 py-4"><div><h3 id="reset-member-password-title" className="font-heading font-bold text-foreground-950">Redefinir senha</h3><p className="mt-1 text-xs text-foreground-500">Defina uma senha temporária para {member.name}.</p></div><button type="button" aria-label="Fechar" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={onClose}><i className="ri-close-line" /></button></header><div className="space-y-4 p-5"><label className="block text-sm font-semibold text-foreground-800">Nova senha temporária<input type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Mínimo de 8 caracteres" className="mt-1.5 w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-primary-500" /></label><label className="block text-sm font-semibold text-foreground-800">Confirmar senha<input type="password" autoComplete="new-password" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} placeholder="Repita a nova senha" className="mt-1.5 w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-primary-500" /></label><p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"><i className="ri-key-2-line mr-1" />A nova senha não será exibida nem guardada no CRM. As sessões renováveis desse usuário serão encerradas.</p></div><footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={busy} onClick={onSubmit}>{busy ? 'Redefinindo…' : 'Redefinir senha'}</button></footer></section></div>;
}

function MemberPermissionsDialog({ member, permissions, setPermissions, busy, onClose, onSubmit }: { member: TeamMember; permissions: Record<TeamPermission, boolean>; setPermissions: (value: Record<TeamPermission, boolean>) => void; busy: boolean; onClose: () => void; onSubmit: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="member-permissions-title" className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-background-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="sticky top-0 flex items-start justify-between border-b border-background-200/70 bg-white px-5 py-4"><div><h3 id="member-permissions-title" className="font-heading font-bold text-foreground-950">Permissões de {member.name}</h3><p className="mt-1 text-xs text-foreground-500">O papel define a base; estes controles registram exceções individuais.</p></div><button type="button" aria-label="Fechar" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={onClose}><i className="ri-close-line" /></button></header><div className="grid gap-2 p-5 sm:grid-cols-2">{teamPermissions.map((permission) => <label key={permission} className="flex cursor-pointer items-center gap-3 rounded-xl border border-background-200 p-3 text-sm text-foreground-800 hover:bg-background-50"><input type="checkbox" checked={permissions[permission]} onChange={(event) => setPermissions({ ...permissions, [permission]: event.target.checked })} className="h-4 w-4 accent-primary-600" /><span>{teamPermissionLabel[permission]}</span></label>)}</div><footer className="sticky bottom-0 flex justify-end gap-2 border-t border-background-200/70 bg-white px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={busy} onClick={onSubmit}>{busy ? 'Salvando…' : 'Salvar permissões'}</button></footer></section></div>;
}

function RemoveMemberDialog({ member, confirmation, setConfirmation, busy, onClose, onSubmit }: { member: TeamMember; confirmation: string; setConfirmation: (value: string) => void; busy: boolean; onClose: () => void; onSubmit: () => void }) {
  const valid = confirmation.trim().toUpperCase() === 'EXCLUIR';
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="remove-member-title" className="w-full max-w-md rounded-2xl border border-accent-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="flex items-start justify-between border-b border-background-200/70 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-accent-700">Ação irreversível</p><h3 id="remove-member-title" className="mt-1 font-heading font-bold text-foreground-950">Excluir {member.name}?</h3></div><button type="button" aria-label="Fechar" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={onClose}><i className="ri-close-line" /></button></header><div className="space-y-4 p-5"><p className="text-sm leading-6 text-foreground-700">A identidade, credenciais, perfil, permissões, sessões, arquivos próprios e recursos individuais da Evolution GO serão apagados. QR, filas, configuração do canal e o segredo do cofre também serão removidos.</p><p className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-xs leading-5 text-primary-900"><i className="ri-information-line mr-1" />Leads, mensagens e demais histórico comercial da empresa permanecem, mas sem o vínculo ou a autoria do usuário excluído.</p><p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"><i className="ri-shield-check-line mr-1" />Não é possível excluir a própria conta, o último administrador ativo ou uma identidade vinculada a outra organização.</p><label className="block text-sm font-semibold text-foreground-800">Digite <strong>EXCLUIR</strong> para confirmar<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1.5 w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-accent-500" autoComplete="off" /></label></div><footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={!valid || busy} onClick={onSubmit}>{busy ? 'Excluindo…' : 'Excluir definitivamente'}</button></footer></section></div>;
}

function RoleChangeDialog({ pending, onClose, onConfirm, busy }: { pending: { member: TeamMember; next: TeamRole }; onClose: () => void; onConfirm: () => void; busy: boolean }) {
  const oldSet = rolePermissionPreview[pending.member.role];
  const nextSet = rolePermissionPreview[pending.next];
  const added = [...nextSet].filter((permission) => !oldSet.has(permission));
  const removed = [...oldSet].filter((permission) => !nextSet.has(permission));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="role-change-title" className="w-full max-w-lg rounded-2xl border border-background-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="border-b border-background-200/70 px-5 py-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Prévia antes de aplicar</p><h3 id="role-change-title" className="mt-1 text-lg font-bold text-foreground-950">Alterar papel de {pending.member.name}</h3><p className="mt-1 text-xs text-foreground-500">{roleLabel[pending.member.role]} → {roleLabel[pending.next]}</p></header><div className="grid gap-4 p-5 sm:grid-cols-2"><div><p className="text-xs font-semibold text-secondary-800">Permissões adicionadas ({added.length})</p><ul className="mt-2 space-y-1 text-xs text-foreground-600">{added.slice(0, 8).map((permission) => <li key={permission}><i className="ri-add-line mr-1 text-secondary-600" />{teamPermissionLabel[permission]}</li>)}</ul></div><div><p className="text-xs font-semibold text-accent-700">Permissões bloqueadas ({removed.length})</p><ul className="mt-2 space-y-1 text-xs text-foreground-600">{removed.slice(0, 8).map((permission) => <li key={permission}><i className="ri-subtract-line mr-1 text-accent-600" />{teamPermissionLabel[permission]}</li>)}</ul></div></div><footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={busy} onClick={onConfirm}>{busy ? 'Aplicando…' : 'Confirmar alteração'}</button></footer></section></div>;
}
