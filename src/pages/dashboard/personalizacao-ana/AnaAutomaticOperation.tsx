import { useEffect, useMemo, useState } from 'react';
import {
  approveAnaOperationRun,
  loadAnaOperation,
  runAnaOperationNow,
  saveAnaOperation,
  type AnaOperationMode,
  type AnaOperationRun,
  type AnaOperationSettings,
} from '@/lib/crm/anaOperationRepository';
import { loadOperationalStatus, setOperationalKillSwitch } from '@/lib/crm/operationalDiagnosticsRepository';

const DAYS = [{ id: 1, label: 'Seg' }, { id: 2, label: 'Ter' }, { id: 3, label: 'Qua' }, { id: 4, label: 'Qui' }, { id: 5, label: 'Sex' }, { id: 6, label: 'Sáb' }, { id: 0, label: 'Dom' }];
const DEFAULTS: AnaOperationSettings = {
  enabled: false, mode: 'simulation', name: 'Operação diária da Ana', timezone: 'America/Sao_Paulo', weekdays: [1, 2, 3, 4, 5], runTime: '09:00',
  dailyLeadLimit: 20, dailyCap: 50, monthlyCap: 500, minimumFitScore: 70, assignmentStrategy: 'owner', regions: [], segments: [], keywords: [],
  requireWebsite: true, requireWhatsapp: true, requireEmail: false, paidProspectingApproved: false, notifyImmediate: true, notifyProgress: true, digestEnabled: true, digestTime: '18:00',
};
const MODE_COPY: Record<AnaOperationMode, { title: string; text: string; icon: string }> = {
  simulation: { title: 'Simulação', text: 'Busca, classifica e registra o plano sem chamar Apify, IA ou canais.', icon: 'ri-flask-line' },
  supervised: { title: 'Supervisionado', text: 'Prepara a execução e aguarda aprovação antes de prospectar.', icon: 'ri-user-follow-line' },
  automatic: { title: 'Automático', text: 'Executa a rotina somente quando todas as conexões e proteções estiverem comprovadas.', icon: 'ri-robot-2-line' },
};
const textList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const split = (value: string) => [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))];
const clock = (value: unknown, fallback: string) => typeof value === 'string' ? value.slice(0, 5) : fallback;

