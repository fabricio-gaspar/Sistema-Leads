import { useEffect, useMemo, useState } from 'react';
import {
  approveAnaOperationRun,
  loadAnaOperation,
  runAnaOperationNow,
  saveAnaOperation,
  simulateAnaOperation,
  type AnaHandoffStage,
  type AnaOperationMode,
  type AnaOperationRun,
  type AnaOperationSettings,
} from '@/lib/crm/anaOperationRepository';
import { validateAnaOperationForActivation, type AnaOperationField } from '@/lib/crm/anaOperationValidation';
import { loadTeamMembers, type TeamMember } from '@/lib/crm/teamMembersRepository';
import { loadOperationalStatus, setOperationalKillSwitch } from '@/lib/crm/operationalDiagnosticsRepository';

const DAYS = [{ id: 1, label: 'Seg' }, { id: 2, label: 'Ter' }, { id: 3, label: 'Qua' }, { id: 4, label: 'Qui' }, { id: 5, label: 'Sex' }, { id: 6, label: 'Sáb' }, { id: 0, label: 'Dom' }];
const HANDOFF_STAGES: Array<{ id: AnaHandoffStage; label: string }> = [
  { id: 'novo', label: 'Novo' }, { id: 'apresentado', label: 'Apresentado' }, { id: 'qualificando', label: 'Qualificando' },
  { id: 'reuniao', label: 'Reunião' }, { id: 'orcamento', label: 'Orçamento' },
];
const DEFAULTS: AnaOperationSettings = {
  enabled: false, mode: 'simulation', name: 'Operação diária da Ana', timezone: 'America/Sao_Paulo', weekdays: [1, 2, 3, 4, 5], runTime: '09:00',
  dailyLeadLimit: 20, dailyCap: 50, monthlyCap: 500, minimumFitScore: 70, assignmentStrategy: 'owner',
  initialAssignmentMode: 'ana', initialAssigneeUserId: null, teamMemberIds: [], handoffStage: null, handoffAssigneeUserId: null, handoffNotifyWhatsapp: false,
  regions: [], segments: [], keywords: [], requireWebsite: true, requireWhatsapp: true, requireEmail: false,
  paidProspectingApproved: false, notifyImmediate: true, notifyProgress: true, digestEnabled: true, digestTime: '18:00',
};
const MODE_COPY: Record<AnaOperationMode, { title: string; text: string; icon: string }> = {
  simulation: { title: 'Simulação', text: 'Valida a rotina e registra o plano sem chamar Apify, IA ou canais.', icon: 'ri-flask-line' },
  supervised: { title: 'Supervisionado', text: 'Prepara a execução e aguarda aprovação antes de prospectar.', icon: 'ri-user-follow-line' },
  automatic: { title: 'Automático', text: 'Executa a rotina somente quando todas as conexões e proteções estiverem comprovadas.', icon: 'ri-robot-2-line' },
};
const FIELD_LABEL: Record<AnaOperationField, string> = {
  runTime: 'Horário diário', timezone: 'Fuso horário', weekdays: 'Dias da semana', dailyLeadLimit: 'Leads por busca', dailyCap: 'Limite diário', monthlyCap: 'Limite mensal',
  paidProspectingApproved: 'Autorização de uso do Apify', initialAssigneeUserId: 'Vendedor responsável', teamMemberIds: 'Equipe do rodízio', handoffAssigneeUserId: 'Vendedor da transferência',
};
type ReadinessKey = 'company' | 'realEnvironment' | 'anaConfiguration' | 'ai' | 'apify' | 'scheduler' | 'whatsappOutbound' | 'whatsappInbound' | 'killSwitchOff';
interface ReadinessItem {
  key: ReadinessKey;
  label: string;
  pendingDetail: string;
  actionLabel: string;
  href?: string;
}
const READINESS_ITEMS: ReadinessItem[] = [
  { key: 'company', label: 'Empresa ativa', pendingDetail: 'O cadastro operacional da empresa ainda não está ativo.', actionLabel: 'Revisar empresa', href: '/dashboard/configuracoes?tab=operacao#real-environment' },
  { key: 'realEnvironment', label: 'Ambiente real', pendingDetail: 'A preparação segura do Ambiente Real ainda não foi concluída.', actionLabel: 'Preparar ambiente', href: '/dashboard/configuracoes?tab=operacao#real-environment' },
  { key: 'anaConfiguration', label: 'Configuração publicada', pendingDetail: 'Publique a política da Ana na etapa Canais e publicar.', actionLabel: 'Publicar configuração', href: '/dashboard/configuracoes?tab=ana&section=behavior&step=5' },
  { key: 'ai', label: 'IA', pendingDetail: 'A IA precisa estar configurada, validada e ativa.', actionLabel: 'Configurar IA', href: '/dashboard/configuracoes?tab=apis#ai-configuration' },
  { key: 'apify', label: 'Apify', pendingDetail: 'O Apify precisa estar configurado, validado e ativo para a busca.', actionLabel: 'Configurar Apify', href: '/dashboard/configuracoes?tab=apis#prospecting-providers' },
  { key: 'scheduler', label: 'Agendador', pendingDetail: 'O worker 24/7 ainda não confirmou o processamento das rotinas.', actionLabel: 'Preparar worker', href: '/dashboard/configuracoes?tab=operacao&setup=worker#scheduler-setup' },
  { key: 'whatsappOutbound', label: 'WhatsApp de saída', pendingDetail: 'Valide e ative a conta corporativa Evolution GO usada para enviar mensagens.', actionLabel: 'Validar Evolution GO', href: '/dashboard/configuracoes?tab=canais#evolution-go-configuration' },
  { key: 'whatsappInbound', label: 'WhatsApp de entrada', pendingDetail: 'Cadastre a entrada e confirme um callback real de um lead conhecido.', actionLabel: 'Concluir entrada', href: '/dashboard/configuracoes?tab=operacao&setup=whatsapp-webhook#whatsapp-inbound' },
  { key: 'killSwitchOff', label: 'Pausa global desligada', pendingDetail: 'A pausa global está ligada e bloqueia todas as automações.', actionLabel: 'Retomar automações' },
];
const textList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const split = (value: string) => [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))];
const clock = (value: unknown, fallback: string) => typeof value === 'string' ? value.slice(0, 5) : fallback;
const asId = (value: unknown) => typeof value === 'string' && value ? value : null;
const formatDate = (value: unknown) => typeof value === 'string' ? new Date(value).toLocaleString('pt-BR') : 'Ainda não executada';

