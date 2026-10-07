import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import MetaCoexistencePanel from '@/components/feature/MetaCoexistencePanel';
import {
  loadWhatsappAccounts,
  metaCoexistenceFeatureEnabled,
  refreshWhatsappAccount,
  type AccountsResponse,
  type WhatsappAccount,
  type WhatsappChannelCheck,
  type WhatsappChannelHistoryEntry,
  type WhatsappChannelOverview,
  type WhatsappChannelState,
} from '@/lib/crm/whatsappAccountsRepository';

type ChannelTab = 'canais' | 'diagnostico' | 'historico';

const tabs: Array<{ id: ChannelTab; label: string; icon: string }> = [
  { id: 'canais', label: 'Canais', icon: 'ri-whatsapp-line' },
  { id: 'diagnostico', label: 'Diagnóstico', icon: 'ri-stethoscope-line' },
  { id: 'historico', label: 'Histórico', icon: 'ri-history-line' },
];

const stateVisual: Record<WhatsappChannelState, { tone: string; icon: string }> = {
  disconnected: { tone: 'border-background-200 bg-background-100 text-foreground-700', icon: 'ri-link-unlink-m' },
  connecting: { tone: 'border-primary-200 bg-primary-50 text-primary-800', icon: 'ri-loader-4-line' },
  configuration_incomplete: { tone: 'border-amber-200 bg-amber-50 text-amber-900', icon: 'ri-alert-line' },
  validating: { tone: 'border-primary-200 bg-primary-50 text-primary-800', icon: 'ri-shield-check-line' },
  operational: { tone: 'border-primary-200 bg-primary-50 text-primary-800', icon: 'ri-checkbox-circle-line' },
  requires_attention: { tone: 'border-accent-200 bg-accent-50 text-accent-800', icon: 'ri-error-warning-line' },
  reconnecting: { tone: 'border-amber-200 bg-amber-50 text-amber-900', icon: 'ri-refresh-line' },
  authorization_revoked: { tone: 'border-accent-200 bg-accent-50 text-accent-800', icon: 'ri-forbid-2-line' },
};