export default function AnaAutomaticOperation() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [runs, setRuns] = useState<AnaOperationRun[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [automaticReady, setAutomaticReady] = useState(false);
  const [killSwitch, setKillSwitch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const hydrate = async () => {
    setLoading(true); setError('');
    try {
      const [snapshot, operational] = await Promise.all([loadAnaOperation(), loadOperationalStatus()]);
      const schedule = snapshot.schedule || {};
      const filters = (schedule.filters && typeof schedule.filters === 'object' ? schedule.filters : {}) as Record<string, unknown>;
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
        regions: textList(filters.estados), segments: textList(filters.segmentos), keywords: textList(filters.atividades),
        requireWebsite: filters.exigeSite !== false, requireWhatsapp: filters.exigeWhatsApp !== false, requireEmail: filters.exigeEmail === true,
        paidProspectingApproved: schedule.paid_prospecting_approved === true, notifyImmediate: schedule.notify_immediate !== false,
        notifyProgress: schedule.notify_progress !== false, digestEnabled: schedule.digest_enabled !== false, digestTime: clock(schedule.digest_time, DEFAULTS.digestTime),
      });
      setRuns(snapshot.runs); setChecks(snapshot.readiness.checks); setAutomaticReady(snapshot.readiness.automaticReady);
      setKillSwitch(Boolean(operational.killSwitch));
    } catch { setError('Não foi possível confirmar a configuração operacional da Ana.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void hydrate(); }, []);

  const readinessItems = useMemo(() => [
    ['company', 'Empresa ativa'], ['realEnvironment', 'Ambiente real'], ['anaConfiguration', 'Configuração publicada'], ['ai', 'IA'], ['apify', 'Apify'],
    ['scheduler', 'Agendador'], ['whatsappOutbound', 'WhatsApp de saída'], ['whatsappInbound', 'WhatsApp de entrada'], ['killSwitchOff', 'Pausa global desligada'],
  ] as const, []);
  const update = <K extends keyof AnaOperationSettings>(key: K, value: AnaOperationSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setBusy('save'); setError(''); setMessage('');
    try { await saveAnaOperation(settings); setMessage('Operação automática salva com segurança.'); await hydrate(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.'); }
    finally { setBusy(''); }
  };
  const runNow = async () => {
    setBusy('run'); setError(''); setMessage('');
    try { const result = await runAnaOperationNow(); setRuns((current) => [result.run, ...current]); setMessage(settings.mode === 'simulation' ? 'Simulação concluída sem chamadas externas.' : settings.mode === 'supervised' ? 'Execução preparada e aguardando aprovação.' : 'Execução colocada na fila auditável.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível executar.'); }
    finally { setBusy(''); }
  };
  const approve = async (id: string) => {
    setBusy(id); setError('');
    try { const result = await approveAnaOperationRun(id); setRuns((current) => current.map((item) => item.id === id ? result.run : item)); setMessage('Execução aprovada e colocada na fila auditável.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível aprovar.'); }
    finally { setBusy(''); }
  };
  const pauseAll = async () => {
    setBusy('pause'); setError('');
    try { const status = await setOperationalKillSwitch(!killSwitch); setKillSwitch(Boolean(status.killSwitch)); setMessage(status.killSwitch ? 'Toda automação foi pausada.' : 'Pausa global removida.'); }
    catch { setError('Não foi possível alterar a pausa global.'); }
    finally { setBusy(''); }
  };

  if (loading) return <div className="wf-surface p-6 text-sm text-foreground-500">Carregando operação automática…</div>;
  return <div className="space-y-5">
    <section className="wf-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="wf-eyebrow">Configurações · Ana</p><h2 className="mt-1 text-xl font-semibold text-foreground-950">Operação automática</h2><p className="mt-1 max-w-3xl text-sm text-foreground-500">Uma única rotina conecta Busca de Leads, Leads, Kanban, Central e a Ana. A configuração inicia em simulação.</p></div><button type="button" onClick={pauseAll} disabled={Boolean(busy)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${killSwitch ? 'bg-emerald-600 text-white' : 'border border-rose-300 bg-rose-50 text-rose-700'}`}><i className={`${killSwitch ? 'ri-play-line' : 'ri-stop-circle-line'} mr-2`} />{killSwitch ? 'Retomar automações' : 'Pausar tudo'}</button></div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">{(Object.keys(MODE_COPY) as AnaOperationMode[]).map((mode) => <button type="button" key={mode} onClick={() => update('mode', mode)} className={`rounded-xl border p-4 text-left ${settings.mode === mode ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-background-200 bg-white'}`}><i className={`${MODE_COPY[mode].icon} text-xl text-primary-600`} /><strong className="ml-2 text-foreground-900">{MODE_COPY[mode].title}</strong><p className="mt-2 text-sm leading-5 text-foreground-500">{MODE_COPY[mode].text}</p></button>)}</div>
      {settings.mode === 'automatic' && !automaticReady && <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">O modo automático permanece bloqueado até todos os pré-requisitos abaixo estarem comprovados.</p>}
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <div className="wf-surface p-5"><h3 className="font-semibold text-foreground-900">Rotina de busca e qualificação</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm">Horário diário<input className="mt-1 w-full" type="time" value={settings.runTime} onChange={(e) => update('runTime', e.target.value)} /></label><label className="text-sm">Fuso horário<input className="mt-1 w-full" value={settings.timezone} onChange={(e) => update('timezone', e.target.value)} /></label></div>
        <div className="mt-4"><span className="text-sm">Dias da semana</span><div className="mt-2 flex flex-wrap gap-2">{DAYS.map((day) => <button type="button" key={day.id} onClick={() => update('weekdays', settings.weekdays.includes(day.id) ? settings.weekdays.filter((item) => item !== day.id) : [...settings.weekdays, day.id])} className={`rounded-lg border px-3 py-2 text-sm ${settings.weekdays.includes(day.id) ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-background-200'}`}>{day.label}</button>)}</div></div>
        <div className="mt-4 grid gap-4 md:grid-cols-3"><label className="text-sm">Leads por busca<input className="mt-1 w-full" type="number" min="1" max="100" value={settings.dailyLeadLimit} onChange={(e) => update('dailyLeadLimit', Number(e.target.value))} /></label><label className="text-sm">Limite diário<input className="mt-1 w-full" type="number" min="1" value={settings.dailyCap} onChange={(e) => update('dailyCap', Number(e.target.value))} /></label><label className="text-sm">Limite mensal<input className="mt-1 w-full" type="number" min="1" value={settings.monthlyCap} onChange={(e) => update('monthlyCap', Number(e.target.value))} /></label></div>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm">Segmentos<textarea className="mt-1 w-full" value={settings.segments.join(', ')} onChange={(e) => update('segments', split(e.target.value))} placeholder="Alimentos, logística, embalagem" /></label><label className="text-sm">Regiões<textarea className="mt-1 w-full" value={settings.regions.join(', ')} onChange={(e) => update('regions', split(e.target.value))} placeholder="SP, PR, SC" /></label></div>
        <label className="mt-4 block text-sm">Palavras-chave e atividades<textarea className="mt-1 w-full" value={settings.keywords.join(', ')} onChange={(e) => update('keywords', split(e.target.value))} placeholder="esteiras, transportadores, correias" /></label>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">{([['requireWebsite','Exigir site'],['requireWhatsapp','Exigir WhatsApp'],['requireEmail','Exigir e-mail']] as const).map(([key,label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-background-200 p-3 text-sm"><input type="checkbox" checked={settings[key]} onChange={(e) => update(key, e.target.checked)} />{label}</label>)}</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm">Fit mínimo para aprovação<input className="mt-1 w-full" type="number" min="0" max="100" value={settings.minimumFitScore} onChange={(e) => update('minimumFitScore', Number(e.target.value))} /></label><label className="text-sm">Distribuição<select className="mt-1 w-full" value={settings.assignmentStrategy} onChange={(e) => update('assignmentStrategy', e.target.value as AnaOperationSettings['assignmentStrategy'])}><option value="owner">Responsável configurado</option><option value="round_robin">Rodízio de vendedores</option><option value="existing_owner">Manter responsável existente</option></select></label></div>
      </div>
      <aside className="space-y-5"><div className="wf-surface p-5"><h3 className="font-semibold text-foreground-900">Pré-requisitos</h3><div className="mt-3 space-y-2">{readinessItems.map(([key,label]) => <div key={key} className="flex items-center justify-between gap-2 text-sm"><span>{label}</span><span className={checks[key] ? 'text-emerald-700' : 'text-amber-700'}><i className={`${checks[key] ? 'ri-checkbox-circle-fill' : 'ri-alert-fill'} mr-1`} />{checks[key] ? 'OK' : 'Pendente'}</span></div>)}</div></div>
        <div className="wf-surface p-5"><h3 className="font-semibold text-foreground-900">Alertas comerciais</h3><div className="mt-3 space-y-3">{([['notifyImmediate','Avisos imediatos'],['notifyProgress','Avisos de progresso'],['digestEnabled','Resumo diário']] as const).map(([key,label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings[key]} onChange={(e) => update(key, e.target.checked)} />{label}</label>)}<label className="block text-sm">Horário do resumo<input className="mt-1 w-full" type="time" value={settings.digestTime} onChange={(e) => update('digestTime', e.target.value)} /></label></div></div></aside>
    </section>

    <section className="wf-surface p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-foreground-900">Controle e execução</h3><p className="mt-1 text-sm text-foreground-500">Ativar apenas agenda a rotina do modo selecionado. Simulação não usa provedores externos.</p></div><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={settings.enabled} onChange={(e) => update('enabled', e.target.checked)} />Rotina ativa</label></div>
      {settings.mode === 'automatic' && <label className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><input className="mt-0.5" type="checkbox" checked={settings.paidProspectingApproved} onChange={(e) => update('paidProspectingApproved', e.target.checked)} /><span>Autorizo o uso do Apify dentro dos limites configurados. Esta confirmação não ignora a pausa global nem os demais bloqueios.</span></label>}
      {message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}{error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={save} disabled={Boolean(busy)} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white">{busy === 'save' ? 'Salvando…' : 'Salvar operação'}</button><button type="button" onClick={runNow} disabled={Boolean(busy)} className="rounded-lg border border-background-300 px-4 py-2 text-sm font-semibold text-foreground-800">{busy === 'run' ? 'Executando…' : 'Executar agora'}</button></div>
    </section>

    <section className="wf-surface overflow-hidden"><div className="border-b border-background-200 p-5"><h3 className="font-semibold text-foreground-900">Últimas execuções</h3></div><div className="divide-y divide-background-100">{runs.length === 0 && <p className="p-5 text-sm text-foreground-500">Nenhuma execução registrada.</p>}{runs.map((run) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-sm font-semibold text-foreground-900">{MODE_COPY[run.operation_mode]?.title || run.operation_mode} · {run.status}</p><p className="mt-1 text-xs text-foreground-500">{new Date(run.created_at).toLocaleString('pt-BR')} · {run.candidate_count || 0} candidatos · {run.imported_count || 0} importados</p></div>{run.status === 'awaiting_approval' && <button type="button" onClick={() => approve(run.id)} disabled={Boolean(busy)} className="rounded-lg bg-secondary-600 px-3 py-2 text-sm font-semibold text-white">{busy === run.id ? 'Aprovando…' : 'Aprovar execução'}</button>}</div>)}</div></section>
  </div>;
}
