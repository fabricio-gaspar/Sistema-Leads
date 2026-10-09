import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadTeamMembers, type TeamMember } from '@/lib/crm/teamMembersRepository';
import { isWaAkgOperational } from '@/lib/crm/waAkgOnboarding';
import { channelLifecycleBlocked, channelLifecycleMessage, refreshAfterLifecycleError } from '@/lib/crm/channelLifecycle';
import ChannelLifecycleRecovery from './ChannelLifecycleRecovery';
import {
  configureWaAkgGateway,
  createWaAkgSellerAccount,
  inspectWaAkgRuntime,
  loadMyWaAkgAccount,
  loadWaAkgAccounts,
  provisionWaAkgAccount,
  requestWaAkgPairingCode,
  requestWaAkgQr,
  runWaAkgAction,
  saveWaAkgControls,
  setWaAkgProviderControls,
  unlinkWaAkgDevice,
  type WaAkgChannelStatus,
} from '@/lib/crm/whatsappAccountsRepository';

type Mode = 'administration' | 'self-service';
type Surface = 'whatsapp' | 'central';
type Presentation = 'primary' | 'contingency';
type Status = WaAkgChannelStatus & { account: NonNullable<WaAkgChannelStatus['account']> };
type Notice = { tone: 'success' | 'error'; text: string };

const hasAccount = (status: WaAkgChannelStatus): status is Status => Boolean(status.account?.id);

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const copy: Record<string, string> = {
    account_lifecycle_pending: 'Operação pendente. Use Atualizar para consultar o resultado; não há confirmação de conclusão.',
    account_lifecycle_needs_review: 'A conta precisa de revisão administrativa antes de repetir a operação.',
    account_lifecycle_persistence_failed: 'Não foi possível confirmar a gravação. Consulte o estado antes de tentar novamente.',
    permission_denied: 'Seu usuário não possui permissão para esta operação.',
    wa_akg_allowed_origins_required: 'Cadastre WA_AKG_ALLOWED_ORIGINS nos segredos do servidor antes de salvar o gateway.',
    wa_akg_base_url_not_allowed: 'A URL não está na lista HTTPS autorizada do servidor.',
    wa_akg_gateway_not_configured: 'Configure a URL HTTPS e a chave da API do WA-AKG antes de provisionar vendedores.',
    wa_akg_account_not_found: 'A conta não foi encontrada ou não pertence ao usuário autenticado.',
    wa_akg_session_not_provisioned: 'A sessão ainda não foi criada. O administrador deve concluir o provisionamento.',
    wa_akg_qr_unavailable: 'O gateway ainda não entregou um QR válido. Aguarde alguns segundos e atualize.',
    wa_akg_session_already_connected: 'Esta sessão já está conectada. Atualize o status.',
    wa_akg_connection_validation_required: 'Leia o QR Code e atualize o status antes de ativar o canal.',
    wa_akg_request_rejected_401: 'A chave da API do WA-AKG foi recusada.',
    wa_akg_request_rejected_404: 'A sessão não foi encontrada no WA-AKG.',
    wa_akg_request_rejected_409: 'Esta sessão já existe e requer revisão antes de continuar.',
  };
  return copy[code] || 'Não foi possível concluir a operação. Nenhum envio foi ativado.';
}

function badge(status: Status | null) {
  if (channelLifecycleBlocked(status?.lifecycle)) return { label: status?.lifecycle?.state === 'pending' || status?.lifecycle?.state === 'in_flight' ? 'Operação pendente' : 'Requer revisão', css: 'bg-[#FFF1D8] text-[#965A12]' };
  if (!status?.configured) return { label: 'Aguardando provisionamento', css: 'bg-background-100 text-foreground-600' };
  if (isWaAkgOperational(status)) {
    return { label: 'Operacional', css: 'bg-[#E8F7EF] text-[#147445]' };
  }
  if (status.account.connectionStatus === 'connected') return { label: 'Conectado · protegido', css: 'bg-[#FFF1D8] text-[#965A12]' };
  if (status.account.connectionStatus === 'qr') return { label: 'Aguardando QR', css: 'bg-[#FFF1D8] text-[#965A12]' };
  return { label: 'Desconectado', css: 'bg-[#EEF1F3] text-[#68757D]' };
}