function formatWhen(value: string | null, fallback = 'Ainda não confirmado') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const now = Date.now();
  const age = now - date.getTime();
  if (age >= 0 && age < 60_000) return 'Agora mesmo';
  if (age >= 0 && age < 3_600_000) return `Há ${Math.max(1, Math.floor(age / 60_000))} min`;
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return `Hoje, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Ontem, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function providerName(account: WhatsappAccount) {
  if (account.provider === 'wa_akg') return 'WA-AKG';
  if (account.provider === 'evolution_go') return 'Evolution GO';
  return account.provider === 'meta_cloud' ? 'Meta WhatsApp Cloud API' : 'Z-API';
}

function providerMode(account: WhatsappAccount) {
  return account.provider === 'meta_cloud'
    ? 'Coexistência'
    : account.accountType === 'seller'
      ? 'Canal do vendedor'
      : 'Canal corporativo';
}

function checkIcon(check: WhatsappChannelCheck) {
  if (check.state === 'ready') return 'ri-checkbox-circle-fill text-primary-600';
  if (check.state === 'attention') return 'ri-alert-fill text-amber-600';
  return 'ri-subtract-fill text-foreground-400';
}

function resultVisual(result: WhatsappChannelHistoryEntry['result']) {
  if (result === 'success') return { label: 'Concluído', tone: 'bg-primary-50 text-primary-800' };
  if (result === 'attention') return { label: 'Atenção', tone: 'bg-accent-50 text-accent-800' };
  return { label: 'Pendente', tone: 'bg-amber-50 text-amber-900' };
}

function currentCorporateAccount(accounts: WhatsappAccount[]) {
  return accounts.find((account) => account.isDefault)
    ?? accounts.find((account) => account.accountType === 'corporate')
    ?? accounts[0]
    ?? null;
}

export default function WhatsappChannelsWorkspace() {
  const [params, setParams] = useSearchParams();
  const paramTab = params.get('tab');
  const tab: ChannelTab = paramTab === 'diagnostico' || paramTab === 'historico' ? paramTab : 'canais';
  const [data, setData] = useState<AccountsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [metaAvailable, setMetaAvailable] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const metaRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadWhatsappAccounts();
      setData(result);
      setError('');
    } catch {
      setError('Não foi possível ler o estado confirmado dos canais. Nenhum estado foi presumido.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    let active = true;
    void metaCoexistenceFeatureEnabled().then((enabled) => { if (active) setMetaAvailable(enabled); }).catch(() => { if (active) setMetaAvailable(false); });
    return () => { active = false; };
  }, []);

  const account = useMemo(() => currentCorporateAccount(data?.accounts ?? []), [data?.accounts]);
  const overview = account ? data?.channelOverviews?.[account.id] ?? null : null;
  const history = data?.channelHistory ?? [];

  const setTab = (next: ChannelTab) => {
    const nextParams = new URLSearchParams(params);
    if (next === 'canais') nextParams.delete('tab'); else nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  };

  const validate = async () => {
    if (!account) return;
    if (account.provider !== 'zapi') {
      setTab('diagnostico');
      setNotice('A validação da Meta permanece bloqueada até a homologação oficial do provedor.');
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      await refreshWhatsappAccount(account.id);
      await refresh();
      setNotice('A validação consultou o estado atual do provedor. Ela não enviou uma mensagem de teste.');
    } catch {
      await refresh();
      setError('Não foi possível concluir a validação. O diagnóstico abaixo mostra somente o último estado persistido.');
    } finally {
      setBusy(false);
    }
  };

  const openMeta = () => {
    if (!data?.canManage) {
      setError('Somente administradores autorizados podem conectar um novo número.');
      return;
    }
    if (!metaAvailable) {
      setError('A conexão Meta está protegida pelo gate de homologação. O canal atual foi preservado.');
      return;
    }
    metaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    metaRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  };

  const runPendingAction = () => {
    const action = overview?.checks.find((check) => check.state !== 'ready')?.action;
    if (action === 'validate') { void validate(); return; }
    if (action === 'connect') { openMeta(); return; }
    if (action === 'test') { setTab('diagnostico'); return; }
    setTab('diagnostico');
  };

  return <div className="space-y-5">
    <header className="wf-page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="wf-eyebrow">Canais de atendimento</p>
        <h1 className="wf-page-title">Canais de WhatsApp</h1>
        <p className="wf-page-description">Conecte e acompanhe os números usados no atendimento.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/dashboard/atendimento" className="wf-btn-secondary"><i className="ri-external-link-line" />Abrir Central de Atendimento</Link>
        <button type="button" onClick={openMeta} className="wf-btn-primary" disabled={loading}><i className="ri-add-line" />Adicionar número</button>
      </div>
    </header>

    {error && <p role="alert" className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">{notice}</p>}

    {loading ? <section className="wf-surface p-8 text-center text-sm text-foreground-500" aria-live="polite"><i className="ri-loader-4-line mr-2 inline-block animate-spin" />Carregando o estado confirmado dos canais…</section>
      : !account || !overview ? <EmptyState canManage={Boolean(data?.canManage)} onAdd={openMeta} />
        : <>
          <StatusBanner overview={overview} onDiagnostic={() => setTab('diagnostico')} />

          <nav className="wf-surface flex overflow-x-auto p-1.5" aria-label="Navegação dos canais de WhatsApp">
            {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${tab === item.id ? 'bg-background-950 text-background-50 shadow-sm' : 'text-foreground-500 hover:bg-background-100 hover:text-foreground-800'}`}><i className={item.icon} />{item.label}</button>)}
          </nav>

          {tab === 'canais' && <ChannelsTab account={account} overview={overview} canManage={Boolean(data?.canManage)} busy={busy} onValidate={() => void validate()} onComplete={runPendingAction} onDiagnostic={() => setTab('diagnostico')} onMeta={openMeta} metaAvailable={metaAvailable} metaRef={metaRef} onConnected={refresh} accounts={data?.accounts ?? []} />}
          {tab === 'diagnostico' && <DiagnosticTab account={account} overview={overview} busy={busy} onValidate={() => void validate()} onComplete={runPendingAction} />}
          {tab === 'historico' && <HistoryTab entries={history} />}
        </>}
  </div>;
}

