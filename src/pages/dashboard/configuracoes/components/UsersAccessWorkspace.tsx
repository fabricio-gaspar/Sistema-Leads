import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createTeamMember,
  defaultAccessSecurityPolicy,
  defaultPermissionsForRole,
  loadAccessSecurityPolicy,
  loadTeamAccessAudit,
  loadTeamMemberPermissions,
  loadTeamMembers,
  removeTeamMember,
  roleLabel,
  saveAccessSecurityPolicy,
  saveTeamMemberPermissions,
  setTeamMemberStatus,
  teamPermissionLabel,
  teamPermissions,
  updateTeamRole,
  type AccessAuditEvent,
  type AccessSecurityPolicy,
  type TeamMember,
  type TeamPermission,
  type TeamRole,
} from '@/lib/crm/teamMembersRepository';

type Section = 'members' | 'roles' | 'history';
type Filter = 'all' | 'active' | 'disabled';

const roles: TeamRole[] = ['administrador', 'vendedor', 'sdr', 'cx'];
const roleDescriptions: Record<TeamRole, string> = {
  administrador: 'Acesso total à operação, equipe e configurações.',
  vendedor: 'Vende, cria orçamentos e acompanha leads.',
  sdr: 'Pesquisa, qualifica e movimenta oportunidades.',
  cx: 'Consulta leads e atende todas as conversas da empresa.',
};
const roleScope: Record<TeamRole, string> = {
  administrador: 'Acesso total', vendedor: 'Leads e orçamentos', sdr: 'Prospecção e leads', cx: 'Leads e conversas da empresa',
};
const rolePermissionPreview = Object.fromEntries(roles.map((role) => [role, new Set(teamPermissions.filter((permission) => defaultPermissionsForRole(role)[permission]))])) as Record<TeamRole, Set<TeamPermission>>;