export default function AnaAutomaticOperation() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [runs, setRuns] = useState<AnaOperationRun[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [automaticReady, setAutomaticReady] = useState(false);
  const [killSwitch, setKillSwitch] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [scheduleTimes, setScheduleTimes] = useState({ lastRunAt: null as string | null, nextRunAt: null as string | null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AnaOperationField, string>>>({});

  const hydrate = async () => {
    setLoading(true); setError('');
    try {
      const [snapshot, operational, team] = await Promise.all([loadAnaOperation(), loadOperationalStatus(), loadTeamMembers()]);
      const schedule = snapshot.schedule || {};
      const filters = (schedule.filters && typeof schedule.filters === 'object' ? schedule.filters : {}) as Record<string, unknown>;
      const assignment = schedule.initial_assignment_mode === 'human' || schedule.initial_assignment_mode === 'team' ? schedule.initial_assignment_mode : 'ana';
      setSettings({
        ...DEFAULTS,
        enabled: snapshot.company?.ana_operation_enabled === true,
        mode: snapshot.company?.ana_operation_mode || 'simulation',
        name: String(schedule.name || DEFAULTS.name), timezone: String(schedule.timezone || DEFAULTS.timezone),
        weekdays: Array.isArray(schedule.weekdays) ? schedule.weekdays.map(Number) : DEFAULTS.weekdays,
        runTime: clock(schedule.run_time, DEFAULTS.runTime), dailyLeadLimit: Number(schedule.quantity || DEFAULTS.dailyLeadLimit),
        dailyCap: Number(schedule.daily_cap || DEFAULTS.dailyCap), monthlyCap: Number(schedule.monthly_cap || DEFAULTS.monthlyCap),
        minimumFitScore: Number(schedule.auto_approve_min_score ?? DEFAULTS.minimumFitScore),
        assignmentStrategy: (schedule.assignment_strategy as AnaOperationSettings['assignmentStrategy']) || 'owner',
        initialAssignmentMode: assignment,
        initialAssigneeUserId: asId(schedule.initial_assignee_user_id), teamMemberIds: textList(schedule.team_member_ids),
        handoffStage: HANDOFF_STAGES.some((stage) => stage.id === schedule.handoff_stage) ? schedule.handoff_stage as AnaHandoffStage : null,
        handoffAssigneeUserId: asId(schedule.handoff_assignee_user_id), handoffNotifyWhatsapp: schedule.handoff_notify_whatsapp === true,
        regions: textList(filters.estados), segments: textList(filters.segmentos), keywords: textList(filters.atividades),
        requireWebsite: filters.exigeSite !== false, requireWhatsapp: filters.exigeWhatsApp !== false, requireEmail: filters.exigeEmail === true,
        paidProspectingApproved: schedule.paid_prospecting_approved === true, notifyImmediate: schedule.notify_immediate !== false,
        notifyProgress: schedule.notify_progress !== false, digestEnabled: schedule.digest_enabled !== false, digestTime: clock(schedule.digest_time, DEFAULTS.digestTime),
      });
      setRuns(snapshot.runs); setChecks(snapshot.readiness.checks); setAutomaticReady(snapshot.readiness.automaticReady);
      setKillSwitch(Boolean(operational.killSwitch)); setMembers(team.filter((member) => member.status === 'active'));
      setScheduleTimes({ lastRunAt: asId(schedule.last_run_at), nextRunAt: asId(schedule.next_run_at) });
    } catch { setError('Não foi possível confirmar a configuração operacional da Ana.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void hydrate(); }, []);

  const readinessItems = useMemo(() => READINESS_ITEMS, []);
  const pendingReadiness = useMemo(() => readinessItems.filter((item) => checks[item.key] !== true), [checks, readinessItems]);
  const focusReadiness = (key: ReadinessKey) => {
    window.requestAnimationFrame(() => document.getElementById(`ana-readiness-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  const update = <K extends keyof AnaOperationSettings>(key: K, value: AnaOperationSettings[K]) => {
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setSettings((current) => ({ ...current, [key]: value }));
  };
  const memberName = (id: string | null) => members.find((member) => member.userId === id)?.name || 'Não definido';
  const showFieldError = (field: AnaOperationField) => fieldErrors[field] ? <p className="mt-1 text-xs text-accent-700">{fieldErrors[field]}</p> : null;
  const changeAssignment = (mode: AnaOperationSettings['initialAssignmentMode']) => {
    update('initialAssignmentMode', mode);
    if (mode !== 'ana') { update('handoffStage', null); update('handoffAssigneeUserId', null); update('handoffNotifyWhatsapp', false); }
  };

  const save = async (activate: boolean) => {
    const candidate = { ...settings, enabled: activate };
    setError(''); setMessage(''); setFieldErrors({});
    if (activate) {
      const issues = validateAnaOperationForActivation(candidate);
      if (issues.length) {
        setFieldErrors(Object.fromEntries(issues.map((issue) => [issue.field, issue.message])));
        setError(`Revise ${issues.map((issue) => FIELD_LABEL[issue.field]).join(', ')} antes de ativar.`);
        return;
      }
      if (candidate.mode === 'automatic' && !automaticReady) {
        const firstPending = pendingReadiness[0];
        setError(`Não foi possível ativar: ${pendingReadiness.length} ${pendingReadiness.length === 1 ? 'pré-requisito está pendente' : 'pré-requisitos estão pendentes'}${firstPending ? `. Comece por “${firstPending.label}”` : ''}.`);
        if (firstPending) focusReadiness(firstPending.key);
        return;
      }
    }
    setBusy(activate ? 'activate' : 'draft');
    try {
      await saveAnaOperation(candidate);
      setMessage(activate ? `${MODE_COPY[candidate.mode].title} ativado com a rota de atendimento selecionada.` : 'Rascunho salvo. Nenhuma rotina foi ativada.');
      await hydrate();
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : 'ana_operation_save_failed';
      const serverMessage: Record<string, string> = {
        automatic_mode_not_ready: 'O modo automático ainda não está apto. Veja os pré-requisitos pendentes.',
        paid_prospecting_approval_required: 'Confirme o uso do Apify dentro dos limites configurados.',
        operation_assignment_member_required: 'Selecione um usuário ativo que possa atender conversas.',
        operation_assignment_member_cannot_reply: 'O usuário selecionado não possui permissão para atender conversas.',
        operation_handoff_recipient_required: 'Selecione quem assumirá a transferência da Ana.',
        operation_handoff_whatsapp_not_configured: 'O aviso por WhatsApp exige que o número do usuário esteja configurado em Usuários.',
        schedule_not_saved: 'Não foi possível gravar a agenda da Ana. A configuração anterior foi preservada.',
      };
      setError(serverMessage[code] || 'Não foi possível salvar a operação. Os dados atuais não foram ativados.');
    } finally { setBusy(''); }
  };
  const simulate = async () => {
    setBusy('simulate'); setError(''); setMessage('');
    try { const result = await simulateAnaOperation(); setRuns((current) => [result.run, ...current]); setMessage('Simulação registrada sem chamar Apify, IA ou WhatsApp.'); }
    catch { setError('Não foi possível registrar a simulação.'); }
    finally { setBusy(''); }
  };
  const runNow = async () => {
    setBusy('run'); setError(''); setMessage('');
    try { const result = await runAnaOperationNow(); setRuns((current) => [result.run, ...current]); setMessage(settings.mode === 'supervised' ? 'Execução preparada e aguardando aprovação.' : 'Execução colocada na fila auditável.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível executar.'); }
    finally { setBusy(''); }
  };
  const approve = async (id: string) => {
    setBusy(id); setError('');
    try { const result = await approveAnaOperationRun(id); setRuns((current) => current.map((item) => item.id === id ? result.run : item)); setMessage('Execução aprovada e colocada na fila auditável.'); }
    catch { setError('Não foi possível aprovar a execução.'); }
    finally { setBusy(''); }
  };
  const pauseAll = async () => {
    setBusy('pause'); setError('');
    try {
      const status = await setOperationalKillSwitch(!killSwitch);
      const nextKillSwitch = Boolean(status.killSwitch);
      setKillSwitch(nextKillSwitch);
      setChecks((current) => {
        const next = { ...current, killSwitchOff: !nextKillSwitch };
        setAutomaticReady(Object.values(next).every(Boolean));
        return next;
      });
      setMessage(nextKillSwitch ? 'Toda automação foi pausada.' : 'Pausa global removida.');
    }
    catch { setError('Não foi possível alterar a pausa global.'); }
    finally { setBusy(''); }
  };

  if (loading) return <div className="wf-surface p-6 text-sm text-foreground-500">Carregando operação automática…</div>;
  return <div className="space-y-5">
    <section className="wf-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="wf-eyebrow">Configurações · Ana</p><h2 className="mt-1 text-xl font-semibold text-foreground-950">Operação automática</h2><p className="mt-1 max-w-3xl text-sm text-foreground-500">Uma agenda única busca, qualifica e encaminha leads. O destino de cada lead fica explícito antes da ativação.</p></div><button type="button" onClick={pauseAll} disabled={Boolean(busy)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${killSwitch ? 'bg-primary-600 text-white' : 'border border-accent-300 bg-accent-50 text-accent-700'}`}><i className={`${killSwitch ? 'ri-play-line' : 'ri-stop-circle-line'} mr-2`} />{killSwitch ? 'Retomar automações' : 'Pausar tudo'}</button></div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">{(Object.keys(MODE_COPY) as AnaOperationMode[]).map((mode) => <button type="button" key={mode} onClick={() => update('mode', mode)} className={`rounded-xl border p-4 text-left ${settings.mode === mode ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-background-200 bg-white'}`}><i className={`${MODE_COPY[mode].icon} text-xl text-primary-600`} /><strong className="ml-2 text-foreground-900">{MODE_COPY[mode].title}</strong><p className="mt-2 text-sm leading-5 text-foreground-500">{MODE_COPY[mode].text}</p></button>)}</div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 rounded-lg bg-background-100 p-3 text-sm text-foreground-600"><span><i className="ri-time-line mr-1 text-primary-600" />Próxima: {formatDate(scheduleTimes.nextRunAt)}</span><span><i className="ri-history-line mr-1 text-primary-600" />Última: {formatDate(scheduleTimes.lastRunAt)}</span><span className={settings.enabled ? 'text-primary-700' : 'text-foreground-600'}><i className={`${settings.enabled ? 'ri-checkbox-circle-fill' : 'ri-draft-line'} mr-1`} />{settings.enabled ? 'Rotina ativa' : 'Rascunho inativo'}</span></div>
      {settings.mode === 'automatic' && !automaticReady && <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"><div><strong className="block">{pendingReadiness.length} {pendingReadiness.length === 1 ? 'pendência impede' : 'pendências impedem'} a ativação</strong><span className="mt-0.5 block text-xs leading-5 text-amber-800">{pendingReadiness.map((item) => item.label).join(' · ')}</span></div>{pendingReadiness[0] && <button type="button" onClick={() => focusReadiness(pendingReadiness[0].key)} className="shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-2 text-xs font-semibold text-amber-900">Ver o que falta</button>}</div>}
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <div className="space-y-5">
        <section className="wf-surface p-5"><h3 className="font-semibold text-foreground-900">Agenda e limites da prospecção</h3><p className="mt-1 text-sm text-foreground-500">Define quando a busca é executada. O horário de envio das mensagens continua sendo o horário comercial publicado da Ana.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm">Horário diário<input className="mt-1 w-full" type="time" value={settings.runTime} onChange={(event) => update('runTime', event.target.value)} />{showFieldError('runTime')}</label><label className="text-sm">Fuso horário<input className="mt-1 w-full" value={settings.timezone} onChange={(event) => update('timezone', event.target.value)} />{showFieldError('timezone')}</label></div>
          <div className="mt-4"><span className="text-sm">Dias da semana</span><div className="mt-2 flex flex-wrap gap-2">{DAYS.map((day) => <button type="button" key={day.id} onClick={() => update('weekdays', settings.weekdays.includes(day.id) ? settings.weekdays.filter((item) => item !== day.id) : [...settings.weekdays, day.id])} className={`rounded-lg border px-3 py-2 text-sm ${settings.weekdays.includes(day.id) ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-background-200'}`}>{day.label}</button>)}</div>{showFieldError('weekdays')}</div>
          <div className="mt-4 grid gap-4 md:grid-cols-3"><label className="text-sm">Leads por busca<input className="mt-1 w-full" type="number" min="1" max="100" value={settings.dailyLeadLimit} onChange={(event) => update('dailyLeadLimit', Number(event.target.value))} />{showFieldError('dailyLeadLimit')}</label><label className="text-sm">Limite diário<input className="mt-1 w-full" type="number" min="1" value={settings.dailyCap} onChange={(event) => update('dailyCap', Number(event.target.value))} />{showFieldError('dailyCap')}</label><label className="text-sm">Limite mensal<input className="mt-1 w-full" type="number" min="1" value={settings.monthlyCap} onChange={(event) => update('monthlyCap', Number(event.target.value))} />{showFieldError('monthlyCap')}</label></div>
          <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm">Segmentos<textarea className="mt-1 w-full" value={settings.segments.join(', ')} onChange={(event) => update('segments', split(event.target.value))} placeholder="Alimentos, logística, embalagem" /></label><label className="text-sm">Regiões<textarea className="mt-1 w-full" value={settings.regions.join(', ')} onChange={(event) => update('regions', split(event.target.value))} placeholder="SP, PR, SC" /></label></div>
          <label className="mt-4 block text-sm">Palavras-chave e atividades<textarea className="mt-1 w-full" value={settings.keywords.join(', ')} onChange={(event) => update('keywords', split(event.target.value))} placeholder="esteiras, transportadores, correias" /></label>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">{([['requireWebsite', 'Exigir site'], ['requireWhatsapp', 'Exigir WhatsApp'], ['requireEmail', 'Exigir e-mail']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-background-200 p-3 text-sm"><input type="checkbox" checked={settings[key]} onChange={(event) => update(key, event.target.checked)} />{label}</label>)}</div>
          <label className="mt-4 block text-sm">Fit mínimo para aprovação<input className="mt-1 w-full" type="number" min="0" max="100" value={settings.minimumFitScore} onChange={(event) => update('minimumFitScore', Number(event.target.value))} /></label>
        </section>

        <section className="wf-surface p-5"><h3 className="font-semibold text-foreground-900">Quem assume os leads encontrados?</h3><p className="mt-1 text-sm text-foreground-500">Esta escolha é gravada no servidor e é aplicada a cada lead novo da rotina.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <button type="button" onClick={() => changeAssignment('ana')} className={`rounded-xl border p-4 text-left ${settings.initialAssignmentMode === 'ana' ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-background-200'}`}><i className="ri-robot-2-line text-xl text-primary-600" /><p className="mt-2 font-semibold text-foreground-900">Ana</p><p className="mt-1 text-xs leading-5 text-foreground-500">A Ana inicia o atendimento e segue as proteções publicadas.</p></button>
            <button type="button" onClick={() => changeAssignment('human')} className={`rounded-xl border p-4 text-left ${settings.initialAssignmentMode === 'human' ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-background-200'}`}><i className="ri-user-star-line text-xl text-primary-600" /><p className="mt-2 font-semibold text-foreground-900">Vendedor específico</p><p className="mt-1 text-xs leading-5 text-foreground-500">Cria uma tarefa para um usuário ativo; a Ana não inicia mensagens.</p></button>
            <button type="button" onClick={() => changeAssignment('team')} className={`rounded-xl border p-4 text-left ${settings.initialAssignmentMode === 'team' ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-background-200'}`}><i className="ri-team-line text-xl text-primary-600" /><p className="mt-2 font-semibold text-foreground-900">Rodízio da equipe</p><p className="mt-1 text-xs leading-5 text-foreground-500">Alterna somente entre os usuários selecionados abaixo.</p></button>
          </div>
          {settings.initialAssignmentMode === 'human' && <label className="mt-4 block text-sm">Vendedor responsável<select className="mt-1 w-full" value={settings.initialAssigneeUserId || ''} onChange={(event) => update('initialAssigneeUserId', event.target.value || null)}><option value="">Selecione um usuário ativo</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.name} · {member.role}</option>)}</select>{showFieldError('initialAssigneeUserId')}</label>}
          {settings.initialAssignmentMode === 'team' && <div className="mt-4"><p className="text-sm">Equipe que participa do rodízio</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{members.map((member) => <label key={member.userId} className="flex items-center gap-2 rounded-lg border border-background-200 p-3 text-sm"><input type="checkbox" checked={settings.teamMemberIds.includes(member.userId)} onChange={(event) => update('teamMemberIds', event.target.checked ? [...settings.teamMemberIds, member.userId] : settings.teamMemberIds.filter((id) => id !== member.userId))} />{member.name}<span className="ml-auto text-xs text-foreground-500">{member.role}</span></label>)}</div>{members.length === 0 && <p className="mt-2 text-sm text-amber-700">Não há usuários ativos disponíveis.</p>}{showFieldError('teamMemberIds')}</div>}
          {settings.initialAssignmentMode === 'ana' && <div className="mt-4 rounded-xl border border-background-200 bg-background-100/50 p-4"><h4 className="text-sm font-semibold text-foreground-900">Transferência programada da Ana</h4><p className="mt-1 text-xs text-foreground-500">Opcional. Sem uma etapa, a Ana segue apenas as regras e gatilhos já publicados.</p><div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-sm">Até qual etapa a Ana atende?<select className="mt-1 w-full" value={settings.handoffStage || ''} onChange={(event) => update('handoffStage', event.target.value ? event.target.value as AnaHandoffStage : null)}><option value="">Sem transferência por etapa</option>{HANDOFF_STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label>{settings.handoffStage && <label className="text-sm">Vendedor que assumirá<select className="mt-1 w-full" value={settings.handoffAssigneeUserId || ''} onChange={(event) => update('handoffAssigneeUserId', event.target.value || null)}><option value="">Selecione um usuário ativo</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.name} · {member.role}</option>)}</select>{showFieldError('handoffAssigneeUserId')}</label>}</div>{settings.handoffStage && <label className="mt-3 flex items-start gap-2 text-sm text-foreground-700"><input className="mt-0.5" type="checkbox" checked={settings.handoffNotifyWhatsapp} onChange={(event) => update('handoffNotifyWhatsapp', event.target.checked)} /><span><strong>Avisar o vendedor por WhatsApp</strong><span className="mt-0.5 block text-xs text-foreground-500">Exige o telefone de aviso configurado em Usuários. O aviso é uma fila interna auditável.</span></span></label>}</div>}
        </section>
      </div>
      <aside className="space-y-5"><div id="ana-readiness" className="wf-surface p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-foreground-900">Pré-requisitos</h3><p className="mt-1 text-xs leading-5 text-foreground-500">Cada pendência informa exatamente onde corrigir.</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pendingReadiness.length ? 'bg-amber-100 text-amber-900' : 'bg-primary-50 text-primary-800'}`}>{pendingReadiness.length ? `${pendingReadiness.length} pendente${pendingReadiness.length > 1 ? 's' : ''}` : 'Tudo pronto'}</span></div><div className="mt-4 space-y-2.5">{readinessItems.map((item) => {
        const ready = checks[item.key] === true;
        return <div id={`ana-readiness-${item.key}`} key={item.key} className={`scroll-mt-24 rounded-xl border p-3 ${ready ? 'border-primary-100 bg-primary-50/50' : 'border-amber-300 bg-amber-50 ring-1 ring-amber-200'}`}>
          <div className="flex items-center justify-between gap-2 text-sm"><span className="font-medium text-foreground-900">{item.label}</span><span className={ready ? 'text-primary-700' : 'text-amber-800'}><i className={`${ready ? 'ri-checkbox-circle-fill' : 'ri-alert-fill'} mr-1`} />{ready ? 'OK' : 'Pendente'}</span></div>
          {!ready && <><p className="mt-2 text-xs leading-5 text-amber-900">{item.pendingDetail}</p>{item.href ? <a href={item.href} className="mt-2 inline-flex items-center text-xs font-semibold text-amber-950 underline decoration-amber-400 underline-offset-4">{item.actionLabel}<i className="ri-arrow-right-line ml-1" /></a> : <button type="button" onClick={pauseAll} disabled={Boolean(busy)} className="mt-2 inline-flex items-center text-xs font-semibold text-amber-950 underline decoration-amber-400 underline-offset-4 disabled:opacity-60">{busy === 'pause' ? 'Atualizando…' : item.actionLabel}<i className="ri-arrow-right-line ml-1" /></button>}</>}
        </div>;
      })}</div></div>
        <div className="wf-surface p-5"><h3 className="font-semibold text-foreground-900">Canais e proteções publicadas</h3><p className="mt-2 text-sm leading-5 text-foreground-500">Canais permitidos, consentimento, janela comercial, cadência e limite por contato continuam sendo uma única política publicada da Ana.</p><a className="mt-3 inline-flex text-sm font-semibold text-primary-700 hover:text-primary-800" href="/dashboard/configuracoes?tab=ana">Revisar política da Ana <i className="ri-arrow-right-line ml-1" /></a></div>
        <div className="wf-surface p-5"><h3 className="font-semibold text-foreground-900">Alertas comerciais</h3><div className="mt-3 space-y-3">{([['notifyImmediate', 'Avisos imediatos'], ['notifyProgress', 'Avisos de progresso'], ['digestEnabled', 'Resumo diário']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings[key]} onChange={(event) => update(key, event.target.checked)} />{label}</label>)}<label className="block text-sm">Horário do resumo<input className="mt-1 w-full" type="time" value={settings.digestTime} onChange={(event) => update('digestTime', event.target.value)} /></label></div></div>
      </aside>
    </section>

    <section className="wf-surface p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-foreground-900">Salvar, validar e executar</h3><p className="mt-1 max-w-2xl text-sm text-foreground-500">Rascunho não agenda nada. A ativação valida dados, permissões, conexões e a proteção de Ambiente Real no servidor.</p></div>{settings.initialAssignmentMode === 'ana' && settings.handoffStage && <span className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800"><i className="ri-user-shared-line mr-1" />Transfere para {memberName(settings.handoffAssigneeUserId)} em {HANDOFF_STAGES.find((stage) => stage.id === settings.handoffStage)?.label}</span>}</div>
      {settings.mode === 'automatic' && <label className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><input className="mt-0.5" type="checkbox" checked={settings.paidProspectingApproved} onChange={(event) => update('paidProspectingApproved', event.target.checked)} /><span>Autorizo o uso do Apify dentro dos limites configurados. Esta confirmação não ignora a pausa global, o consentimento, os canais permitidos ou o horário comercial.</span></label>}
      {showFieldError('paidProspectingApproved')}{message && <p className="mt-4 rounded-lg bg-primary-50 p-3 text-sm text-primary-800">{message}</p>}{error && <p className="mt-4 rounded-lg bg-accent-50 p-3 text-sm text-accent-700">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => void save(false)} disabled={Boolean(busy)} className="rounded-lg border border-background-300 px-4 py-2 text-sm font-semibold text-foreground-800">{busy === 'draft' ? 'Salvando…' : 'Salvar rascunho'}</button><button type="button" onClick={() => void save(true)} disabled={Boolean(busy)} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white">{busy === 'activate' ? 'Validando…' : `Ativar ${MODE_COPY[settings.mode].title}`}</button><button type="button" onClick={simulate} disabled={Boolean(busy)} className="rounded-lg border border-primary-300 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-800">{busy === 'simulate' ? 'Simulando…' : 'Simular sem enviar'}</button><button type="button" onClick={runNow} disabled={Boolean(busy) || settings.mode === 'simulation'} title={settings.mode === 'automatic' ? 'Executa a rotina operacional usando os provedores já homologados.' : undefined} className="rounded-lg border border-background-300 px-4 py-2 text-sm font-semibold text-foreground-800">{busy === 'run' ? 'Executando…' : settings.mode === 'automatic' ? 'Executar agora' : 'Preparar execução'}</button></div>
    </section>

    <section className="wf-surface overflow-hidden"><div className="border-b border-background-200 p-5"><h3 className="font-semibold text-foreground-900">Últimas execuções</h3></div><div className="divide-y divide-background-100">{runs.length === 0 && <p className="p-5 text-sm text-foreground-500">Nenhuma execução registrada.</p>}{runs.map((run) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-sm font-semibold text-foreground-900">{MODE_COPY[run.operation_mode]?.title || run.operation_mode} · {run.status}</p><p className="mt-1 text-xs text-foreground-500">{new Date(run.created_at).toLocaleString('pt-BR')} · {run.candidate_count || 0} candidatos · {run.imported_count || 0} importados</p></div>{run.status === 'awaiting_approval' && <button type="button" onClick={() => approve(run.id)} disabled={Boolean(busy)} className="rounded-lg bg-secondary-600 px-3 py-2 text-sm font-semibold text-white">{busy === run.id ? 'Aprovando…' : 'Aprovar execução'}</button>}</div>)}</div></section>
  </div>;
}