function StatusBanner({ overview, onDiagnostic }: { overview: WhatsappChannelOverview; onDiagnostic: () => void }) {
  const visual = stateVisual[overview.state];
  const incomplete = overview.state !== 'operational';
  return <section className={`flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${visual.tone}`} role={incomplete ? 'status' : undefined}>
    <div className="flex items-start gap-3"><i className={`${visual.icon} mt-0.5 text-xl`} /><div><h2 className="font-semibold">{overview.statusLabel}</h2><p className="mt-0.5 text-sm leading-5 opacity-90">{overview.statusDetail}</p></div></div>
    <button type="button" onClick={onDiagnostic} className="wf-btn-secondary shrink-0 text-xs"><i className="ri-stethoscope-line" />Ver diagnóstico</button>
  </section>;
}

function EmptyState({ canManage, onAdd }: { canManage: boolean; onAdd: () => void }) {
  return <section className="wf-surface px-6 py-12 text-center"><i className="ri-whatsapp-line text-4xl text-foreground-300" /><h2 className="mt-3 text-lg font-bold text-foreground-950">Nenhum canal corporativo identificado</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-foreground-500">Não há número confirmado para este ambiente. Nenhuma mensagem, automação ou consentimento será assumido.</p>{canManage && <button type="button" onClick={onAdd} className="wf-btn-primary mt-5"><i className="ri-add-line" />Adicionar número</button>}</section>;
}

