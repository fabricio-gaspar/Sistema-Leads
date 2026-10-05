import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { inviteTeamMember, loadDailyLeadReportSettings, loadHandoffWhatsappAlertSettings, loadTeamMemberPermissions, loadTeamMembers, removeTeamMember, roleLabel, saveDailyLeadReportSettings, saveHandoffWhatsappAlertSettings, saveTeamMemberPermissions, setTeamMemberStatus, teamPermissionLabel, teamPermissions, updateTeamRole, type DailyLeadReportSettings, type HandoffWhatsappAlertSettings, type TeamMember, type TeamPermission, type TeamRole } from '@/lib/crm/teamMembersRepository';
import WhatsappAccountPanel from '@/components/feature/WhatsappAccountPanel';

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
  member_self_deletion_protected: 'Você não pode excluir a própria conta por esta tela.',
  member_linked_to_another_organization: 'Esta conta também pertence a outra empresa e não pode ser apagada por aqui.',
  member_identity_deletion_failed: 'Não foi possível apagar a conta definitivamente. Nenhum acesso foi removido.',
  permission_denied: 'Seu usuário não possui a permissão necessária para esta ação.',
  permissions_required: 'Informe as permissões do membro antes de salvar.',
  invalid_permission_value: 'Uma das permissões informadas é inválida.',
  member_invite_conflict: 'Este e-mail possui um convite ativo para outra organização.',
  member_invitation_preparation_failed: 'Não foi possível preparar o vínculo com a Wayflex.',
  daily_report_enabled_required: 'Informe se o relatório diário deve ficar ativo.',
  daily_report_phone_required: 'Informe o WhatsApp que receberá o relatório diário.',
  invalid_daily_report_phone: 'Informe um telefone de WhatsApp válido com DDD.',
  invalid_daily_report_time: 'Informe um horário válido para o relatório diário.',
  invalid_daily_report_timezone: 'O fuso horário informado não é válido.',
  daily_report_settings_read_failed: 'Não foi possível consultar a configuração do relatório diário.',
  daily_report_settings_save_failed: 'Não foi possível salvar a configuração do relatório diário.',
  handoff_alert_phone_required: 'Informe o WhatsApp que receberá os avisos de transferência.',
  invalid_handoff_alert_phone: 'Informe um telefone de WhatsApp válido com DDD.',
  handoff_alert_settings_read_failed: 'Não foi possível consultar os avisos de transferência.',
  handoff_alert_settings_save_failed: 'Não foi possível salvar os avisos de transferência.',
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
  const [permissionMember, setPermissionMember] = useState<TeamMember | null>(null);
  const [memberPermissions, setMemberPermissions] = useState<Record<TeamPermission, boolean> | null>(null);
  const [dailyReportMember, setDailyReportMember] = useState<TeamMember | null>(null);
  const [dailyReportSettings, setDailyReportSettings] = useState<DailyLeadReportSettings | null>(null);
  const [dailyReportForm, setDailyReportForm] = useState({ enabled: false, phone: '', scheduleTime: '18:00', timezone: 'America/Sao_Paulo' });
  const [handoffAlertMember, setHandoffAlertMember] = useState<TeamMember | null>(null);
  const [handoffAlertSettings, setHandoffAlertSettings] = useState<HandoffWhatsappAlertSettings | null>(null);
  const [handoffAlertForm, setHandoffAlertForm] = useState({ enabled: false, phone: '' });
  const [whatsappMember, setWhatsappMember] = useState<TeamMember | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'vendedor' as TeamRole });

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
    if (!window.confirm(`Remover o vínculo de ${member.name} nesta empresa? A conta global, outras empresas e o histórico serão preservados.`)) return;
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
  const openPermissions = async (member: TeamMember) => {
    setBusy(member.userId);
    try {
      const result = await loadTeamMemberPermissions(member.userId);
      setMemberPermissions(result.permissions);
      setPermissionMember(member);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(null); }
  };
  const savePermissions = async () => {
    if (!permissionMember || !memberPermissions) return;
    setBusy(permissionMember.userId);
    try {
      await saveTeamMemberPermissions(permissionMember.userId, memberPermissions);
      setPermissionMember(null);
      setMemberPermissions(null);
      setError('');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(null); }
  };
  const openDailyReport = async (member: TeamMember) => {
    setBusy(member.userId);
    try {
      const settings = await loadDailyLeadReportSettings(member.userId);
      setDailyReportSettings(settings);
      setDailyReportForm({ enabled: settings.enabled, phone: '', scheduleTime: settings.scheduleTime, timezone: settings.timezone });
      setDailyReportMember(member);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(null); }
  };
  const saveDailyReport = async () => {
    if (!dailyReportMember) return;
    setBusy(dailyReportMember.userId);
    try {
      const settings = await saveDailyLeadReportSettings(dailyReportMember.userId, dailyReportForm);
      setDailyReportSettings(settings);
      setDailyReportMember(null);
      setError('');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(null); }
  };
  const openHandoffAlert = async (member: TeamMember) => {
    setBusy(member.userId);
    try {
      const settings = await loadHandoffWhatsappAlertSettings(member.userId);
      setHandoffAlertSettings(settings); setHandoffAlertForm({ enabled: settings.enabled, phone: '' }); setHandoffAlertMember(member);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(null); }
  };
  const saveHandoffAlert = async () => {
    if (!handoffAlertMember) return;
    setBusy(handoffAlertMember.userId);
    try {
      await saveHandoffWhatsappAlertSettings(handoffAlertMember.userId, handoffAlertForm);
      setHandoffAlertMember(null); setHandoffAlertSettings(null); setError('');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(null); }
  };

  return <div className="space-y-5">
    {error && <div className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800">{error}</div>}
    <section className="wf-surface cc-team overflow-hidden">
      <div className="cc-team-header">
        <div>
          <p className="cc-settings-kicker">Acessos reais</p>
          <h2>Equipe e permissões</h2>
          <p>Gerencie papéis, canais e avisos de cada pessoa.</p>
        </div>
        <div className="cc-team-header-actions">
          {!loading && <span className="cc-team-count">{members.length} {members.length === 1 ? 'pessoa' : 'pessoas'}</span>}
          <button type="button" onClick={() => setInviteOpen(true)} className="wf-btn-primary"><i className="ri-mail-add-line" aria-hidden="true" />Convidar membro</button>
        </div>
      </div>
      {loading ? (
        <p className="cc-team-message" role="status">Carregando usuários…</p>
      ) : members.length === 0 ? (
        <div className="cc-team-empty"><i className="ri-team-line" aria-hidden="true" /><strong>Nenhum usuário nesta empresa</strong><span>Crie um acesso ou convide uma pessoa para começar.</span></div>
      ) : (
        <div className="cc-team-grid">
          {members.map((member) => (
            <article key={member.userId} className="cc-team-card">
              <div className="cc-team-person">
                <span className="cc-team-avatar" aria-hidden="true">{member.name.charAt(0).toUpperCase()}</span>
                <div className="cc-team-person-name"><h3>{member.name}</h3><p>{member.email}</p></div>
                <span className={`cc-team-status ${member.status === 'active' ? 'is-active' : ''}`}><i className="ri-circle-fill" aria-hidden="true" />{member.status === 'active' ? 'Ativo' : 'Bloqueado'}</span>
              </div>
              <div className="cc-team-card-main">
                <label>Papel
                  <select aria-label={`Papel de ${member.name}`} disabled={busy === member.userId} value={member.role} onChange={(event) => void changeRole(member, event.target.value as TeamRole)}>
                    {roles.map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}
                  </select>
                </label>
                <button type="button" disabled={busy === member.userId} onClick={() => void openPermissions(member)} className="cc-team-permission"><i className="ri-shield-user-line" aria-hidden="true" />Permissões<i className="ri-arrow-right-line" aria-hidden="true" /></button>
              </div>
              <details className="cc-team-more">
                <summary>Mais ações <i className="ri-arrow-down-s-line" aria-hidden="true" /></summary>
                <div className="cc-team-more-grid">
                  <button type="button" disabled={busy === member.userId} onClick={() => setWhatsappMember(member)}><i className="ri-whatsapp-line" aria-hidden="true" />WhatsApp operacional</button>
                  <button type="button" disabled={busy === member.userId} onClick={() => void openHandoffAlert(member)}><i className="ri-user-shared-line" aria-hidden="true" />Aviso de transferência</button>
                  <button type="button" disabled={busy === member.userId} onClick={() => void openDailyReport(member)}><i className="ri-file-chart-line" aria-hidden="true" />Relatório diário</button>
                  <button type="button" disabled={busy === member.userId} onClick={() => void changeStatus(member)}><i className={member.status === 'active' ? 'ri-lock-line' : 'ri-lock-unlock-line'} aria-hidden="true" />{member.status === 'active' ? 'Bloquear' : 'Liberar'}</button>
                  <button type="button" disabled={busy === member.userId} onClick={() => void remove(member)} className="is-danger"><i className="ri-delete-bin-line" aria-hidden="true" />Remover</button>
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
    {inviteOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={() => setInviteOpen(false)}><section className="w-full max-w-md rounded-2xl border border-background-200 bg-background-50 shadow-xl" onClick={(event) => event.stopPropagation()}><header className="flex items-center justify-between border-b border-background-200/70 px-5 py-4"><div><h3 className="font-heading font-bold text-foreground-950">Convidar membro</h3><p className="mt-0.5 text-xs text-foreground-500">O convite é enviado para o e-mail informado.</p></div><button type="button" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={() => setInviteOpen(false)} aria-label="Fechar"><i className="ri-close-line" /></button></header><div className="space-y-4 p-5"><Field label="Nome"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nome da pessoa" /></Field><Field label="E-mail"><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="email@empresa.com" /></Field><Field label="Papel"><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as TeamRole })}>{roles.map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></Field></div><footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={() => setInviteOpen(false)}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={busy === 'invite'} onClick={() => void invite()}>{busy === 'invite' ? 'Enviando…' : 'Enviar convite'}</button></footer></section></div>}
    {permissionMember && memberPermissions && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={() => { setPermissionMember(null); setMemberPermissions(null); }}><section className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-background-200 bg-background-50 shadow-xl" onClick={(event) => event.stopPropagation()}><header className="flex items-center justify-between border-b border-background-200/70 px-5 py-4"><div><h3 className="font-heading font-bold text-foreground-950">Permissões de {permissionMember.name}</h3><p className="mt-0.5 text-xs text-foreground-500">O papel define a base; estes controles registram as permissões individuais efetivas.</p></div><button type="button" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={() => { setPermissionMember(null); setMemberPermissions(null); }} aria-label="Fechar"><i className="ri-close-line" /></button></header><div className="grid gap-2 p-5 sm:grid-cols-2">{teamPermissions.map((permission) => <label key={permission} className="flex cursor-pointer items-center gap-3 rounded-xl border border-background-200 p-3 text-sm text-foreground-800 hover:bg-background-100"><input type="checkbox" checked={memberPermissions[permission]} onChange={(event) => setMemberPermissions({ ...memberPermissions, [permission]: event.target.checked })} className="h-4 w-4 accent-primary-600" /><span>{teamPermissionLabel[permission]}</span></label>)}</div><footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={() => { setPermissionMember(null); setMemberPermissions(null); }}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={busy === permissionMember.userId} onClick={() => void savePermissions()}>{busy === permissionMember.userId ? 'Salvando…' : 'Salvar permissões'}</button></footer></section></div>}
    {dailyReportMember && dailyReportSettings && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={() => setDailyReportMember(null)}><section className="w-full max-w-lg rounded-2xl border border-background-200 bg-background-50 shadow-xl" onClick={(event) => event.stopPropagation()}><header className="flex items-center justify-between border-b border-background-200/70 px-5 py-4"><div><h3 className="font-heading font-bold text-foreground-950">Relatório diário de {dailyReportMember.name}</h3><p className="mt-0.5 text-xs leading-5 text-foreground-500">O servidor envia apenas um resumo consolidado no horário escolhido. Nenhum lead ou mensagem é enviado por este recurso.</p></div><button type="button" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={() => setDailyReportMember(null)} aria-label="Fechar"><i className="ri-close-line" /></button></header><div className="space-y-4 p-5"><label className="flex items-start gap-3 rounded-xl border border-background-200 p-3 text-sm text-foreground-800"><input type="checkbox" checked={dailyReportForm.enabled} onChange={(event) => setDailyReportForm({ ...dailyReportForm, enabled: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary-600" /><span><strong className="block">Enviar resumo diário pelo WhatsApp</strong><span className="mt-1 block text-xs leading-5 text-foreground-500">Permanece desligado até esta opção ser marcada e o telefone ser salvo.</span></span></label><Field label={`WhatsApp de destino${dailyReportSettings.phoneSuffix ? ` atual: ${dailyReportSettings.phoneSuffix}` : ''}`}><input inputMode="tel" value={dailyReportForm.phone} onChange={(event) => setDailyReportForm({ ...dailyReportForm, phone: event.target.value })} placeholder={dailyReportSettings.phoneSuffix ? 'Informe outro número somente se quiser alterar' : '(11) 99999-9999'} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Horário"><input type="time" value={dailyReportForm.scheduleTime} onChange={(event) => setDailyReportForm({ ...dailyReportForm, scheduleTime: event.target.value })} /></Field><Field label="Fuso horário"><input value={dailyReportForm.timezone} onChange={(event) => setDailyReportForm({ ...dailyReportForm, timezone: event.target.value })} /></Field></div>{dailyReportSettings.lastStatus && <div className="rounded-xl bg-background-100 px-3 py-2.5 text-xs text-foreground-600">Última execução: <strong>{dailyReportSettings.lastStatus}</strong>{dailyReportSettings.lastSentAt ? ` em ${new Date(dailyReportSettings.lastSentAt).toLocaleString('pt-BR')}` : ''}{dailyReportSettings.lastError ? ` · ${dailyReportSettings.lastError}` : ''}</div>}</div><footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={() => setDailyReportMember(null)}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={busy === dailyReportMember.userId} onClick={() => void saveDailyReport()}>{busy === dailyReportMember.userId ? 'Salvando…' : 'Salvar relatório'}</button></footer></section></div>}
    {handoffAlertMember && handoffAlertSettings && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={() => setHandoffAlertMember(null)}><section className="w-full max-w-lg rounded-2xl border border-background-200 bg-background-50 shadow-xl" onClick={(event) => event.stopPropagation()}><header className="flex items-center justify-between border-b border-background-200/70 px-5 py-4"><div><h3 className="font-heading font-bold text-foreground-950">Aviso de transferência — {handoffAlertMember.name}</h3><p className="mt-0.5 text-xs leading-5 text-foreground-500">O vendedor recebe um aviso interno quando a Ana transferir um lead configurado para ele.</p></div><button type="button" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={() => setHandoffAlertMember(null)} aria-label="Fechar"><i className="ri-close-line" /></button></header><div className="space-y-4 p-5"><label className="flex items-start gap-3 rounded-xl border border-background-200 p-3 text-sm text-foreground-800"><input type="checkbox" checked={handoffAlertForm.enabled} onChange={(event) => setHandoffAlertForm({ ...handoffAlertForm, enabled: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary-600" /><span><strong className="block">Avisar pelo WhatsApp</strong><span className="mt-1 block text-xs leading-5 text-foreground-500">Permanece desligado até este número interno ser salvo.</span></span></label><Field label={`WhatsApp de destino${handoffAlertSettings.phoneSuffix ? ` atual: ${handoffAlertSettings.phoneSuffix}` : ''}`}><input inputMode="tel" value={handoffAlertForm.phone} onChange={(event) => setHandoffAlertForm({ ...handoffAlertForm, phone: event.target.value })} placeholder={handoffAlertSettings.phoneSuffix ? 'Informe outro número somente se quiser alterar' : '(11) 99999-9999'} /></Field></div><footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={() => setHandoffAlertMember(null)}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={busy === handoffAlertMember.userId} onClick={() => void saveHandoffAlert()}>{busy === handoffAlertMember.userId ? 'Salvando…' : 'Salvar aviso'}</button></footer></section></div>}
    {whatsappMember && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/45 p-4" onClick={() => setWhatsappMember(null)}><section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-background-200 bg-background-50 shadow-xl" onClick={(event) => event.stopPropagation()}><header className="sticky top-0 z-10 flex items-center justify-between border-b border-background-200/70 bg-background-50 px-5 py-4"><div><h3 className="font-heading font-bold text-foreground-950">Conta operacional do usuário</h3><p className="mt-0.5 text-xs text-foreground-500">A conta corporativa permanece como fallback seguro.</p></div><button type="button" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={() => setWhatsappMember(null)} aria-label="Fechar"><i className="ri-close-line" /></button></header><div className="p-5"><WhatsappAccountPanel member={whatsappMember} /></div></section></div>}
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-semibold text-foreground-700"><span className="mb-1.5 block">{label}</span><span className="block [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-background-200 [&_input]:bg-background-100 [&_input]:px-3.5 [&_input]:py-2.5 [&_input]:text-sm [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-background-200 [&_select]:bg-background-100 [&_select]:px-3.5 [&_select]:py-2.5 [&_select]:text-sm">{children}</span></label>;
}
