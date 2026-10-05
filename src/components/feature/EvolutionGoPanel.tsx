import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadTeamMembers, type TeamMember } from '@/lib/crm/teamMembersRepository';
import { isEvolutionGoAutomationReady, isEvolutionGoOperational } from '@/lib/crm/evolutionGoOnboarding';
import { channelLifecycleBlocked, channelLifecycleMessage, refreshAfterLifecycleError } from '@/lib/crm/channelLifecycle';
import {
  createEvolutionGoAccount,
  createEvolutionGoInstance,
  loadEvolutionGoAccounts,
  loadMyEvolutionGoAccount,
  requestEvolutionGoPairingCode,
  requestEvolutionGoQr,
  runEvolutionGoAction,
  saveEvolutionGoConfiguration,
  type EvolutionGoAccountInput,
  type EvolutionGoChannelStatus,
  type EvolutionGoConfigurationInput,
  type WhatsappConnectionStatus,
} from '@/lib/crm/whatsappAccountsRepository';

type Notice = { tone: 'success' | 'error'; text: string };
type Account = NonNullable<EvolutionGoChannelStatus['account']>;
type AccountStatus = EvolutionGoChannelStatus & { account: Account };
type QrState = { accountId: string; qrcode: string | null; code: string | null; expiresAt: string | null };
type PairingState = { accountId: string; code: string };
type ConfigurationForm = Required<Pick<EvolutionGoConfigurationInput, 'label' | 'baseUrl' | 'globalApiKey' | 'instanceToken' | 'instanceName' | 'instanceId'>>;
export type EvolutionGoPanelMode = 'administration' | 'self-service';

const emptyAccountForm: EvolutionGoAccountInput = { accountType: 'corporate', label: '', ownerUserId: '' };
const emptyConfigurationForm: ConfigurationForm = { label: '', baseUrl: '', globalApiKey: '', instanceToken: '', instanceName: '', instanceId: '' };

const connectionCopy: Record<WhatsappConnectionStatus, string> = {
  unconfigured: 'Não configurada',
  configured: 'Configurada',
  qr: 'Aguardando leitura do QR',
  connected: 'Conectada',
  disconnected: 'Desconectada',
  expired: 'Sessão expirada',
  error: 'Requer atenção',
};

function evolutionGoStatusCopy(status: EvolutionGoChannelStatus | null) {
  if (channelLifecycleBlocked(status?.lifecycle)) return { label: status?.lifecycle?.state === 'pending' || status?.lifecycle?.state === 'in_flight' ? 'Operação pendente' : 'Requer revisão', className: 'bg-[#FFF1D8] text-[#965A12]', icon: 'ri-time-line' };
  if (!status?.account || !status.configured) {
    return { label: 'Aguardando provisionamento', className: 'bg-background-100 text-foreground-600', icon: 'ri-settings-4-line' };
  }
  if (status.account.connectionStatus === 'error' || status.account.connectionStatus === 'expired') {
    return { label: 'Requer atenção', className: 'bg-accent-50 text-accent-800', icon: 'ri-error-warning-line' };
  }
  if (status.account.connectionStatus === 'qr') {
    return { label: 'Aguardando conexão', className: 'bg-[#FFF1D8] text-[#965A12]', icon: 'ri-qr-code-line' };
  }
  if (status.account.connectionStatus === 'configured') {
    return { label: 'Pronta para conectar', className: 'bg-[#FFF1D8] text-[#965A12]', icon: 'ri-time-line' };
  }
  if (status.account.connectionStatus !== 'connected' || status.integration?.connected !== true) {
    return { label: 'Desconectada', className: 'bg-[#EEF1F3] text-[#68757D]', icon: 'ri-link-unlink-m' };
  }
  if (!status.account.enabled || status.integration.enabled !== true || status.integration.paused
    || status.controls?.killSwitch !== false || status.controls?.inboundEnabled !== true || status.controls?.sendEnabled !== true) {
    return { label: 'Conectada · uso protegido', className: 'bg-[#FFF1D8] text-[#965A12]', icon: 'ri-shield-check-line' };
  }
  return { label: 'Operacional', className: 'bg-[#E8F7EF] text-[#147445]', icon: 'ri-checkbox-circle-line' };
}

function hasAccount(status: EvolutionGoChannelStatus): status is AccountStatus {
  return Boolean(status.account?.id);
}