function ChannelsTab({ account, overview, canManage, busy, onValidate, onComplete, onDiagnostic, onMeta, metaAvailable, metaRef, onConnected, accounts }: {
  account: WhatsappAccount; overview: WhatsappChannelOverview; canManage: boolean; busy: boolean; onValidate: () => void; onComplete: () => void; onDiagnostic: () => void; onMeta: () => void; metaAvailable: boolean; metaRef: RefObject<HTMLDivElement | null>; onConnected: () => Promise<void>; accounts: WhatsappAccount[];
}) {
  const visual = stateVisual[overview.state];
  const steps = overview.checks.filter((check) => ['number', 'send_receive', 'routing'].includes(check.key));
  const number = account.displayPhoneNumber ?? (account.connectedPhoneSuffix ? `Número confirmado · final ${account.connectedPhoneSuffix}` : 'Não identificado');
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.9fr)]">
    <section className="wf-surface overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-background-200 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="wf-eyebrow">Canal corporativo</p><h2 className="mt-1 text-xl font-bold tracking-tight text-foreground-950">{account.verifiedName || account.label}</h2><p className="mt-1 text-sm text-foreground-500">{providerName(account)} · {providerMode(account)}</p></div>
        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${visual.tone}`}><i className={visual.icon} />{overview.state === 'operational' ? 'Operacional' : 'Ação necessária'}</span>
      </div>
      <div className="p-5">
        <article className="rounded-2xl border border-background-200 bg-background-50 p-4">
          <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e9fbf0] text-xl text-[#128c4a]"><i className="ri-whatsapp-line" /></span><div className="min-w-0"><h3 className="truncate font-semibold text-foreground-950">{account.verifiedName || account.label}</h3><p className="mt-0.5 text-xs text-foreground-500">{providerName(account)}</p></div></div><details className="relative"><summary className="list-none rounded-lg border border-background-200 p-2 text-foreground-600 hover:bg-background-100" aria-label="Ações do canal"><i className="ri-more-2-fill" /></summary><div className="absolute right-0 z-10 mt-1 w-56 rounded-xl border border-background-200 bg-white p-1.5 shadow-lg"><button type="button" onClick={onDiagnostic} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-background-100"><i className="ri-stethoscope-line" />Ver diagnóstico</button>{account.provider === 'zapi' && <button type="button" onClick={onValidate} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-background-100"><i className="ri-refresh-line" />Validar novamente</button>}<Link to="/dashboard/configuracoes?tab=canais" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold hover:bg-background-100"><i className="ri-settings-3-line" />Gerenciar canal</Link></div></details></div>
          <dl className="mt-4 grid gap-3 rounded-xl border border-background-200 bg-white p-3 text-xs sm:grid-cols-2 lg:grid-cols-4"><Metric label="Número" value={number} attention={!account.connectedPhoneSuffix && !account.displayPhoneNumber} /><Metric label="Roteamento" value={overview.routing.destination || 'Não configurado'} detail={overview.routing.detail} attention={!overview.routing.active} /><Metric label="Modalidade" value={providerMode(account)} /><Metric label="Última validação" value={formatWhen(account.statusCheckedAt)} detail={account.statusCheckedAt ? new Date(account.statusCheckedAt).toLocaleString('pt-BR') : undefined} /></dl>
        </article>

        <div className="mt-5"><h3 className="text-sm font-bold text-foreground-950">Estado da configuração</h3><div className="mt-3 divide-y divide-background-200 overflow-hidden rounded-xl border border-background-200">{overview.checks.map((check) => <CheckRow key={check.key} check={check} />)}</div></div>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy || !canManage} onClick={onComplete} className="wf-btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-60"><i className="ri-arrow-right-line" />Concluir configuração</button><button type="button" disabled={busy || !canManage || account.provider !== 'zapi'} onClick={onValidate} className="wf-btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-60"><i className={busy ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} />{busy ? 'Validando…' : 'Validar novamente'}</button><button type="button" onClick={onDiagnostic} className="wf-btn-secondary text-xs"><i className="ri-file-search-line" />Detalhes técnicos</button></div>
        <p className="mt-4 rounded-xl border border-primary-100 bg-primary-50/60 px-3 py-2.5 text-xs leading-5 text-primary-800"><i className="ri-information-line mr-1" />Uma conexão confirma somente o estado técnico indicado acima. Consentimento, aceite do provedor, entrega e leitura são eventos separados.</p>
      </div>
    </section>
    <aside className="space-y-4"><section className="wf-surface p-5"><h2 className="text-base font-bold text-foreground-950">Próximos passos</h2><ol className="mt-4 space-y-4">{steps.map((check, index) => <li key={check.key} className="flex gap-3"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${check.state === 'ready' ? 'border-primary-300 bg-primary-50 text-primary-800' : check.state === 'attention' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-background-300 bg-background-100 text-foreground-600'}`}>{check.state === 'ready' ? <i className="ri-check-line" /> : index + 1}</span><div><h3 className="text-sm font-semibold text-foreground-900">{check.label}</h3><p className="mt-0.5 text-xs leading-5 text-foreground-500">{check.detail}</p></div></li>)}</ol><p className="mt-5 border-t border-background-200 pt-3 text-xs leading-5 text-foreground-500">As etapas acompanham o estado persistido. Nenhuma delas cria uma conexão ou envia uma mensagem automaticamente.</p></section>
      <section ref={metaRef} className="wf-surface p-5"><h2 className="text-base font-bold text-foreground-950">Conectar outro número</h2><p className="mt-1 text-sm leading-6 text-foreground-500">Adicione outro número oficial usando a Meta WhatsApp Cloud API.</p>{metaAvailable ? <div className="mt-4"><MetaCoexistencePanel accounts={accounts} canManage={canManage} onConnected={onConnected} /></div> : <><button type="button" disabled className="wf-btn-secondary mt-4 w-full justify-center text-xs disabled:cursor-not-allowed disabled:opacity-60"><i className="ri-meta-line" />Conectar com a Meta</button><p className="mt-2 text-xs leading-5 text-foreground-500">Disponível após a homologação da integração Meta. O canal atual não será substituído.</p></>}</section>
      <section className="wf-surface p-5"><h2 className="text-base font-bold text-foreground-950">Coexistência</h2><p className="mt-2 text-sm leading-6 text-foreground-500">O WhatsApp Business continua funcionando no celular enquanto as conversas também chegam ao sistema.</p><a className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline" href="https://developers.facebook.com/docs/whatsapp/cloud-api/overview" target="_blank" rel="noreferrer">Saiba como funciona <i className="ri-external-link-line" /></a></section>
    </aside>
  </div>;
}

function Metric({ label, value, detail, attention = false }: { label: string; value: string; detail?: string; attention?: boolean }) {
  return <div className="min-w-0"><dt className="text-foreground-400">{label}</dt><dd title={detail} className={`mt-1 break-words font-semibold ${attention ? 'text-amber-800' : 'text-foreground-800'}`}>{attention && <i className="ri-alert-fill mr-1 text-amber-600" />}{value}</dd></div>;
}