const errorCopy: Record<string, string> = {
  member_role_unavailable: 'Este papel está indisponível na política da empresa.',
  invite_not_current: 'Convite cancelado ou substituído. Atualize a lista.',
  administrator_permissions_are_fixed: 'Administradores têm acesso total. Altere o papel para restringir acesso.',
  global_identity_self_service_required: 'O backend ainda usa o fluxo antigo de convites. O cadastro direto não está disponível nesta versão; nenhuma conta foi criada.',
  last_administrator_protected: 'A empresa precisa manter ao menos um administrador ativo.',
  member_self_deletion_protected: 'Seu próprio acesso não pode ser removido por esta tela.',
  member_sessions_revoke_failed: 'O acesso foi preservado porque as sessões não puderam ser revogadas.',
  member_storage_list_failed: 'Não foi possível localizar os arquivos privados da conta para exclusão segura.',
  member_storage_delete_failed: 'Não foi possível apagar os arquivos privados da conta pelo serviço de armazenamento.',
  member_email_already_registered: 'Este e-mail ainda existe no cadastro de login. A exclusão anterior não foi completa; não use outro endereço para contornar o problema.',
  invalid_member_password: 'A senha temporária precisa ter de 8 a 128 caracteres.',
  member_creation_backend_unavailable: 'O cadastro direto ainda não está habilitado no backend. Nenhuma conta foi criada.',
  member_creation_failed: 'O provedor de autenticação não criou a conta. Nenhum vínculo foi liberado.',
  member_creation_pending_review: 'A conta de login foi criada, mas o vínculo com a empresa não foi confirmado. Não tente novamente com o mesmo e-mail; solicite revisão técnica.',
  member_profile_not_found: 'O cadastro deste usuário não foi localizado.',
  member_profile_update_failed: 'Não foi possível atualizar o cadastro. Nenhuma alteração parcial foi mantida.',
  member_password_reset_failed: 'Não foi possível trocar a senha temporária.',
  member_password_reset_session_revoke_failed: 'A nova senha foi registrada, mas não foi possível encerrar as sessões anteriores.',
  member_linked_to_another_organization: 'Esta conta pertence a outra organização e não pode ser apagada por aqui.',
  member_identity_deletion_failed: 'Não foi possível excluir a conta definitivamente.',
  member_identity_deletion_unconfirmed: 'A exclusão do login não foi confirmada. Atualize a lista antes de tentar novamente.',
  member_identity_erasure_preflight_failed: 'A exclusão definitiva foi bloqueada antes de remover a instância. Verifique se o usuário ainda tem vínculo com outra empresa ou é o último administrador.',
  member_identity_not_found: 'A identidade de login já não existe. Atualize a lista antes de tentar novamente.',
  member_shared_company_data_requires_reassignment: 'Este usuário tem compromissos, regras de repasse ou histórico compartilhado. Reatribua esses registros antes de excluí-lo; nada foi apagado.',
  member_shared_data_preflight_failed: 'Não foi possível confirmar a preservação dos dados compartilhados. Nenhuma exclusão foi iniciada.',
  member_gateway_not_configured: 'O servidor Evolution GO não está configurado. O usuário não foi removido; verifique o servidor em Canais.',
  member_gateway_not_allowed: 'A URL do servidor Evolution GO não está autorizada. O usuário não foi removido.',
  member_remote_delete_not_confirmed: 'A instância ainda aparece no Evolution GO. O acesso foi bloqueado preventivamente; consulte o estado remoto antes de tentar novamente.',
  member_remote_absence_save_failed: 'A instância não aparece mais no Evolution GO, mas a confirmação local falhou. Não crie outra instância; solicite revisão técnica.',
  member_local_finalize_failed: 'A instância remota foi removida, mas a exclusão local não foi concluída. O histórico permanece salvo; solicite revisão técnica.',
  member_removal_in_progress: 'Esta exclusão já está em andamento. Aguarde alguns minutos e atualize antes de tentar novamente.',
  member_instance_identity_mismatch: 'A instância vinculada não corresponde ao usuário. Nenhuma exclusão remota foi autorizada; solicite revisão técnica.',
  member_integration_not_individual: 'O conector não pertence exclusivamente a este usuário. Nada foi desativado; solicite revisão técnica do vínculo.',
  member_provisioning_fence_failed: 'Não foi possível interromper o provisionamento da instância. A exclusão foi bloqueada para evitar recriação.',
  member_remote_name_duplicated: 'Há mais de uma instância com o mesmo nome no Evolution GO. A exclusão foi bloqueada para proteger outros usuários.',
  member_removal_admin_required: 'Somente um administrador ativo pode excluir este usuário.',
  invite_already_accepted: 'Este convite já foi aceito e não pode ser alterado.',
  invite_not_found: 'Convite não encontrado ou já cancelado.',
  security_policy_required: 'A política de segurança está incompleta.',
};