function errorCopy(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const map: Record<string, string> = {
    account_lifecycle_pending: 'Operação pendente. Use Atualizar para consultar o resultado; não há confirmação de conclusão.',
    account_lifecycle_needs_review: 'A conta precisa de revisão administrativa antes de repetir a operação.',
    account_lifecycle_persistence_failed: 'Não foi possível confirmar a gravação. Consulte o estado antes de tentar novamente.',
    permission_denied: 'Seu usuário não possui permissão para gerenciar esta conta.',
    evolution_go_account_not_found: 'A conta não foi encontrada ou não está disponível para seu usuário.',
    evolution_go_account_id_required: 'Não foi possível identificar a conta selecionada.',
    evolution_go_account_owner_required: 'Selecione um usuário ativo para a conta individual.',
    evolution_go_account_owner_already_assigned: 'Este usuário já possui uma conta Evolution GO.',
    evolution_go_allowed_origins_not_configured: 'O domínio HTTPS do Evolution GO ainda não foi liberado no ambiente seguro.',
    evolution_go_instance_create_credentials_required: 'O servidor ainda não possui o provisionamento seguro necessário para criar a instância.',
    evolution_go_credentials_required: 'Informe os dados exigidos para esta instância. Campos vazios preservam valores que já estejam no cofre.',
    evolution_go_credentials_incomplete: 'A instância ainda depende de provisionamento administrativo no servidor.',
    evolution_go_credentials_save_failed: 'Não foi possível armazenar a configuração no cofre do servidor.',
    evolution_go_connection_validation_required: 'Conecte a instância e atualize o status antes de ativar o uso operacional.',
    evolution_go_phone_required: 'Informe o telefone com DDI e DDD para gerar o código.',
    evolution_go_qr_unavailable: 'A instância ainda está iniciando. Aguarde alguns segundos e gere um novo QR Code.',
    evolution_go_qr_runtime_not_ready: 'A instância não iniciou no servidor Evolution GO. Verifique a capacidade do servidor antes de gerar outro QR Code.',
    evolution_go_pair_runtime_not_ready: 'A instância ainda está iniciando. Aguarde alguns segundos e gere o código novamente uma única vez.',
    evolution_go_instance_already_connected: 'Esta conta já está conectada. Atualize o status antes de iniciar outro pareamento.',
    evolution_go_pair_provider_rejected: 'A Evolution GO recusou o código após preparar a sessão. Gere um novo QR Code ou verifique a versão do servidor Evolution GO.',
  };
  return map[code] || 'Não foi possível confirmar a operação. Consulte o estado antes de tentar novamente; nenhum envio foi autorizado por esta resposta.';
}