function runtimeLabel(status: Status | null) {
  const runtime = status?.runtime;
  if (!runtime) return { gateway: 'Verificando…', session: 'Não verificado', css: 'bg-[#FFF1D8] text-[#965A12]' };
  if (!runtime.reachable) return { gateway: 'Indisponível', session: 'Não acessível', css: 'bg-[#FFF1D8] text-[#965A12]' };
  if (runtime.state === 'CONNECTED') return { gateway: 'Acessível', session: 'CONNECTED', css: 'bg-[#E8F7EF] text-[#147445]' };
  if (runtime.state === 'STOPPED') return { gateway: 'Acessível', session: 'STOPPED', css: 'bg-[#EEF1F3] text-[#68757D]' };
  return { gateway: 'Acessível', session: runtime.state || 'UNKNOWN', css: 'bg-[#FFF1D8] text-[#965A12]' };
}

function checkedAt(value?: string) {
  if (!value) return 'Ainda não verificado';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Ainda não verificado' : date.toLocaleString('pt-BR');
}

export default function WaAkgPanel({ mode = 'administration', surface = 'whatsapp', presentation = 'primary' }: { mode?: Mode; surface?: Surface; presentation?: Presentation }) {
  const selfService = mode === 'self-service';
  const inCentral = surface === 'central';
  const administrationEyebrow = presentation === 'contingency' ? 'Canal de contingência' : 'Canal principal';
  const administrationDescription = presentation === 'contingency'
    ? 'Canal alternativo com sessão isolada por vendedor. A conexão continua protegida até as validações administrativas serem concluídas.'
    : 'Uma sessão isolada por vendedor, com QR próprio, fila persistente e automação centralizada na Ana.';
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Status[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusUnconfirmed, setStatusUnconfirmed] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const [gateway, setGateway] = useState({ label: 'WA-AKG principal', baseUrl: '', apiKey: '' });
  const [ownerUserId, setOwnerUserId] = useState('');
  const autoQr = useRef('');
  const redirecting = useRef(false);

  const refresh = useCallback(async () => {
    setBusy('refresh');
    setStatusUnconfirmed(true);
    setQr(null); setPairingCode('');
    try {
      const result = selfService
        ? { accounts: [await loadMyWaAkgAccount()], canManage: false }
        : await loadWaAkgAccounts();
      const visible = result.accounts.filter(hasAccount);
      setAccounts(visible);
      setStatusUnconfirmed(false);
      setCanManage(!selfService && result.canManage);
      setSelectedId((current) => visible.some((item) => item.account.id === current)
        ? current : visible.find((item) => item.account.accountType === 'seller')?.account.id || visible[0]?.account.id || '');
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    } finally {
      setBusy(''); setLoading(false);
    }
  }, [selfService]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!canManage) return;
    void loadTeamMembers().then((items) => setMembers(items.filter((item) => item.status === 'active'))).catch(() => setMembers([]));
  }, [canManage]);

  const selected = useMemo(() => accounts.find((item) => item.account.id === selectedId) ?? accounts[0] ?? null, [accounts, selectedId]);
  const selectedBadge = statusUnconfirmed
    ? { label: 'Estado não confirmado', css: 'bg-[#FFF1D8] text-[#965A12]' } : badge(selected);
  const selectedRuntime = runtimeLabel(selected);

  const replace = useCallback((next: WaAkgChannelStatus) => {
    if (!hasAccount(next)) return;
    setStatusUnconfirmed(false);
    setAccounts((current) => current.some((item) => item.account.id === next.account.id)
      ? current.map((item) => item.account.id === next.account.id ? next : item)
      : [...current, next]);
    setSelectedId(next.account.id);
  }, []);

  const inspectRuntime = useCallback(async (accountId: string, announce = false) => {
    setBusy('runtime');
    if (announce) setNotice(null);
    try {
      const next = await inspectWaAkgRuntime(accountId);
      replace(next);
      if (announce) setNotice({ tone: next.runtime?.reachable ? 'success' : 'error', text: next.runtime?.reachable
        ? 'Gateway consultado diretamente; o estado exibido é o estado atual da sessão.'
        : 'O gateway não respondeu à consulta. Nenhuma sessão foi iniciada ou alterada.' });
    } catch (error) {
      if (announce) setNotice({ tone: 'error', text: errorMessage(error) });
    } finally { setBusy(''); }
  }, [replace]);

  useEffect(() => {
    if (statusUnconfirmed || !selected?.configured || selected.account.accountType !== 'seller') return;
    void inspectRuntime(selected.account.id);
  }, [inspectRuntime, selected?.account.accountType, selected?.account.id, selected?.configured, statusUnconfirmed]);

  const run = async (key: string, task: () => Promise<WaAkgChannelStatus>, success: string) => {
    setBusy(key); setNotice(null); setQr(null); setPairingCode('');
    try {
      const next = await task();
      replace(next);
      setNotice({ tone: 'success', text: key === 'activate'
        ? 'Conta habilitada. Recebimento, envio e Ana continuam sujeitos à liberação administrativa separada.' : success });
      if (selfService && !inCentral && (key === 'status' || key === 'activate') && hasAccount(next)
        && isWaAkgOperational(next) && !redirecting.current) {
        redirecting.current = true;
        window.setTimeout(() => navigate('/dashboard/atendimento', { replace: true }), 700);
      }
    }
    catch (error) {
      await refreshAfterLifecycleError(error, refresh);
      setNotice({ tone: 'error', text: errorMessage(error) });
    }
    finally { setBusy(''); }
  };

  const loadQr = useCallback(async () => {
    if (statusUnconfirmed || !selected?.canViewQr || channelLifecycleBlocked(selected.lifecycle)) return;
    setBusy('qr'); setNotice(null); setPairingCode('');
    try {
      const result = await requestWaAkgQr(selected.account.id);
      if (!result.qr.qrcode?.startsWith('data:image/')) throw new Error('wa_akg_qr_unavailable');
      setQr(result.qr.qrcode);
      setNotice({ tone: 'success', text: 'QR Code temporário atualizado. Leia em Aparelhos conectados no WhatsApp.' });
    } catch (error) {
      setQr(null);
      await refreshAfterLifecycleError(error, refresh);
      setNotice({ tone: 'error', text: errorMessage(error) });
    }
    finally { setBusy(''); }
  }, [selected, refresh, statusUnconfirmed]);

  useEffect(() => {
    if (statusUnconfirmed || !selfService || !selected?.canViewQr || channelLifecycleBlocked(selected.lifecycle) || selected.account.connectionStatus !== 'qr') return;
    const key = `${selected.account.id}:${selected.account.checkedAt ?? ''}`;
    if (autoQr.current === key) return;
    autoQr.current = key;
    void loadQr();
  }, [loadQr, selected, selfService, statusUnconfirmed]);

  useEffect(() => {
    if (statusUnconfirmed || !selfService || inCentral || !selected || channelLifecycleBlocked(selected.lifecycle) || selected.account.connectionStatus !== 'qr' || redirecting.current) return;
    const accountId = selected.account.id;
    let cancelled = false;
    const poll = window.setInterval(() => {
      void runWaAkgAction('refresh_status', accountId).then((next) => {
        if (cancelled || !hasAccount(next)) return;
        replace(next);
        if (isWaAkgOperational(next) && !redirecting.current) {
          redirecting.current = true;
          setQr(null);
          setNotice({ tone: 'success', text: 'WhatsApp conectado. Abrindo a Central de Atendimento…' });
          window.setTimeout(() => navigate('/dashboard/atendimento', { replace: true }), 700);
        }
      }).catch(() => undefined);
    }, 3_000);
    return () => { cancelled = true; window.clearInterval(poll); };
  }, [inCentral, navigate, replace, selected, selfService, statusUnconfirmed]);

  const saveGateway = async () => {
    if (!gateway.baseUrl.trim() || !gateway.apiKey.trim()) return;
    setBusy('gateway'); setNotice(null);
    try {
      const next = await configureWaAkgGateway(gateway);
      replace(next); setGateway({ ...gateway, baseUrl: '', apiKey: '' }); setGatewayOpen(false);
      setNotice({ tone: 'success', text: 'Gateway salvo no cofre. Agora provisione uma sessão individual para cada vendedor.' });
    } catch (error) {
      await refreshAfterLifecycleError(error, refresh);
      setNotice({ tone: 'error', text: errorMessage(error) });
    }
    finally { setBusy(''); }
  };

  const createSeller = async () => {
    if (!ownerUserId) return;
    await run('create', () => createWaAkgSellerAccount(ownerUserId), 'Conta individual criada. Conclua o provisionamento para liberar o QR Code.');
    setOwnerUserId('');
  };

  const requestPairing = async () => {
    if (statusUnconfirmed || !selected || channelLifecycleBlocked(selected.lifecycle) || phone.replace(/\D/g, '').length < 10) return;
    setBusy('pair'); setNotice(null); setQr(null); setPairingCode('');
    try {
      const result = await requestWaAkgPairingCode(selected.account.id, phone);
      setPairingCode(result.pairingCode ?? '');
      setNotice({ tone: 'success', text: 'Código temporário gerado. Digite-o no WhatsApp em Aparelhos conectados.' });
    } catch (error) {
      await refreshAfterLifecycleError(error, refresh);
      setNotice({ tone: 'error', text: errorMessage(error) });
    }
    finally { setBusy(''); }
  };

  if (loading) return <section className="wf-surface p-6 text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin" />Carregando seu canal WA-AKG…</section>;

  return <section id={selfService ? (inCentral ? 'central-whatsapp-account' : 'my-wa-akg-account') : 'wa-akg-configuration'} className="wf-surface overflow-hidden">
    <header className="flex flex-col gap-3 border-b border-background-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F7EF] text-xl text-[#168654]"><i className="ri-whatsapp-line" /></span><div><p className="wf-eyebrow">{selfService ? 'Canal individual' : administrationEyebrow}</p><h2 className="mt-1 text-lg font-bold text-foreground-950">{selfService ? (inCentral ? 'Conectar meu WhatsApp' : 'Meu WhatsApp') : 'WA-AKG + Ana'}</h2><p className="mt-1 text-xs leading-5 text-foreground-500">{selfService ? (inCentral ? 'Conecte seu número aqui. Recebimento e envio dependem de autorização administrativa; a conexão não libera a Ana.' : 'Conecte seu número; suas conversas aparecem na Central de Atendimento.') : administrationDescription}</p></div></div>
      <div className="flex gap-2"><button type="button" className="wf-btn-secondary text-xs" disabled={Boolean(busy)} onClick={() => void refresh()}><i className={busy === 'refresh' ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} />Atualizar</button>{canManage && <button type="button" className="wf-btn-primary text-xs" onClick={() => setGatewayOpen((value) => !value)}><i className="ri-settings-3-line" />Configurar gateway</button>}</div>
    </header>

    <div className="space-y-4 p-5">
      {channelLifecycleMessage(selected?.lifecycle) && <p role="status" className="rounded-xl border border-background-200 bg-background-50 px-3 py-2 text-xs text-foreground-700">{channelLifecycleMessage(selected?.lifecycle)}</p>}
      {canManage && selected && channelLifecycleBlocked(selected.lifecycle) && <ChannelLifecycleRecovery key={`${selected.account.id}:${selected.lifecycle?.revision}`} provider="wa_akg" accountId={selected.account.id} disabled={Boolean(busy) || statusUnconfirmed} onReconciled={refresh} />}
      {notice && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-3 py-2 text-xs ${notice.tone === 'success' ? 'border-[#B9E4CB] bg-[#EFFAF3] text-[#176B43]' : 'border-[#E8B8B1] bg-[#FFF4F2] text-[#8B3027]'}`}>{notice.text}</p>}

      {canManage && gatewayOpen && <div className="rounded-xl border border-background-200 bg-background-50 p-4"><h3 className="text-sm font-semibold text-foreground-900">Gateway WA-AKG</h3><p className="mt-1 text-xs leading-5 text-foreground-500">A URL e a chave ficam somente no cofre do backend. O navegador nunca recebe esses valores de volta.</p><div className="mt-3 grid gap-3 md:grid-cols-3"><label className="text-xs font-medium text-foreground-700">Nome do canal<input className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm" value={gateway.label} onChange={(event) => setGateway({ ...gateway, label: event.target.value })} /></label><label className="text-xs font-medium text-foreground-700">URL HTTPS do servidor<input type="password" autoComplete="new-password" spellCheck={false} className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm" placeholder="https://wa.suaempresa.com" value={gateway.baseUrl} onChange={(event) => setGateway({ ...gateway, baseUrl: event.target.value })} /></label><label className="text-xs font-medium text-foreground-700">Chave da API<input type="password" autoComplete="new-password" spellCheck={false} className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm" value={gateway.apiKey} onChange={(event) => setGateway({ ...gateway, apiKey: event.target.value })} /></label></div><div className="mt-3 flex justify-end"><button type="button" className="wf-btn-primary text-xs disabled:opacity-60" disabled={Boolean(busy) || !gateway.baseUrl.trim() || !gateway.apiKey.trim()} onClick={() => void saveGateway()}>{busy === 'gateway' ? 'Salvando…' : 'Salvar no cofre'}</button></div></div>}

      {canManage && <div className="flex flex-col gap-2 rounded-xl border border-background-200 bg-background-50 p-3 sm:flex-row sm:items-end"><label className="flex-1 text-xs font-medium text-foreground-700">Criar canal individual<select className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm" value={ownerUserId} onChange={(event) => setOwnerUserId(event.target.value)}><option value="">Selecione o vendedor</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.name} · {member.email}</option>)}</select></label><button type="button" className="wf-btn-secondary text-xs disabled:opacity-60" disabled={Boolean(busy) || !ownerUserId} onClick={() => void createSeller()}><i className="ri-user-add-line" />Criar conta</button></div>}

      {accounts.length === 0 ? <div className="rounded-xl border border-dashed border-background-300 bg-background-50 p-7 text-center"><i className="ri-qr-code-line text-3xl text-foreground-300" /><p className="mt-2 font-semibold text-foreground-800">{selfService ? 'Seu canal ainda não foi criado' : 'Nenhuma conta WA-AKG'}</p><p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-foreground-500">{selfService ? 'Quando o administrador criar seu acesso, a sessão será provisionada automaticamente e o QR aparecerá aqui.' : 'Configure o gateway e crie uma conta individual para cada vendedor.'}</p></div> : <>
        {!selfService && <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{accounts.map((item) => <button key={item.account.id} type="button" onClick={() => { setSelectedId(item.account.id); setQr(null); setPairingCode(''); }} className={`min-w-0 rounded-xl border p-3 text-left ${item.account.id === selected?.account.id ? 'border-primary-300 bg-primary-50' : 'border-background-200 bg-white'}`}><span className="block truncate text-sm font-semibold text-foreground-900">{item.account.label}</span><span className="mt-1 block text-[11px] text-foreground-500">{item.account.accountType === 'seller' ? 'Vendedor individual' : 'Configuração do gateway'}</span></button>)}</div>}

        {selected && <article className="rounded-xl border border-background-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-foreground-950">{selected.account.label}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${selectedBadge.css}`}>{selectedBadge.label}</span></div><p className="mt-1 text-xs text-foreground-500">{selected.account.accountType === 'seller' ? 'Sessão privada; mensagens saem pelo número deste vendedor.' : 'Conta administrativa; não envia até ser explicitamente ativada.'}</p></div><div className="flex flex-wrap gap-2">{canManage && selected.account.accountType === 'seller' && !channelLifecycleBlocked(selected.lifecycle) && (!selected.configured || (!selected.account.enabled && selected.account.connectionStatus === 'configured')) && <button type="button" className="wf-btn-primary text-xs" disabled={Boolean(busy)} onClick={() => void run('provision', () => provisionWaAkgAccount(selected.account.id), 'Sessão criada. O vendedor já pode abrir a Central e ler o QR Code.')}><i className="ri-cloud-line" />{busy === 'provision' ? 'Provisionando…' : 'Provisionar sessão'}</button>}<button type="button" className="wf-btn-secondary text-xs" disabled={Boolean(busy)} onClick={() => void run('status', () => runWaAkgAction('refresh_status', selected.account.id), 'Status atualizado diretamente do WA-AKG.')}><i className="ri-refresh-line" />Atualizar status</button></div></div>

          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">Conexão</dt><dd className="mt-1 font-semibold text-foreground-900">{statusUnconfirmed ? 'Não confirmado' : selected.account.connectionStatus}</dd></div><div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">Número</dt><dd className="mt-1 font-semibold text-foreground-900">{selected.account.phoneSuffix ? `Final ${selected.account.phoneSuffix}` : 'Não confirmado'}</dd></div><div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">Ana automática</dt><dd className="mt-1 font-semibold text-foreground-900">{statusUnconfirmed ? 'Não confirmado' : isWaAkgOperational(selected) && selected.controls?.automationEnabled ? 'Liberada pelas regras' : 'Protegida'}</dd></div><div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">Cadência</dt><dd className="mt-1 font-semibold text-foreground-900">{selected.controls ? `${selected.controls.minDelaySeconds}–${selected.controls.maxDelaySeconds}s` : '10–30s'}</dd></div></dl>

          {selected.account.accountType === 'seller' && selected.configured && <><section className="mt-4 rounded-xl border border-background-200 bg-background-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-semibold text-foreground-900">Monitoramento do gateway</h4><p className="mt-1 text-xs leading-5 text-foreground-500">Consulta direta, sem iniciar ou alterar a sessão. Os controles abaixo operam somente esta sessão do vendedor; o painel não expõe reinício do Docker.</p></div><button type="button" className="wf-btn-secondary text-xs" disabled={Boolean(busy)} onClick={() => void inspectRuntime(selected.account.id, true)}><i className={busy === 'runtime' ? 'ri-loader-4-line animate-spin' : 'ri-radar-line'} />Consultar agora</button></div><dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3"><div className="rounded-xl bg-white p-3"><dt className="text-foreground-500">Gateway</dt><dd className={`mt-1 inline-flex rounded-full px-2 py-1 font-semibold ${selectedRuntime.css}`}>{selectedRuntime.gateway}</dd></div><div className="rounded-xl bg-white p-3"><dt className="text-foreground-500">Sessão no gateway</dt><dd className="mt-1 font-semibold text-foreground-900">{selectedRuntime.session}</dd></div><div className="rounded-xl bg-white p-3"><dt className="text-foreground-500">Última consulta</dt><dd className="mt-1 font-semibold text-foreground-900">{checkedAt(selected.runtime?.checkedAt)}</dd></div></dl><div className="mt-3 flex flex-wrap gap-2">{selected.account.connectionStatus === 'connected' ? <button type="button" className="wf-btn-secondary text-xs" disabled={Boolean(busy) || !selected.canConnect} onClick={() => void run('logout', () => unlinkWaAkgDevice(selected.account.id), 'Dispositivo desconectado. A conta e o histórico foram preservados.')}><i className="ri-logout-circle-line" />Desconectar dispositivo</button> : <button type="button" className="wf-btn-primary text-xs" disabled={Boolean(busy) || !selected.canConnect} onClick={() => void run('connect', () => runWaAkgAction('connect', selected.account.id), 'Sessão iniciada. Consulte o estado antes de gerar o QR Code.')}><i className="ri-link" />Conectar dispositivo</button>}</div></section><div className="mt-4 grid gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]"><div className="rounded-xl border border-background-200 bg-background-50 p-4"><h4 className="text-sm font-semibold text-foreground-900">Conectar o telefone</h4><p className="mt-1 text-xs leading-5 text-foreground-500">No WhatsApp, abra Aparelhos conectados → Conectar aparelho e leia o código abaixo.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="wf-btn-primary text-xs" disabled={Boolean(busy) || !selected.canViewQr} onClick={() => void loadQr()}><i className="ri-qr-code-line" />{busy === 'qr' ? 'Gerando…' : 'Gerar novo QR'}</button></div>{qr && <div className="mt-4 flex justify-center rounded-xl border border-background-200 bg-white p-3"><img src={qr} alt="QR Code temporário do WhatsApp" className="h-64 w-64 max-w-full" /></div>}<div className="mt-4 flex gap-2"><input inputMode="tel" className="min-w-0 flex-1 rounded-lg border border-background-200 bg-white px-3 py-2 text-sm" placeholder="55 11 99999-9999" value={phone} onChange={(event) => setPhone(event.target.value)} /><button type="button" className="wf-btn-secondary text-xs" disabled={Boolean(busy) || phone.replace(/\D/g, '').length < 10} onClick={() => void requestPairing()}>{busy === 'pair' ? 'Gerando…' : 'Gerar código'}</button></div>{pairingCode && <p className="mt-3 rounded-xl bg-white p-3 text-center text-xl font-bold tracking-[.25em] text-foreground-950">{pairingCode}</p>}</div>

            <div className="rounded-xl border border-background-200 p-4"><h4 className="text-sm font-semibold text-foreground-900">Operação automática segura</h4><p className="mt-1 text-xs leading-5 text-foreground-500">Quando o canal e o modo automático da Ana estiverem ativos, ela recebe, qualifica, responde e atualiza o funil. Opt-out, horário comercial, limites, transferência humana e botão de emergência continuam obrigatórios.</p><div className="mt-3 flex flex-wrap gap-2">{selected.account.connectionStatus === 'connected' && !selected.account.enabled ? <button type="button" className="wf-btn-primary text-xs" disabled={Boolean(busy)} onClick={() => void run('activate', () => runWaAkgAction('activate', selected.account.id), 'Conta habilitada. Os controles administrativos de envio e da Ana permanecem separados.')}><i className="ri-shield-check-line" />Habilitar conta</button> : selected.account.enabled ? <button type="button" className="wf-btn-secondary text-xs" disabled={Boolean(busy)} onClick={() => void run('deactivate', () => runWaAkgAction('deactivate', selected.account.id), 'Canal pausado sem apagar a sessão.')}><i className="ri-pause-circle-line" />Pausar canal</button> : null}</div>{!inCentral && <Link to="/dashboard/atendimento" className="wf-btn-secondary mt-3 inline-flex text-xs"><i className="ri-customer-service-2-line" />Abrir Central de Atendimento</Link>}</div></div></>}

          {canManage && selected.controls && <form className="mt-4 rounded-xl border border-background-200 bg-background-50 p-4" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void run('controls', () => saveWaAkgControls(selected.account.id, { minDelaySeconds: Number(form.get('min')), maxDelaySeconds: Number(form.get('max')), burstLimit: Number(form.get('burst')), dailyLimit: Number(form.get('daily')) }), 'Limites operacionais atualizados.'); }}><h4 className="text-sm font-semibold text-foreground-900">Limites de cadência</h4><p className="mt-1 text-xs text-foreground-500">Atrasos reduzem rajadas, mas não garantem ausência de bloqueios pelo WhatsApp.</p><div className="mt-3 grid gap-3 sm:grid-cols-4"><label className="text-xs">Atraso mínimo (s)<input name="min" type="number" min="10" max="300" defaultValue={selected.controls.minDelaySeconds} className="mt-1 w-full rounded-lg border border-background-200 bg-white px-3 py-2" /></label><label className="text-xs">Atraso máximo (s)<input name="max" type="number" min="10" max="600" defaultValue={selected.controls.maxDelaySeconds} className="mt-1 w-full rounded-lg border border-background-200 bg-white px-3 py-2" /></label><label className="text-xs">Rajada por minuto<input name="burst" type="number" min="1" max="20" defaultValue={selected.controls.burstLimit} className="mt-1 w-full rounded-lg border border-background-200 bg-white px-3 py-2" /></label><label className="text-xs">Limite diário<input name="daily" type="number" min="1" max="5000" defaultValue={selected.controls.dailyLimit} className="mt-1 w-full rounded-lg border border-background-200 bg-white px-3 py-2" /></label></div><div className="mt-3 flex justify-end"><button type="submit" className="wf-btn-secondary text-xs" disabled={Boolean(busy)}>{busy === 'controls' ? 'Salvando…' : 'Salvar limites'}</button></div></form>}

          {canManage && selected.controls && selected.account.accountType === 'seller' && <form className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const inboundEnabled = form.get('inbound') === 'on'; const sendEnabled = form.get('send') === 'on'; const automationEnabled = form.get('automation') === 'on'; void run('provider-controls', () => setWaAkgProviderControls(selected.account.id, { inboundEnabled, sendEnabled, automationEnabled, killSwitch: !(inboundEnabled || sendEnabled || automationEnabled) }), 'Política operacional registrada. A Ana só atua se a automação também estiver liberada pelas demais regras.'); }}><h4 className="text-sm font-semibold text-foreground-900">Liberação operacional</h4><p className="mt-1 text-xs leading-5 text-foreground-600">Use somente após confirmar o QR, o número e o status conectado. Esta política não envia nenhuma mensagem; ela apenas autoriza a Central a operar quando houver uma ação humana ou uma regra válida.</p><div className="mt-3 flex flex-col gap-2 text-xs text-foreground-800 sm:flex-row sm:gap-5"><label className="flex items-center gap-2"><input name="inbound" type="checkbox" defaultChecked={selected.controls.inboundEnabled} />Receber mensagens</label><label className="flex items-center gap-2"><input name="send" type="checkbox" defaultChecked={selected.controls.sendEnabled} />Permitir respostas humanas</label><label className="flex items-center gap-2"><input name="automation" type="checkbox" defaultChecked={selected.controls.automationEnabled} />Permitir Ana automática</label></div><div className="mt-3 flex justify-end"><button type="submit" className="wf-btn-secondary text-xs" disabled={Boolean(busy)}>{busy === 'provider-controls' ? 'Salvando…' : 'Salvar política'}</button></div></form>}
        </article>}
      </>}
    </div>
  </section>;
}