function messageFor(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  return errorCopy[code] ?? 'A operação não foi confirmada. Atualize os dados e consulte o estado do usuário e da instância antes de tentar novamente.';
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
  const [audit, setAudit] = useState<AccessAuditEvent[]>([]);
  const [policy, setPolicy] = useState<AccessSecurityPolicy>(defaultAccessSecurityPolicy);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'vendedor' as TeamRole });
  const [pendingRole, setPendingRole] = useState<{ member: TeamMember; next: TeamRole } | null>(null);
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null);
  const [removeConfirmation, setRemoveConfirmation] = useState('');
  const [permissionMember, setPermissionMember] = useState<TeamMember | null>(null);
  const [memberPermissions, setMemberPermissions] = useState<Record<TeamPermission, boolean> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [nextMembers, nextPolicy, nextAudit] = await Promise.all([loadTeamMembers(), loadAccessSecurityPolicy(), loadTeamAccessAudit()]);
      setMembers(nextMembers); setPolicy(nextPolicy); setAudit(nextAudit);
    } catch (cause) { setError(messageFor(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const visibleMembers = useMemo(() => members.filter((member) => {
    const matchesQuery = !query.trim() || `${member.name} ${member.email}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'active' && member.status === 'active') || (filter === 'disabled' && member.status === 'disabled');
    return matchesQuery && matchesFilter;
  }), [filter, members, query]);

  const run = async (key: string, operation: () => Promise<void>, success: string) => {
    setBusy(key); setError('');
    try { await operation(); if (success) setNotice(success); await refresh(); }
    catch (cause) { setError(messageFor(cause)); }
    finally { setBusy(null); }
  };
  const changeStatus = (member: TeamMember) => {
    const enabled = member.status !== 'active';
    if (!enabled && !window.confirm(`Desativar o acesso de ${member.name}? Isso bloqueia o acesso a esta empresa e desabilita seus canais locais. O histórico, leads e autoria serão preservados. O vínculo nesta empresa será bloqueado; a conta global e suas outras empresas permanecem.`)) return;
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
    if (!createForm.name.trim() || !/^\S+@\S+\.\S+$/.test(createForm.email.trim())) { setError('Informe nome e e-mail válidos.'); return; }
    if (createForm.password.length < 8 || createForm.password.length > 128) { setError(errorCopy.invalid_member_password); return; }
    if (createForm.password !== createForm.confirm) { setError('A confirmação da senha temporária não confere.'); return; }
    if (!policy.availableRoles[createForm.role]) { setError(errorCopy.member_role_unavailable); return; }
    void run('create', async () => {
      const result = await createTeamMember({ name: createForm.name.trim(), email: createForm.email.trim(), password: createForm.password, role: createForm.role });
      setNotice(result.message);
      setCreateOpen(false);
      setCreateForm({ name: '', email: '', password: '', confirm: '', role: 'vendedor' });
    }, '').finally(() => setCreateForm((current) => ({ ...current, password: '', confirm: '' })));
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
    }, 'Usuário e login excluídos definitivamente; instância Evolution GO removida. Dados compartilhados da empresa preservados.');
  };
  const togglePolicy = (key: keyof Omit<AccessSecurityPolicy, 'availableRoles'>) => {
    const next = { ...policy, [key]: !policy[key] };
    if (key === 'requireMfa' || key === 'revokeSessionsOnDisable') return;
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
      <div className="flex flex-wrap gap-2"><button type="button" className="wf-btn-secondary text-xs" onClick={() => setSection('history')}><i className="ri-history-line" />Registro de auditoria</button><button type="button" className="wf-btn-secondary text-xs" onClick={() => setSection('roles')}><i className="ri-shield-user-line" />Papéis e permissões</button><button type="button" className="wf-btn-primary text-xs" disabled={loading} onClick={() => { const role = policy.availableRoles.vendedor ? 'vendedor' : roles.find((candidate) => policy.availableRoles[candidate]) ?? 'vendedor'; setCreateForm({ name: '', email: '', password: '', confirm: '', role }); setCreateOpen(true); }}><i className="ri-user-add-line" />Criar usuário</button></div>
    </header>
    <nav className="flex flex-wrap gap-1 rounded-xl border border-background-200 bg-white p-1" aria-label="Equipe e acessos">{([['members', 'Membros', 'ri-team-line'], ['roles', 'Papéis', 'ri-shield-user-line'], ['history', 'Histórico', 'ri-history-line']] as const).map(([id, label, icon]) => <button key={id} type="button" aria-selected={section === id} onClick={() => setSection(id)} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition sm:flex-none ${section === id ? 'bg-primary-50 text-primary-800 ring-1 ring-inset ring-primary-200' : 'text-foreground-500 hover:bg-background-50 hover:text-foreground-900'}`}><i className={icon} aria-hidden="true" />{label}</button>)}</nav>
    {loading ? <div className="wf-surface flex items-center justify-center gap-2 p-12 text-sm text-foreground-500"><i className="ri-loader-4-line animate-spin" />Carregando acessos reais…</div> : section === 'members' ? <Members members={visibleMembers} allMembers={members} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} busy={busy} onStatus={changeStatus} onRole={(member, next) => setPendingRole({ member, next })} onPermissions={(member) => void openPermissions(member)} onRemove={(member) => { setRemovingMember(member); setRemoveConfirmation(''); }} policy={policy} onPolicy={togglePolicy} /> : section === 'roles' ? <Roles policy={policy} busy={busy} onToggle={toggleRoleAvailability} /> : <History audit={audit} refresh={() => void refresh()} />}
    {createOpen && <CreateAccessDialog form={createForm} setForm={setCreateForm} busy={busy === 'create'} onClose={() => { if (busy !== 'create') { setCreateOpen(false); setCreateForm({ name: '', email: '', password: '', confirm: '', role: 'vendedor' }); } }} onSubmit={createAccess} availableRoles={policy.availableRoles} />}
    {pendingRole && <RoleChangeDialog pending={pendingRole} onClose={() => setPendingRole(null)} onConfirm={confirmRole} busy={busy?.startsWith('role:') === true} />}
    {permissionMember && memberPermissions && <MemberPermissionsDialog member={permissionMember} permissions={memberPermissions} setPermissions={setMemberPermissions} busy={busy === `permissions:${permissionMember.userId}`} onClose={() => { setPermissionMember(null); setMemberPermissions(null); }} onSubmit={savePermissions} />}
    {removingMember && <RemoveMemberDialog member={removingMember} confirmation={removeConfirmation} setConfirmation={setRemoveConfirmation} busy={busy === `remove:${removingMember.userId}`} onClose={() => setRemovingMember(null)} onSubmit={removeMember} />}
  </div>;
}

function Members({ members, allMembers, query, setQuery, filter, setFilter, busy, onStatus, onRole, onPermissions, onRemove, policy, onPolicy }: { members: TeamMember[]; allMembers: TeamMember[]; query: string; setQuery: (value: string) => void; filter: Filter; setFilter: (value: Filter) => void; busy: string | null; onStatus: (member: TeamMember) => void; onRole: (member: TeamMember, next: TeamRole) => void; onPermissions: (member: TeamMember) => void; onRemove: (member: TeamMember) => void; policy: AccessSecurityPolicy; onPolicy: (key: keyof Omit<AccessSecurityPolicy, 'availableRoles'>) => void }) {
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,23rem)]">
    <section className="wf-surface overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-background-200/70 px-5 py-4"><div><h3 className="text-base font-bold text-foreground-950">Membros da equipe</h3><p className="mt-1 text-xs text-foreground-500">Gerencie acessos, dados privados e canais individuais com segurança.</p></div><span className="text-xs font-semibold text-foreground-500">{allMembers.length} membros</span></div>
      <div className="flex flex-col gap-2 border-b border-background-200/70 p-4 lg:flex-row"><label className="relative min-w-0 flex-1"><span className="sr-only">Buscar por nome ou e-mail</span><i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou e-mail" className="w-full rounded-xl border border-background-200 bg-background-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20" /></label><div className="flex flex-wrap gap-2">{([['all', 'Todos'], ['active', 'Ativos'], ['disabled', 'Suspensos']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setFilter(id)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${filter === id ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-background-200 text-foreground-600 hover:bg-background-50'}`}>{label}{id === 'active' && ` ${allMembers.filter((item) => item.status === 'active').length}`}</button>)}</div></div>
      {members.length === 0 ? <div className="p-12 text-center text-sm text-foreground-500"><i className="ri-user-search-line mb-2 block text-2xl" />Nenhum membro encontrado.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-background-50 text-[11px] uppercase tracking-wide text-foreground-500"><tr><th className="px-5 py-3 font-semibold">Membro</th><th className="px-3 py-3 font-semibold">Papel</th><th className="px-3 py-3 font-semibold">Escopo</th><th className="px-3 py-3 font-semibold">Segurança</th><th className="px-3 py-3 font-semibold">Atualização do vínculo</th><th className="px-3 py-3 font-semibold">Acesso</th><th className="px-4 py-3" aria-label="Mais ações" /></tr></thead><tbody className="divide-y divide-background-200/70">{members.map((member) => <tr key={member.userId} className="align-middle hover:bg-background-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-foreground-800">{member.name.charAt(0).toUpperCase()}</span><div><p className="text-sm font-semibold text-foreground-950">{member.name}</p><p className="mt-0.5 text-xs text-foreground-500">{member.email}</p></div></div></td><td className="px-3 py-4"><select aria-label={`Papel de ${member.name}`} disabled={busy === `role:${member.userId}`} value={member.role} onChange={(event) => onRole(member, event.target.value as TeamRole)} className="rounded-lg border border-background-200 bg-white px-2.5 py-2 text-xs font-semibold text-foreground-800 outline-none focus:border-primary-500">{roles.filter((role) => policy.availableRoles[role] || role === member.role).map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></td><td className="px-3 py-4 text-xs text-foreground-600">{roleScope[member.role]}</td><td className="px-3 py-4"><StatusPill tone="neutral">MFA não verificado</StatusPill></td><td className="whitespace-nowrap px-3 py-4 text-xs text-foreground-600">{formatDate(member.lastAccessAt)}</td><td className="px-3 py-4"><div className="flex items-center gap-2"><Switch label={`Acesso de ${member.name}`} enabled={member.status === 'active'} disabled={busy === `status:${member.userId}`} onChange={() => onStatus(member)} /><span className={`text-xs font-semibold ${member.status === 'active' ? 'text-secondary-800' : 'text-foreground-500'}`}>{member.status === 'active' ? 'Ativo' : member.status === 'invited' ? 'Convite pendente' : 'Desativado'}</span></div></td><td className="relative px-4 py-4 text-right"><button type="button" onClick={() => setOpenMenuFor(openMenuFor === member.userId ? null : member.userId)} className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" aria-label={`Mais ações de ${member.name}`} aria-expanded={openMenuFor === member.userId}><i className="ri-more-2-fill" /></button>{openMenuFor === member.userId && <div role="menu" aria-label={`Ações de ${member.name}`} className="absolute right-4 z-20 mt-1 w-56 rounded-xl border border-background-200 bg-white p-1.5 text-left shadow-lg"><button role="menuitem" type="button" onClick={() => { setOpenMenuFor(null); onPermissions(member); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground-800 hover:bg-background-50"><i className="ri-shield-user-line" />Permissões individuais</button><button role="menuitem" type="button" onClick={() => { setOpenMenuFor(null); onStatus(member); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground-800 hover:bg-background-50"><i className={member.status === 'active' ? 'ri-lock-line' : 'ri-lock-unlock-line'} />{member.status === 'active' ? 'Desativar acesso' : 'Reativar acesso'}</button><div className="my-1 border-t border-background-100" /><button role="menuitem" type="button" onClick={() => { setOpenMenuFor(null); onRemove(member); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-accent-700 hover:bg-accent-50"><i className="ri-delete-bin-6-line" />Excluir usuário</button></div>}</td></tr>)}</tbody></table></div>}
    </section>
    <aside className="space-y-4"><SecurityCard policy={policy} onToggle={onPolicy} busy={busy} /><div className="wf-surface p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-lg text-primary-700"><i className="ri-shield-check-line" /></span><div><h3 className="text-base font-bold text-foreground-950">Acesso seguro por padrão</h3><p className="mt-1 text-xs leading-5 text-foreground-500">Desativar preserva histórico, leads, orçamentos e autoria. O backend confirma e audita cada alteração.</p></div></div></div></aside>
  </div>;
}

function SecurityCard({ policy, onToggle, busy }: { policy: AccessSecurityPolicy; onToggle: (key: keyof Omit<AccessSecurityPolicy, 'availableRoles'>) => void; busy: string | null }) {
  const rows: Array<[keyof Omit<AccessSecurityPolicy, 'availableRoles'>, string, string, string]> = [['requireMfa', 'MFA obrigatório indisponível', 'Enrollment e validação AAL ainda não configurados; não há exigência aplicada.', 'Revisão de segurança'], ['revokeSessionsOnDisable', 'Bloqueio por vínculo ativo', 'A associação inativa bloqueia esta empresa. Sessões de outras empresas são preservadas.', 'Revogação de sessões'], ['quarterlyReview', 'Revisão trimestral de acesso', 'Registra intenção de revisão; não agenda nem envia lembretes.', 'Revisão trimestral']];
  return <section className="wf-surface overflow-hidden"><div className="border-b border-background-200/70 px-5 py-4"><h3 className="text-base font-bold text-foreground-950">Segurança de acesso</h3><p className="mt-1 text-xs text-foreground-500">Controle por empresa. MFA e revisão periódica não são garantias de enforcement.</p></div><div className="divide-y divide-background-200/70">{rows.map(([key, label, description, auditLabel]) => <div key={key} className="flex items-center gap-3 px-5 py-4"><i className="ri-shield-keyhole-line text-lg text-foreground-400" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground-900">{label}</p><p className="mt-1 text-xs leading-4 text-foreground-500">{description}</p><p className="mt-1 text-[11px] text-foreground-400">Audita: {auditLabel}</p></div><div className="flex items-center gap-2"><span className="hidden text-xs font-semibold text-foreground-600 sm:block">{key === 'requireMfa' ? 'Não configurado' : key === 'revokeSessionsOnDisable' ? 'Sempre aplicado' : policy[key] ? 'Intenção registrada' : 'Não solicitado'}</span><Switch label={label} enabled={key === 'requireMfa' ? false : key === 'revokeSessionsOnDisable' ? true : policy[key]} disabled={key === 'requireMfa' || key === 'revokeSessionsOnDisable' || busy === `policy:${key}`} onChange={() => onToggle(key)} /></div></div>)}</div><button type="button" className="m-4 w-[calc(100%-2rem)] rounded-xl border border-background-300 px-3 py-2.5 text-xs font-semibold text-foreground-800 hover:bg-background-50" onClick={() => onToggle('quarterlyReview')}><i className="ri-settings-3-line mr-2" />Configurar política</button></section>;
}

function Roles({ policy, busy, onToggle }: { policy: AccessSecurityPolicy; busy: string | null; onToggle: (role: TeamRole) => void }) {
  const [selected, setSelected] = useState<TeamRole>('vendedor');
  const permissions = rolePermissionPreview[selected];
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,23rem)]"><section className="wf-surface overflow-hidden"><div className="border-b border-background-200/70 px-5 py-4"><h3 className="text-base font-bold text-foreground-950">Papéis disponíveis</h3><p className="mt-1 text-xs text-foreground-500">O papel define a base; permissões individuais continuam auditáveis.</p></div><div className="divide-y divide-background-200/70">{roles.map((role) => <button key={role} type="button" onClick={() => setSelected(role)} className={`flex w-full items-center gap-3 px-5 py-4 text-left ${selected === role ? 'bg-primary-50/60' : 'hover:bg-background-50'}`}><span className="flex h-9 w-9 items-center justify-center rounded-full bg-background-100 text-sm font-bold text-foreground-700">{roleLabel[role].charAt(0)}</span><span className="min-w-0 flex-1"><strong className="block text-sm text-foreground-950">{roleLabel[role]}</strong><span className="mt-1 block text-xs text-foreground-500">{roleDescriptions[role]}</span></span><span className="flex items-center gap-2"><span className="text-xs font-semibold text-foreground-600">{policy.availableRoles[role] ? 'Ativo' : 'Desativado'}</span><Switch label={`Papel ${roleLabel[role]} disponível`} enabled={policy.availableRoles[role]} disabled={busy === `available:${role}`} onChange={() => onToggle(role)} /></span></button>)}</div></section><section className="wf-surface overflow-hidden"><div className="border-b border-background-200/70 px-5 py-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Prévia do papel</p><h3 className="mt-1 text-xl font-bold text-foreground-950">{roleLabel[selected]}</h3><p className="mt-1 text-xs text-foreground-500">{roleDescriptions[selected]}</p></div><div className="space-y-2 p-5">{teamPermissions.map((permission) => <div key={permission} className="flex items-center gap-2 text-sm"><i className={`${permissions.has(permission) ? 'ri-checkbox-circle-fill text-secondary-600' : 'ri-close-circle-fill text-accent-500'}`} aria-hidden="true" /><span className="flex-1 text-foreground-700">{teamPermissionLabel[permission]}</span><span className={`text-xs font-semibold ${permissions.has(permission) ? 'text-secondary-800' : 'text-accent-700'}`}>{permissions.has(permission) ? 'Permitido' : 'Bloqueado'}</span></div>)}</div><div className="border-t border-background-200/70 p-5"><p className="text-xs text-foreground-500">Escopo padrão: <strong className="text-foreground-800">{roleScope[selected]}</strong></p><p className="mt-3 rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-xs leading-5 text-foreground-600"><i className="ri-shield-user-line mr-2" />Para criar exceções de um usuário, abra os três pontos na lista de membros e escolha <strong>Permissões individuais</strong>.</p></div></section></div>;
}


function History({ audit, refresh }: { audit: AccessAuditEvent[]; refresh: () => void }) {
  return <section className="wf-surface overflow-hidden"><div className="flex items-start justify-between border-b border-background-200/70 px-5 py-4"><div><h3 className="text-base font-bold text-foreground-950">Atividade recente</h3><p className="mt-1 text-xs text-foreground-500">Papéis, acessos, políticas e sessões.</p></div><button type="button" className="wf-btn-secondary text-xs" onClick={refresh}><i className="ri-refresh-line" />Atualizar</button></div>{audit.length === 0 ? <div className="p-12 text-center text-sm text-foreground-500">Nenhuma alteração de acesso registrada.</div> : <div className="divide-y divide-background-200/70">{audit.map((event) => <div key={event.id} className="flex items-start gap-3 px-5 py-4"><span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700"><i className="ri-shield-check-line" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground-900">{event.detail || event.action}</p><p className="mt-1 text-xs text-foreground-500">Por {event.actorName} · {formatDate(event.occurredAt)}</p></div><span className="text-[11px] font-semibold text-secondary-700">Auditado</span></div>)}</div>}</section>;
}

type CreateAccessForm = { name: string; email: string; password: string; confirm: string; role: TeamRole };

function CreateAccessDialog({ form, setForm, busy, onClose, onSubmit, availableRoles }: { form: CreateAccessForm; setForm: (value: CreateAccessForm) => void; busy: boolean; onClose: () => void; onSubmit: () => void; availableRoles: Record<TeamRole, boolean> }) {
  const inputClass = 'mt-1.5 w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-primary-500';
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="create-member-title" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-background-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-start justify-between border-b border-background-200/70 px-5 py-4"><div><h3 id="create-member-title" className="font-heading font-bold text-foreground-950">Criar usuário</h3><p className="mt-1 text-xs text-foreground-500">Cadastre uma conta nova com papel e senha inicial. Uma conta já existente não será alterada.</p></div><button type="button" aria-label="Fechar" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={onClose}><i className="ri-close-line" /></button></header>
      <div className="space-y-4 p-5">
        <label className="block text-sm font-semibold text-foreground-800">Nome<input autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nome da pessoa" className={inputClass} /></label>
        <label className="block text-sm font-semibold text-foreground-800">E-mail de login<input type="email" autoComplete="off" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="email@empresa.com" className={inputClass} /></label>
        <label className="block text-sm font-semibold text-foreground-800">Papel<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as TeamRole })} className={inputClass}>{roles.filter((role) => availableRoles[role]).map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></label>
        <label className="block text-sm font-semibold text-foreground-800">Senha temporária<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="8 a 128 caracteres" className={inputClass} /></label>
        <label className="block text-sm font-semibold text-foreground-800">Confirmar senha<input type="password" autoComplete="new-password" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} className={inputClass} /></label>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Entregue a senha por um canal seguro e peça ao usuário para trocá-la após o primeiro acesso. Ela não é salva no CRM nem enviada por e-mail por esta ação.</p>
        {form.role === 'vendedor' && <p className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-xs leading-5 text-primary-900"><i className="ri-whatsapp-line mr-1" />O vínculo individual Evolution GO é agendado automaticamente ao criar o vendedor. A instância remota e o QR dependem da validação do servidor.</p>}
      </div>
      <footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" className="wf-btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={busy || !roles.some((role) => availableRoles[role])} onClick={onSubmit}>{busy ? 'Criando…' : 'Criar usuário'}</button></footer>
    </section>
  </div>;
}

function MemberPermissionsDialog({ member, permissions, setPermissions, busy, onClose, onSubmit }: { member: TeamMember; permissions: Record<TeamPermission, boolean>; setPermissions: (value: Record<TeamPermission, boolean>) => void; busy: boolean; onClose: () => void; onSubmit: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="member-permissions-title" className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-background-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="sticky top-0 flex items-start justify-between border-b border-background-200/70 bg-white px-5 py-4"><div><h3 id="member-permissions-title" className="font-heading font-bold text-foreground-950">Permissões de {member.name}</h3><p className="mt-1 text-xs text-foreground-500">O papel define a base. Administradores têm acesso total e não aceitam restrições por exceção.</p></div><button type="button" aria-label="Fechar" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={onClose}><i className="ri-close-line" /></button></header><div className="grid gap-2 p-5 sm:grid-cols-2">{teamPermissions.map((permission) => <label key={permission} className="flex cursor-pointer items-center gap-3 rounded-xl border border-background-200 p-3 text-sm text-foreground-800 hover:bg-background-50"><input type="checkbox" disabled={member.role === 'administrador'} checked={permissions[permission]} onChange={(event) => setPermissions({ ...permissions, [permission]: event.target.checked })} className="h-4 w-4 accent-primary-600" /><span>{teamPermissionLabel[permission]}</span></label>)}</div><footer className="sticky bottom-0 flex justify-end gap-2 border-t border-background-200/70 bg-white px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={busy || member.role === 'administrador'} onClick={onSubmit}>{busy ? 'Salvando…' : 'Salvar permissões'}</button></footer></section></div>;
}

function RemoveMemberDialog({ member, confirmation, setConfirmation, busy, onClose, onSubmit }: { member: TeamMember; confirmation: string; setConfirmation: (value: string) => void; busy: boolean; onClose: () => void; onSubmit: () => void }) {
  const valid = confirmation.trim().toUpperCase() === 'EXCLUIR';
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="remove-member-title" className="w-full max-w-md rounded-2xl border border-accent-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="flex items-start justify-between border-b border-background-200/70 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-accent-700">Exclusão definitiva</p><h3 id="remove-member-title" className="mt-1 font-heading font-bold text-foreground-950">Excluir {member.name}?</h3></div><button type="button" aria-label="Fechar" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={onClose}><i className="ri-close-line" /></button></header><div className="space-y-4 p-5"><p className="text-sm leading-6 text-foreground-700">O login, as sessões, permissões, arquivos privados e a instância individual Evolution GO serão excluídos. A conexão do celular será encerrada. A ação não pode ser desfeita.</p><p className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-xs leading-5 text-primary-900"><i className="ri-information-line mr-1" />Leads, contatos e conversas compartilhados da empresa permanecem; referências pessoais em auditoria são anonimizadas. A conta de canal antiga pode ficar arquivada sem credenciais para manter esse histórico.</p><p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"><i className="ri-shield-check-line mr-1" />A exclusão é bloqueada se este login também pertencer a outra empresa, se for o próprio usuário ou o último administrador ativo. Compromissos, repasses e histórico compartilhado precisam ser reatribuídos antes.</p><label className="block text-sm font-semibold text-foreground-800">Digite <strong>EXCLUIR</strong> para confirmar<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1.5 w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-accent-500" autoComplete="off" /></label></div><footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={!valid || busy} onClick={onSubmit}>{busy ? 'Excluindo…' : 'Excluir usuário'}</button></footer></section></div>;
}

function RoleChangeDialog({ pending, onClose, onConfirm, busy }: { pending: { member: TeamMember; next: TeamRole }; onClose: () => void; onConfirm: () => void; busy: boolean }) {
  const oldSet = rolePermissionPreview[pending.member.role];
  const nextSet = rolePermissionPreview[pending.next];
  const added = [...nextSet].filter((permission) => !oldSet.has(permission));
  const removed = [...oldSet].filter((permission) => !nextSet.has(permission));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="role-change-title" className="w-full max-w-lg rounded-2xl border border-background-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="border-b border-background-200/70 px-5 py-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Prévia antes de aplicar</p><h3 id="role-change-title" className="mt-1 text-lg font-bold text-foreground-950">Alterar papel de {pending.member.name}</h3><p className="mt-1 text-xs text-foreground-500">{roleLabel[pending.member.role]} → {roleLabel[pending.next]}</p></header><div className="grid gap-4 p-5 sm:grid-cols-2"><div><p className="text-xs font-semibold text-secondary-800">Permissões adicionadas ({added.length})</p><ul className="mt-2 space-y-1 text-xs text-foreground-600">{added.slice(0, 8).map((permission) => <li key={permission}><i className="ri-add-line mr-1 text-secondary-600" />{teamPermissionLabel[permission]}</li>)}</ul></div><div><p className="text-xs font-semibold text-accent-700">Permissões bloqueadas ({removed.length})</p><ul className="mt-2 space-y-1 text-xs text-foreground-600">{removed.slice(0, 8).map((permission) => <li key={permission}><i className="ri-subtract-line mr-1 text-accent-600" />{teamPermissionLabel[permission]}</li>)}</ul></div></div><footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={busy} onClick={onConfirm}>{busy ? 'Aplicando…' : 'Confirmar alteração'}</button></footer></section></div>;
}