function stamp(value: string | null | undefined) {
  if (!value) return 'Ainda não registrado';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Data indisponível'
    : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function accountScope(account: Account, members: TeamMember[]) {
  if (account.accountType === 'corporate') return 'Corporativa · compartilhada pela empresa';
  const owner = members.find((member) => member.userId === account.ownerUserId);
  return owner ? `Individual · ${owner.name}` : 'Individual · vendedor responsável';
}

/**
 * The administration mode manages the organization collection. Self-service
 * is deliberately narrower: the server returns only the authenticated
 * seller's own account and this component exposes connection actions only.
 * Stored provider secrets are never returned or prefilled in either mode.
 */
export default function EvolutionGoPanel({ mode = 'administration' }: { mode?: EvolutionGoPanelMode }) {
  const selfService = mode === 'self-service';
  const [accounts, setAccounts] = useState<AccountStatus[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersError, setMembersError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusUnconfirmed, setStatusUnconfirmed] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [adding, setAdding] = useState(false);
  const [accountForm, setAccountForm] = useState<EvolutionGoAccountInput>(emptyAccountForm);
  const [configuring, setConfiguring] = useState(false);
  const [configurationForm, setConfigurationForm] = useState<ConfigurationForm>(emptyConfigurationForm);
  const [phone, setPhone] = useState('');
  const [qr, setQr] = useState<QrState | null>(null);
  const [pairing, setPairing] = useState<PairingState | null>(null);
  const autoQrRequest = useRef<string | null>(null);

  const refresh = useCallback(async (clearNotice = true) => {
    setBusy('refresh');
    setStatusUnconfirmed(true);
    setQr(null); setPairing(null);
    if (clearNotice) setNotice(null);
    try {
      const result = selfService
        ? { accounts: [await loadMyEvolutionGoAccount()], canManage: false }
        : await loadEvolutionGoAccounts();
      const visibleAccounts = result.accounts.filter(hasAccount);
      setAccounts(visibleAccounts);
      setStatusUnconfirmed(false);
      setCanManage(selfService ? false : result.canManage);
      setSelectedAccountId((current) => {
        if (visibleAccounts.some((status) => status.account.id === current)) return current;
        return visibleAccounts.find((status) => status.canConnect && status.account.accountType === 'seller')?.account.id
          || visibleAccounts.find((status) => status.account.isDefault)?.account.id
          || visibleAccounts[0]?.account.id
          || '';
      });
    } catch (error) {
      setNotice({ tone: 'error', text: errorCopy(error) });
    } finally {
      setLoading(false);
      setBusy(null);
    }
  }, [selfService]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!canManage) {
      setMembers([]);
      setMembersError(false);
      return;
    }
    let active = true;
    void loadTeamMembers()
      .then((result) => {
        if (!active) return;
        setMembers(result.filter((member) => member.status === 'active'));
        setMembersError(false);
      })
      .catch(() => { if (active) setMembersError(true); });
    return () => { active = false; };
  }, [canManage]);

  useEffect(() => {
    setQr(null);
    setPairing(null);
    setPhone('');
    setConfiguring(false);
    setConfigurationForm(emptyConfigurationForm);
  }, [selectedAccountId]);

  const selected = useMemo(
    () => accounts.find((status) => status.account.id === selectedAccountId) ?? accounts[0] ?? null,
    [accounts, selectedAccountId],
  );

  const replaceStatus = (next: EvolutionGoChannelStatus) => {
    if (!hasAccount(next)) return;
    setStatusUnconfirmed(false);
    setAccounts((current) => {
      const exists = current.some((status) => status.account.id === next.account.id);
      return exists
        ? current.map((status) => status.account.id === next.account.id ? next : status)
        : [...current, next];
    });
    setSelectedAccountId(next.account.id);
  };

  const run = async (key: string, task: () => Promise<EvolutionGoChannelStatus>, success: string) => {
    setBusy(key);
    setNotice(null);
    setQr(null);
    setPairing(null);
    try {
      const next = await task();
      replaceStatus(next);
      setNotice({ tone: 'success', text: key.startsWith('activate:')
        ? 'Conta habilitada. Recebimento, envio e Ana continuam sujeitos à liberação administrativa separada.' : success });
    } catch (error) {
      await refreshAfterLifecycleError(error, () => refresh(false));
      setNotice({ tone: 'error', text: errorCopy(error) });
    } finally {
      setBusy(null);
    }
  };

  const addAccount = async () => {
    const label = accountForm.label.trim();
    if (!label || (accountForm.accountType === 'seller' && !accountForm.ownerUserId)) {
      setNotice({ tone: 'error', text: accountForm.accountType === 'seller' ? 'Informe o nome do canal e selecione o vendedor responsável.' : 'Informe o nome do canal.' });
      return;
    }
    setBusy('create_account');
    setNotice(null);
    try {
      const next = await createEvolutionGoAccount({ ...accountForm, label });
      replaceStatus(next);
      setAccountForm(emptyAccountForm);
      setAdding(false);
      setNotice({ tone: 'success', text: 'Conta adicionada. O canal permanece protegido até o provisionamento e a conexão serem confirmados.' });
    } catch (error) {
      setNotice({ tone: 'error', text: errorCopy(error) });
    } finally {
      setBusy(null);
    }
  };

  const openConfiguration = () => {
    if (!selected) return;
    setConfigurationForm({ ...emptyConfigurationForm, label: selected.account.label });
    setConfiguring((current) => !current);
    setNotice(null);
  };

  const submitConfiguration = async (mode: 'save' | 'create') => {
    if (!selected) return;
    const input: EvolutionGoConfigurationInput = {
      label: configurationForm.label.trim() || selected.account.label,
      baseUrl: configurationForm.baseUrl.trim() || undefined,
      globalApiKey: configurationForm.globalApiKey.trim() || undefined,
      instanceToken: configurationForm.instanceToken.trim() || undefined,
      instanceName: configurationForm.instanceName.trim() || undefined,
      instanceId: configurationForm.instanceId.trim() || undefined,
    };
    setBusy(`${mode}:${selected.account.id}`);
    setNotice(null);
    try {
      const next = mode === 'save'
        ? await saveEvolutionGoConfiguration(selected.account.id, input)
        : await createEvolutionGoInstance(selected.account.id, input);
      replaceStatus(next);
      setConfiguring(false);
      setNotice({
        tone: 'success',
        text: mode === 'save'
          ? 'Configuração armazenada no cofre. Os valores enviados não serão exibidos pela interface.'
          : 'Instância criada e armazenada no ambiente seguro. Inicie a conexão para gerar o pareamento.',
      });
    } catch (error) {
      await refreshAfterLifecycleError(error, () => refresh(false));
      setNotice({ tone: 'error', text: errorCopy(error) });
    } finally {
      setConfigurationForm({ ...emptyConfigurationForm, label: input.label || '' });
      setBusy(null);
    }
  };

  const action = (
    name: Parameters<typeof runEvolutionGoAction>[0],
    success: string,
  ) => {
    if (!selected) return;
    void run(`${name}:${selected.account.id}`, () => runEvolutionGoAction(name, selected.account.id), success);
  };

  const loadQr = useCallback(async () => {
    if (statusUnconfirmed || !selected?.canViewQr || channelLifecycleBlocked(selected.lifecycle)) return;
    const accountId = selected.account.id;
    setBusy(`qr:${accountId}`);
    setNotice(null);
    setPairing(null);
    try {
      const result = await requestEvolutionGoQr(accountId);
      setQr({ accountId, ...result.qr });
      setNotice({ tone: 'success', text: 'QR Code temporário atualizado pelo backend autorizado.' });
    } catch (error) {
      setQr(null);
      await refreshAfterLifecycleError(error, () => refresh(false));
      setNotice({ tone: 'error', text: errorCopy(error) });
    } finally {
      setBusy(null);
    }
  }, [selected, refresh, statusUnconfirmed]);

  const requestPairing = async () => {
    if (statusUnconfirmed || !selected?.canViewQr || channelLifecycleBlocked(selected.lifecycle)) return;
    const accountId = selected.account.id;
    setBusy(`pair:${accountId}`);
    setNotice(null);
    try {
      const result = await requestEvolutionGoPairingCode(accountId, phone);
      // A successful phone pairing replaces the QR ceremony. Keep a current
      // QR visible after a failed code request so the operator still has a
      // safe fallback instead of losing the only actionable connection path.
      setQr(null);
      setPairing(result.pairingCode ? { accountId, code: result.pairingCode } : null);
      setNotice({ tone: 'success', text: result.pairingCode ? 'Código temporário gerado para a conta selecionada.' : 'O provedor não retornou um código. Atualize o status e tente novamente.' });
    } catch (error) {
      setPairing(null);
      await refreshAfterLifecycleError(error, () => refresh(false));
      setNotice({ tone: 'error', text: errorCopy(error) });
    } finally {
      setBusy(null);
    }
  };

  const selectedBadge = statusUnconfirmed
    ? { label: 'Estado não confirmado', className: 'bg-[#FFF1D8] text-[#965A12]', icon: 'ri-time-line' }
    : evolutionGoStatusCopy(selected);
  const selectedScope = selected
    ? selfService ? 'Sua conta individual Evolution GO' : accountScope(selected.account, members)
    : '';
  const selectedConnected = !statusUnconfirmed && selected?.account.connectionStatus === 'connected' && selected.integration?.connected === true;
  const selectedActive = selected?.account.enabled === true;
  const selectedOperational = !statusUnconfirmed && isEvolutionGoOperational(selected);
  const selectedAutomationReady = !statusUnconfirmed && isEvolutionGoAutomationReady(selected);
  const selectedPairingOpen = !statusUnconfirmed && selected?.account.connectionStatus === 'qr' && !channelLifecycleBlocked(selected.lifecycle);
  const phoneValid = phone.replace(/\D/g, '').length >= 10;
  const qrForSelected = selected?.canViewQr && qr?.accountId === selected.account.id ? qr : null;
  const pairingForSelected = selected?.canViewQr && pairing?.accountId === selected.account.id ? pairing : null;
  const qrImage = qrForSelected?.qrcode?.startsWith('data:image/') ? qrForSelected.qrcode : null;

  useEffect(() => {
    if (!selfService || !selectedPairingOpen || !selected?.canViewQr) return;
    const key = `${selected.account.id}:${selected.account.connectionStatus}`;
    if (autoQrRequest.current === key) return;
    autoQrRequest.current = key;
    // QR data is short-lived and never persisted by the browser. The seller
    // arrives directly on this screen after login, so make the first scan
    // available without requiring them to discover a second action.
    void loadQr();
  }, [loadQr, selected?.account.connectionStatus, selected?.account.id, selected?.canViewQr, selectedPairingOpen, selfService]);

  return <section id={selfService ? 'my-evolution-go-account' : 'evolution-go-configuration'} className="rounded-2xl border border-background-200 bg-white p-5 shadow-[0_10px_24px_rgba(29,29,31,0.035)]" aria-label={selfService ? 'Meu WhatsApp Evolution GO' : 'Gerenciador de contas Evolution GO'}>
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F7EF] text-xl text-[#168654]"><i className="ri-whatsapp-line" /></span>
        <div><h4 className="font-semibold text-foreground-950">{selfService ? 'Meu WhatsApp' : 'Evolution GO'}</h4><p className="mt-1 text-xs leading-5 text-foreground-500">{selfService ? 'Conecte sua instância individual Evolution GO por QR Code ou código temporário.' : 'Contas corporativas compartilhadas e contas individuais isoladas por vendedor.'}</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => void refresh()}><i className={busy === 'refresh' ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} />Atualizar</button>
        {canManage && <button type="button" className="wf-btn-primary text-xs" disabled={busy !== null} onClick={() => { setAdding((value) => !value); setNotice(null); }}><i className="ri-add-line" />Adicionar conta</button>}
      </div>
    </header>

    <p className="mt-3 rounded-xl border border-background-200 bg-background-50 px-3 py-2 text-[11px] leading-5 text-foreground-500"><i className="ri-lock-2-line mr-1" />Valores já armazenados permanecem no backend. A interface recebe somente metadados, permissões e estados operacionais e nunca preenche os campos protegidos.</p>
    {channelLifecycleMessage(selected?.lifecycle) && <p role="status" className="mt-4 rounded-xl border border-background-200 bg-background-50 px-3 py-2 text-xs text-foreground-700">{channelLifecycleMessage(selected?.lifecycle)}</p>}
    {notice && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-xl border px-3 py-2 text-xs ${notice.tone === 'success' ? 'border-[#B9E4CB] bg-[#EFFAF3] text-[#176B43]' : 'border-[#E8B8B1] bg-[#FFF4F2] text-[#8B3027]'}`}>{notice.text}</p>}

    {adding && canManage && <div className="mt-4 rounded-xl border border-background-200 bg-background-50 p-4">
      <div className="flex items-start justify-between gap-3"><div><h5 className="text-sm font-semibold text-foreground-900">Nova conta Evolution GO</h5><p className="mt-1 text-xs leading-5 text-foreground-500">A criação registra somente o vínculo operacional. O provisionamento continua fechado no servidor.</p></div><button type="button" className="rounded-lg p-1.5 text-foreground-500 hover:bg-background-100" onClick={() => setAdding(false)} aria-label="Fechar cadastro"><i className="ri-close-line" /></button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-foreground-700">Escopo<select value={accountForm.accountType} onChange={(event) => setAccountForm({ accountType: event.target.value as EvolutionGoAccountInput['accountType'], label: accountForm.label, ownerUserId: '' })} className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm"><option value="corporate">Corporativa compartilhada</option><option value="seller">Individual por vendedor</option></select></label>
        <label className="text-xs font-medium text-foreground-700">Nome do canal<input value={accountForm.label} onChange={(event) => setAccountForm({ ...accountForm, label: event.target.value })} placeholder={accountForm.accountType === 'corporate' ? 'WhatsApp corporativo' : 'WhatsApp comercial'} className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm" /></label>
        {accountForm.accountType === 'seller' && <label className="text-xs font-medium text-foreground-700 sm:col-span-2">Vendedor responsável<select value={accountForm.ownerUserId} onChange={(event) => setAccountForm({ ...accountForm, ownerUserId: event.target.value })} disabled={membersError || members.length === 0} className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm disabled:opacity-60"><option value="">Selecione um usuário ativo</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.name} · {member.email}</option>)}</select>{membersError && <span className="mt-1 block text-[11px] text-accent-700">A equipe não pôde ser carregada. Atualize a página antes de criar uma conta individual.</span>}</label>}
      </div>
      <div className="mt-4 flex justify-end gap-2"><button type="button" className="wf-btn-secondary text-xs" onClick={() => setAdding(false)}>Cancelar</button><button type="button" className="wf-btn-primary text-xs disabled:opacity-60" disabled={busy !== null || !accountForm.label.trim() || (accountForm.accountType === 'seller' && !accountForm.ownerUserId)} onClick={() => void addAccount()}>{busy === 'create_account' ? 'Adicionando…' : 'Adicionar conta'}</button></div>
    </div>}

    {loading ? <div className="mt-4 rounded-xl border border-background-200 p-7 text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin" />Carregando contas autorizadas…</div>
      : accounts.length === 0
        ? <div className="mt-4 rounded-xl border border-dashed border-background-300 bg-background-50 p-7 text-center"><i className="ri-whatsapp-line text-3xl text-foreground-300" /><p className="mt-2 font-semibold text-foreground-800">Nenhuma conta Evolution GO disponível</p><p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-foreground-500">{selfService ? 'Sua instância individual ainda está sendo provisionada. Quando ela estiver pronta, atualize esta tela para conectar seu WhatsApp.' : canManage ? 'Adicione uma conta corporativa ou individual. Ela permanecerá inativa até o provisionamento seguro e a conexão.' : 'Seu usuário ainda não possui uma conta individual, e nenhuma conta corporativa foi compartilhada.'}</p></div>
        : <div className={`mt-4 ${selfService ? '' : 'grid gap-4 xl:grid-cols-[minmax(240px,0.72fr)_minmax(0,1.28fr)]'}`}>
          {!selfService && <div className="space-y-2" aria-label="Contas Evolution GO disponíveis">{accounts.map((status) => {
            const badge = statusUnconfirmed ? selectedBadge : evolutionGoStatusCopy(status);
            const selectedAccount = status.account.id === selected?.account.id;
            return <button key={status.account.id} type="button" aria-pressed={selectedAccount} onClick={() => setSelectedAccountId(status.account.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedAccount ? 'border-primary-300 bg-primary-50/50 ring-1 ring-primary-200' : 'border-background-200 bg-white hover:border-background-300 hover:bg-background-50'}`}>
              <span className="flex items-start justify-between gap-2"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground-900">{status.account.label}</span><span className="mt-1 block text-[11px] leading-4 text-foreground-500">{accountScope(status.account, members)}</span></span><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${badge.className}`}><i className={`${badge.icon} mr-1`} />{badge.label}</span></span>
              <span className="mt-3 flex items-center justify-between text-[11px] text-foreground-500"><span>{status.account.phoneSuffix ? `Número final ${status.account.phoneSuffix}` : 'Número não confirmado'}</span>{status.account.isDefault && <span className="font-semibold text-primary-700">Padrão</span>}</span>
            </button>;
          })}</div>}

          {selected && <article className="rounded-xl border border-background-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h5 className="font-semibold text-foreground-950">{selected.account.label}</h5><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${selectedBadge.className}`}><i className={`${selectedBadge.icon} mr-1`} />{selectedBadge.label}</span></div><p className="mt-1 text-xs text-foreground-500">{selectedScope}</p></div>{canManage && selected.canManage && <button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={openConfiguration}><i className="ri-lock-2-line" />{configuring ? 'Fechar configuração' : selected.configured ? 'Atualizar configuração' : 'Configurar instância'}</button>}</div>

            {configuring && canManage && selected.canManage && <div className="mt-4 rounded-xl border border-background-200 bg-background-50 p-4">
              <div><h6 className="text-sm font-semibold text-foreground-900">Configuração protegida desta conta</h6><p className="mt-1 text-[11px] leading-5 text-foreground-500">Os campos protegidos começam sempre vazios. Em uma conta já configurada, deixar um campo vazio preserva o valor existente no cofre; nenhum valor salvo é retornado ou exibido.</p></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-foreground-700">Nome do canal<input value={configurationForm.label} onChange={(event) => setConfigurationForm({ ...configurationForm, label: event.target.value })} className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm" /></label>
                <label className="text-xs font-medium text-foreground-700">URL HTTPS do servidor<input type="password" autoComplete="new-password" spellCheck={false} value={configurationForm.baseUrl} onChange={(event) => setConfigurationForm({ ...configurationForm, baseUrl: event.target.value })} placeholder={selected.configured ? 'Vazio preserva o valor do cofre' : 'Informe para vincular uma instância'} className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm" /></label>
                <label className="text-xs font-medium text-foreground-700">Chave global<input type="password" autoComplete="new-password" spellCheck={false} value={configurationForm.globalApiKey} onChange={(event) => setConfigurationForm({ ...configurationForm, globalApiKey: event.target.value })} placeholder={selected.configured ? 'Vazio preserva o valor do cofre' : 'Informe para vincular uma instância'} className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm" /></label>
                <label className="text-xs font-medium text-foreground-700">Token da instância<input type="password" autoComplete="new-password" spellCheck={false} value={configurationForm.instanceToken} onChange={(event) => setConfigurationForm({ ...configurationForm, instanceToken: event.target.value })} placeholder={selected.configured ? 'Vazio preserva o valor do cofre' : 'Obrigatório ao vincular uma instância existente'} className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm" /></label>
                <label className="text-xs font-medium text-foreground-700">Nome da instância<input type="password" autoComplete="new-password" spellCheck={false} value={configurationForm.instanceName} onChange={(event) => setConfigurationForm({ ...configurationForm, instanceName: event.target.value })} placeholder={selected.configured ? 'Vazio preserva o valor do cofre' : 'Vazio usa o nome do canal ao criar'} className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm" /></label>
                <label className="text-xs font-medium text-foreground-700">ID da instância <span className="font-normal text-foreground-400">somente vínculo existente</span><input type="password" autoComplete="new-password" spellCheck={false} value={configurationForm.instanceId} onChange={(event) => setConfigurationForm({ ...configurationForm, instanceId: event.target.value })} placeholder={selected.configured ? 'Vazio preserva o valor do cofre' : 'Opcional'} className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm" /></label>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => { setConfiguring(false); setConfigurationForm(emptyConfigurationForm); }}>Cancelar</button><button type="button" className="wf-btn-secondary text-xs disabled:opacity-60" disabled={busy !== null || !configurationForm.label.trim()} onClick={() => { if (window.confirm('Criar uma nova instância para esta conta? A operação não será repetida automaticamente em caso de resposta incerta.')) void submitConfiguration('create'); }}><i className="ri-add-circle-line" />{busy?.startsWith('create:') ? 'Criando…' : 'Criar nova instância'}</button><button type="button" className="wf-btn-primary text-xs disabled:opacity-60" disabled={busy !== null || !configurationForm.label.trim()} onClick={() => void submitConfiguration('save')}><i className="ri-save-line" />{busy?.startsWith('save:') ? 'Salvando…' : 'Salvar vínculo existente'}</button></div>
            </div>}

            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">Conexão real</dt><dd className="mt-1 font-semibold text-foreground-900">{statusUnconfirmed ? 'Não confirmado' : connectionCopy[selected.account.connectionStatus] ?? 'Estado indisponível'}</dd></div>
              <div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">Número</dt><dd className="mt-1 font-semibold text-foreground-900">{selected.account.phoneSuffix ? `Final ${selected.account.phoneSuffix}` : 'Não confirmado'}</dd></div>
              <div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">Roteamento</dt><dd className="mt-1 font-semibold text-foreground-900">{statusUnconfirmed ? 'Não confirmado' : selected.account.enabled ? selected.account.isDefault ? 'Ativo · padrão' : 'Ativo' : 'Desativado'}</dd></div>
              <div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">Instância</dt><dd className="mt-1 truncate font-semibold text-foreground-900">{selected.integration?.instanceName || (selected.configured ? 'Identificador protegido' : 'Não provisionada')}</dd></div>
              <div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">Última validação</dt><dd className="mt-1 font-semibold text-foreground-900">{stamp(selected.integration?.lastTestedAt || selected.account.checkedAt)}</dd></div>
              <div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">Entrada / saída</dt><dd className="mt-1 font-semibold text-foreground-900">{statusUnconfirmed ? 'Não confirmado' : selectedOperational ? 'Liberadas' : 'Protegidas'}</dd></div>
            </dl>

            {!statusUnconfirmed && selected.integration?.statusDetail && <p className="mt-3 rounded-xl border border-background-200 bg-background-50 px-3 py-2 text-xs leading-5 text-foreground-600"><span className="font-semibold text-foreground-700">Estado do servidor:</span> {selected.integration.statusDetail}</p>}
            {selected.account.errorCode && <p className="mt-3 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-800">Falha registrada: {selected.account.errorCode}</p>}

            {!selected.configured && <div className="mt-4 rounded-xl border border-[#E9D2A9] bg-[#FFF8EA] p-3 text-xs leading-5 text-[#7B521B]"><i className="ri-information-line mr-1" />A conta existe, mas ainda depende do provisionamento seguro do servidor. Nenhum estado de conexão será presumido.</div>}
            {selected.configured && !selected.canConnect && <div className="mt-4 rounded-xl border border-background-200 bg-background-50 p-3 text-xs leading-5 text-foreground-600"><i className="ri-eye-line mr-1" />{selfService ? 'Seu acesso atual não permite gerar QR Code ou código de pareamento. Solicite a permissão de conexão ao administrador.' : 'Você possui acesso somente para acompanhar esta conta compartilhada. Pareamento e mudanças operacionais continuam restritos.'}</div>}

            {selected.configured && selected.canConnect && <div className="mt-4 rounded-xl border border-background-200 p-3.5">
              <div><h6 className="text-sm font-semibold text-foreground-900">{selfService ? 'Conectar seu WhatsApp' : 'Conexão e uso'}</h6><p className="mt-1 text-xs leading-5 text-foreground-500">{selfService ? 'As ações abaixo alcançam somente sua instância individual. Primeiro conecte; quando o estado passar para “Aguardando leitura do QR”, gere o QR Code ou o código temporário.' : 'As ações atingem somente a conta selecionada. Ativar uma conta individual não troca o canal corporativo padrão.'}</p></div>
              {selfService && selectedConnected && !selectedActive && <div role="status" className="mt-3 rounded-xl border border-[#E9D2A9] bg-[#FFF8EA] p-3 text-xs leading-5 text-[#7B521B]"><p className="font-semibold text-[#70430E]"><i className="ri-checkbox-circle-line mr-1" />WhatsApp conectado. Sua conta ainda está desabilitada.</p><p className="mt-1">Habilitar a conta não altera os controles administrativos. Recebimento, envio e Ana dependem de liberação separada.</p></div>}
              {selfService && selectedConnected && selectedActive && !selectedOperational && <div role="status" className="mt-3 rounded-xl border border-[#E9D2A9] bg-[#FFF8EA] p-3 text-xs leading-5 text-[#7B521B]"><p className="font-semibold text-[#70430E]"><i className="ri-shield-check-line mr-1" />Sua conta está conectada, mas o atendimento ainda está protegido.</p><p className="mt-1">A conexão não precisa de outro QR Code. O recebimento e o envio dependem de liberação administrativa; atualizar o status não muda essa autorização.</p></div>}
              {selfService && selectedOperational && <div role="status" className="mt-3 flex flex-col gap-3 rounded-xl border border-[#B9E4CB] bg-[#EFFAF3] p-3 text-xs leading-5 text-[#176B43] sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold"><i className="ri-checkbox-circle-line mr-1" />Seu WhatsApp está conectado e liberado.</p><p className="mt-1">{selectedAutomationReady ? 'As conversas atribuídas a você e a automação da Ana já podem ser atendidas pela Central.' : 'As conversas atribuídas a você já podem ser atendidas na Central. A Ana automática aguarda a liberação geral da empresa.'}</p></div><Link to="/dashboard/atendimento" className="wf-btn-primary shrink-0 text-xs"><i className="ri-customer-service-2-line" />Abrir Central de Atendimento</Link></div>}
              <div className="mt-3 flex flex-wrap gap-2">
                {!selectedConnected && !selectedPairingOpen && <button type="button" className="wf-btn-primary text-xs" disabled={busy !== null} onClick={() => action('connect', 'Conexão iniciada. Use o QR Code ou o pareamento temporário desta conta.')}><i className="ri-link" />Conectar</button>}
                {selectedConnected && <button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => action('reconnect', 'Reconexão solicitada. Gere um novo QR Code ou código temporário.')}><i className="ri-restart-line" />Reconectar</button>}
                <button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => action('refresh_status', 'Status real atualizado a partir do provedor.')}><i className={busy?.startsWith('refresh_status:') ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} />Validar status</button>
                {!selectedActive
                  ? <button type="button" className="wf-btn-primary text-xs" disabled={busy !== null || !selectedConnected} onClick={() => { const scope = selfService ? 'para as conversas atribuídas a você' : selected.account.accountType === 'corporate' ? 'como conta corporativa padrão' : 'somente para as conversas atribuídas a este vendedor'; const confirmation = selfService ? 'Habilitar sua conta? Os controles administrativos de recebimento, envio e Ana não serão alterados.' : `Ativar esta conta ${scope}?`; if (window.confirm(confirmation)) action('activate', selfService ? 'Conta habilitada. Os controles administrativos de recebimento, envio e Ana não foram alterados.' : selected.account.accountType === 'corporate' ? 'Conta ativada como canal corporativo padrão.' : 'Conta individual ativada sem substituir o canal corporativo.'); }}><i className="ri-play-circle-line" />{selfService ? 'Habilitar minha conta' : 'Habilitar conta'}</button>
                  : !selfService && <button type="button" className="wf-btn-secondary text-xs text-accent-700" disabled={busy !== null} onClick={() => { if (window.confirm('Desativar o uso desta conta sem apagar sessão ou histórico?')) action('deactivate', 'Uso operacional desativado; sessão e histórico preservados.'); }}><i className="ri-pause-circle-line" />Desativar uso</button>}
                {!selfService && <><button type="button" className="wf-btn-secondary text-xs text-accent-700" disabled={busy !== null || !selectedConnected} onClick={() => { if (window.confirm('Desconectar esta conta no provedor? O provisionamento será preservado.')) action('disconnect', 'Conta desconectada; provisionamento e histórico preservados.'); }}><i className="ri-link-unlink-m" />Desconectar</button>
                <button type="button" className="wf-btn-secondary text-xs text-accent-700" disabled={busy !== null} onClick={() => { if (window.confirm('Encerrar a sessão remota desta conta? Um novo pareamento será necessário.')) action('logout', 'Sessão remota encerrada para a conta selecionada.'); }}><i className="ri-logout-box-r-line" />Encerrar sessão</button></>}
              </div>

              {selectedPairingOpen && selected.canViewQr && <div className="mt-4 rounded-xl bg-background-50 p-3"><div className="flex flex-wrap items-center gap-2"><button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => void loadQr()}><i className="ri-qr-code-line" />Gerar novo QR</button><input aria-label="Telefone para pareamento Evolution GO" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="5511999999999" className="w-44 rounded-lg border border-background-200 bg-white px-3 py-2 text-xs" /><button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null || !phoneValid} onClick={() => void requestPairing()}><i className="ri-smartphone-line" />Gerar código</button></div><p className="mt-2 text-[11px] leading-5 text-foreground-500">O QR é carregado automaticamente ao abrir esta tela e pode ser renovado aqui. O backend revalida sua permissão para cada geração; QR e código nunca são incluídos na resposta de consulta da conta.</p></div>}

              {(qrForSelected || pairingForSelected) && <div className="mt-4 grid gap-3 rounded-xl border border-background-200 bg-background-50 p-3 sm:grid-cols-2">
                {qrForSelected && <div><p className="text-xs font-semibold text-foreground-800">QR Code temporário</p>{qrImage ? <img src={qrImage} alt={selfService ? 'QR Code temporário da sua conta Evolution GO' : 'QR Code temporário da conta Evolution GO selecionada'} className="mt-2 h-40 w-40 rounded-lg bg-white object-contain p-2" /> : <p className="mt-2 text-[11px] leading-5 text-foreground-600">O provedor não retornou uma imagem segura para exibição. Gere um código de pareamento ou atualize o QR.</p>}<p className="mt-2 text-[11px] text-foreground-500">Expira: {stamp(qrForSelected.expiresAt)}</p></div>}
                {pairingForSelected && <div><p className="text-xs font-semibold text-foreground-800">Código temporário</p><code className="mt-2 block rounded-lg bg-white p-3 text-base font-bold tracking-widest text-foreground-950">{pairingForSelected.code}</code><p className="mt-2 text-[11px] leading-5 text-foreground-500">Use somente no WhatsApp desta conta e valide o status em seguida.</p></div>}
              </div>}
            </div>}
          </article>}
        </div>}

    <p className="mt-4 text-[11px] leading-5 text-foreground-500">{selfService ? 'Esta área consulta somente a conta individual vinculada à sua identidade. A geração de conexão, QR e código é revalidada pelo backend a cada solicitação.' : <>A conta corporativa continua sendo o fallback compartilhado. Contas individuais permanecem vinculadas ao <code>owner_user_id</code>; seleção, conexão, QR e ativação são revalidados pelo backend para cada conta.</>}</p>
  </section>;
}