function CheckRow({ check }: { check: WhatsappChannelCheck }) {
  const stateLabel = check.state === 'ready' ? 'Confirmado' : check.state === 'attention' ? 'Ação necessária' : 'Pendente';
  const tone = check.state === 'ready' ? 'bg-primary-50 text-primary-800' : check.state === 'attention' ? 'bg-amber-50 text-amber-900' : 'bg-background-100 text-foreground-600';
  return <div className="flex items-start gap-3 bg-white px-4 py-3"><i className={`${checkIcon(check)} mt-0.5 text-lg`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-foreground-900">{check.label}</h4><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${tone}`}>{stateLabel}</span></div><p className="mt-0.5 text-xs leading-5 text-foreground-500">{check.detail}</p></div></div>;
}

function DiagnosticTab({ account, overview, busy, onValidate, onComplete }: { account: WhatsappAccount; overview: WhatsappChannelOverview; busy: boolean; onValidate: () => void; onComplete: () => void }) {
  return <section className="wf-surface overflow-hidden"><header className="border-b border-background-200 px-5 py-4"><p className="wf-eyebrow">Leitura do backend</p><h2 className="mt-1 text-lg font-bold text-foreground-950">Diagnóstico do canal</h2><p className="mt-1 text-sm text-foreground-500">Cada item representa uma confirmação separada. Tokens, URLs privadas e credenciais nunca são exibidos.</p></header><div className="divide-y divide-background-200">{overview.checks.map((check) => <div key={check.key} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.5fr)_auto]"><div className="flex gap-2"><i className={`${checkIcon(check)} mt-0.5 text-lg`} /><div><h3 className="font-semibold text-foreground-900">{check.label}</h3><p className="mt-1 text-xs text-foreground-500">Verificado: {formatWhen(check.checkedAt)}</p></div></div><p className="text-sm leading-6 text-foreground-600">{check.detail}</p><div className="text-left md:text-right">{check.action === 'validate' && account.provider === 'zapi' ? <button type="button" disabled={busy} onClick={onValidate} className="wf-btn-secondary text-xs disabled:opacity-60">Validar novamente</button> : check.action === 'test' ? <Link to="/dashboard/configuracoes?tab=canais" className="wf-btn-secondary text-xs">Abrir teste controlado</Link> : check.action !== 'none' ? <button type="button" onClick={onComplete} className="wf-btn-secondary text-xs">Ver correção</button> : <span className="text-xs font-semibold text-primary-700">Sem ação pendente</span>}</div></div>)}</div><footer className="flex flex-wrap gap-2 border-t border-background-200 px-5 py-4"><button type="button" disabled={busy || account.provider !== 'zapi'} onClick={onValidate} className="wf-btn-primary text-xs disabled:opacity-60"><i className={busy ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} />{busy ? 'Validando…' : 'Validar novamente'}</button><Link to="/dashboard/configuracoes?tab=canais" className="wf-btn-secondary text-xs"><i className="ri-send-plane-line" />Teste controlado</Link></footer></section>;
}

function HistoryTab({ entries }: { entries: WhatsappChannelHistoryEntry[] }) {
  return <section className="wf-surface overflow-hidden"><header className="border-b border-background-200 px-5 py-4"><p className="wf-eyebrow">Auditoria do canal</p><h2 className="mt-1 text-lg font-bold text-foreground-950">Histórico</h2><p className="mt-1 text-sm text-foreground-500">Mostra somente eventos auditáveis do canal. Conteúdo de mensagens e credenciais não entram neste histórico.</p></header>{entries.length === 0 ? <div className="px-5 py-10 text-center"><i className="ri-history-line text-3xl text-foreground-300" /><p className="mt-2 text-sm font-semibold text-foreground-700">Nenhum evento de canal disponível</p><p className="mt-1 text-xs text-foreground-500">O primeiro evento será incluído quando a conexão for configurada, validada ou receber um callback.</p></div> : <div className="divide-y divide-background-200">{entries.map((entry) => { const visual = resultVisual(entry.result); return <article key={entry.id} className="grid gap-2 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto]"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-foreground-900">{entry.detail}</h3><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${visual.tone}`}>{visual.label}</span></div><p className="mt-1 text-xs text-foreground-500">{entry.actorName ? `${entry.actorName} · ` : ''}{entry.action}</p></div><time className="text-xs text-foreground-500" dateTime={entry.occurredAt || undefined}>{formatWhen(entry.occurredAt)}</time></article>; })}</div>}<footer className="border-t border-background-200 px-5 py-3 text-xs text-foreground-500">São exibidos os 50 eventos mais recentes relacionados aos canais corporativos deste ambiente.</footer></section>;
}
