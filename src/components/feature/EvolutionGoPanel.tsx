import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadTeamMembers, type TeamMember } from '@/lib/crm/teamMembersRepository';
import { isEvolutionGoAutomationReady, isEvolutionGoOperational } from '@/lib/crm/evolutionGoOnboarding';
import { evolutionGoServerActionsAvailable, evolutionGoServerUnsupportedActionCopy } from '@/lib/crm/evolutionGoServerError';
import { channelLifecycleBlocked, channelLifecycleMessage, refreshAfterLifecycleError } from '@/lib/crm/channelLifecycle';
import ChannelLifecycleRecovery from './ChannelLifecycleRecovery';
import {
  createEvolutionGoAccount,
  inspectEvolutionGoInstance,
  loadEvolutionGoAccounts,
  loadMyEvolutionGoAccount,
  requestEvolutionGoPairingCode,
  requestEvolutionGoQr,
  replaceEvolutionGoInstance,
  runEvolutionGoAction,
  saveEvolutionGoServer,
  testEvolutionGoServer,
  type EvolutionGoChannelStatus,
  type EvolutionGoRecoveryInspection,
  type WhatsappConnectionStatus,
} from '@/lib/crm/whatsappAccountsRepository';

type Notice = { tone: 'success' | 'error'; text: string };
type Account = NonNullable<EvolutionGoChannelStatus['account']>;
type AccountStatus = EvolutionGoChannelStatus & { account: Account };
type QrState = { accountId: string; qrcode: string | null; code: string | null; expiresAt: string | null };
type PairingState = { accountId: string; code: string };
export type EvolutionGoPanelMode = 'administration' | 'self-service';
export type EvolutionGoPanelSurface = 'default' | 'central';

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
    evolution_go_corporate_account_required: 'A configuração do servidor pertence à conta corporativa da empresa.',
    evolution_go_server_credentials_required: 'Informe a URL HTTPS e a chave global do servidor Evolution GO.',
    evolution_go_server_change_requires_inactive_account: 'Desative e desconecte a conta corporativa antes de trocar o servidor; a sessão existente não será redirecionada automaticamente.',
    evolution_go_server_validation_required: 'Valide primeiro o acesso ao servidor Evolution GO no painel administrador.',
    evolution_go_server_configuration_save_failed: 'O cofre recebeu a configuração, mas não foi possível confirmar o estado. Atualize antes de tentar novamente.',
    evolution_go_server_test_save_failed: 'O servidor respondeu, mas não foi possível registrar o teste. Atualize antes de prosseguir.',
    evolution_go_allowed_origins_not_configured: 'O domínio HTTPS do Evolution GO ainda não foi liberado no ambiente seguro.',
    evolution_go_base_url_invalid: 'Informe a URL completa do servidor Evolution GO, começando com https://.',
    evolution_go_base_url_unsafe: 'Use somente HTTPS público, sem usuário, senha ou endereço de rede privada.',
    evolution_go_base_url_not_allowed: 'A origem HTTPS informada não está na lista segura do servidor. Peça a liberação dessa origem na configuração protegida.',
    evolution_go_instance_create_credentials_required: 'O servidor ainda não possui o provisionamento seguro necessário para criar a instância.',
    evolution_go_credentials_required: 'Informe os dados exigidos para esta instância. Campos vazios preservam valores que já estejam no cofre.',
    evolution_go_credentials_incomplete: 'A instância ainda depende de provisionamento administrativo no servidor.',
    evolution_go_credentials_save_failed: 'Não foi possível armazenar a configuração no cofre do servidor.',
    evolution_go_connection_validation_required: 'Conecte a instância e atualize o status antes de ativar o uso operacional.',
    evolution_go_phone_required: 'Informe o telefone com DDI e DDD para gerar o código.',
    evolution_go_qr_unavailable: 'A instância ainda está iniciando. Aguarde alguns segundos e gere um novo QR Code.',
    evolution_go_qr_runtime_not_ready: 'A instância não iniciou no servidor Evolution GO. Verifique a capacidade do servidor antes de gerar outro QR Code.',
    evolution_go_qr_start_failed: 'O servidor Evolution GO falhou ao iniciar a sessão da instância. Consulte os logs da instância no servidor; repetir o QR não corrige essa falha.',
    evolution_go_qr_invalid_format: 'O servidor Evolution GO gerou um QR em formato inválido. Verifique a versão e os logs da instância antes de tentar novamente.',
    evolution_go_qr_pending: 'O servidor ainda não disponibilizou o QR Code. Aguarde a inicialização da sessão e atualize o status.',
    evolution_go_connection_start_required: 'A conexão mudou ou ainda não foi preparada. Atualize o status e use Conectar antes de gerar outro QR Code.',
    evolution_go_pair_runtime_not_ready: 'A instância ainda está iniciando. Aguarde alguns segundos e gere o código novamente uma única vez.',
    evolution_go_instance_already_connected: 'Esta conta já está conectada. Atualize o status antes de iniciar outro pareamento.',
    evolution_go_pair_provider_rejected: 'A Evolution GO recusou o código após preparar a sessão. Gere um novo QR Code ou verifique a versão do servidor Evolution GO.',
    evolution_go_request_rejected_401: 'O Evolution GO recusou o token desta instância (HTTP 401). O nome exibido é apenas o registro no WayFlex; peça ao administrador para conferir a instância no servidor. Gerar QR não cria uma instância e repetir agora não resolverá.',
    evolution_go_request_rejected_400: 'A Evolution GO recusou a solicitação de QR. A sessão pode não estar pronta; confirme a existência da instância e atualize o status antes de tentar novamente.',
    evolution_go_request_rejected_500: 'A Evolution GO falhou ao recuperar a sessão para gerar o QR. Nenhum QR, mensagem ou automação foi criado; revise o diagnóstico do servidor antes de repetir.',
    recovery_remote_state_changed: 'A instância remota mudou ou está conectada. Atualize o diagnóstico; nenhuma exclusão foi feita.',
    recovery_channel_must_be_disabled: 'Desative e desconecte este conector antes de substituir a instância.',
    recovery_stale_intent: 'O estado de provisionamento mudou. Atualize antes de prosseguir.',
    recovery_admin_required: 'Somente um administrador ativo da empresa pode substituir a instância.',
    recovery_server_validation_required: 'Valide o servidor corporativo antes de substituir a instância.',
    recovery_create_unconfirmed: 'A exclusão foi registrada, mas a nova instância não pôde ser confirmada. Não repita; solicite revisão do estado.',
    recovery_delete_uncertain: 'Não foi possível confirmar a exclusão no provedor. Não repita; solicite revisão do estado.',
    recovery_claim_conflict: 'Outra operação alterou o estado. Atualize antes de prosseguir.',
  };
  return map[code] || 'Não foi possível confirmar a operação. Consulte o estado antes de tentar novamente; nenhum envio foi autorizado por esta resposta.';
}

function instanceTokenRejected(error: unknown): boolean {
  return error instanceof Error && error.message === 'evolution_go_request_rejected_401';
}

function stamp(value: string | null | undefined) {
  if (!value) return 'Ainda não registrado';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Data indisponível'
    : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function serverTestErrorCopy(code: string | null | undefined) {
  if (code === 'evolution_go_server_auth_failed') return 'Chave global recusada pelo servidor (HTTP 401/403).';
  if (code === 'evolution_go_server_contract_mismatch') return 'A rota de instâncias não existe neste servidor (HTTP 404). Verifique se é Evolution GO compatível.';
  if (code === 'evolution_go_server_invalid_response') return 'O servidor não retornou JSON; verifique o endereço e o proxy HTTPS.';
  if (code === 'evolution_go_server_unreachable') return 'Servidor inacessível ou tempo esgotado. Verifique URL, HTTPS e rede.';
  return code?.startsWith('evolution_go_server_http_') ? `Servidor recusou a consulta (${code.replace('evolution_go_server_http_', 'HTTP ')}).` : 'Teste ainda não realizado.';
}

function accountScope(account: Account, members: TeamMember[]) {
  if (account.accountType === 'corporate') return 'Corporativa · compartilhada pela empresa';
  const owner = members.find((member) => member.userId === account.ownerUserId);
  return owner ? `Individual · ${owner.name}` : 'Individual · vendedor responsável';
}

function EvolutionSummaryCard({ icon, label, value, detail, tone = 'neutral' }: {
  icon: string;
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const tones = {
    neutral: 'border-background-200 bg-white text-foreground-700',
    success: 'border-[#B9E4CB] bg-[#EFFAF3] text-[#147445]',
    warning: 'border-[#E9D2A9] bg-[#FFF8EA] text-[#965A12]',
  };
  return <article className={`rounded-xl border p-3.5 ${tones[tone]}`}>
    <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/80 text-lg"><i className={icon} /></span><div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-wide opacity-75">{label}</p><p className="mt-1 truncate text-sm font-semibold">{value}</p><p className="mt-1 text-[11px] leading-4 opacity-80">{detail}</p></div></div>
  </article>;
}

function EvolutionChecklistItem({ ready, label, detail }: { ready: boolean; label: string; detail: string }) {
  return <li className="flex gap-2.5"><i className={`${ready ? 'ri-checkbox-circle-fill text-[#168654]' : 'ri-information-fill text-[#B87820]'} mt-0.5 text-base`} aria-hidden="true" /><span><span className="block text-xs font-semibold text-foreground-800">{label}</span><span className="mt-0.5 block text-[11px] leading-4 text-foreground-500">{detail}</span></span></li>;
}

/**
 * The administration mode manages the organization collection. Self-service
 * is deliberately narrower: the server returns only the authenticated
 * seller's own account and this component exposes connection actions only.
 * Stored provider secrets are never returned or prefilled in either mode.
 */
export default function EvolutionGoPanel({ mode = 'administration', surface = 'default' }: { mode?: EvolutionGoPanelMode; surface?: EvolutionGoPanelSurface }) {
  const selfService = mode === 'self-service';
  const inCentral = selfService && surface === 'central';
  const [accounts, setAccounts] = useState<AccountStatus[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusUnconfirmed, setStatusUnconfirmed] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [addingCorporate, setAddingCorporate] = useState(false);
  const [corporateLabel, setCorporateLabel] = useState('');
  const [serverForm, setServerForm] = useState({ baseUrl: '', globalApiKey: '' });
  const [serverConfiguring, setServerConfiguring] = useState(false);
  const [phone, setPhone] = useState('');
  const [qr, setQr] = useState<QrState | null>(null);
  const [pairing, setPairing] = useState<PairingState | null>(null);
  const [instanceAuthRejectedFor, setInstanceAuthRejectedFor] = useState<string | null>(null);
  const [recoveryInspection, setRecoveryInspection] = useState<(EvolutionGoRecoveryInspection & { accountId: string }) | null>(null);
  const [recoveryConfirmation, setRecoveryConfirmation] = useState('');
  const autoQrRequest = useRef<string | null>(null);

  const refresh = useCallback(async (clearNotice = true) => {
    setBusy('refresh');
    setStatusUnconfirmed(true);
    setQr(null); setPairing(null);
    setRecoveryInspection(null); setRecoveryConfirmation('');
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
        if (result.canManage) return visibleAccounts.find((status) => status.account.accountType === 'corporate')?.account.id
          || visibleAccounts[0]?.account.id || '';
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
      return;
    }
    let active = true;
    void loadTeamMembers()
      .then((result) => {
        if (!active) return;
        setMembers(result.filter((member) => member.status === 'active'));
      })
      .catch(() => { if (active) setMembers([]); });
    return () => { active = false; };
  }, [canManage]);

  useEffect(() => {
    setQr(null);
    setPairing(null);
    setPhone('');
    setServerConfiguring(false);
    setServerForm({ baseUrl: '', globalApiKey: '' });
    setRecoveryInspection(null); setRecoveryConfirmation('');
  }, [selectedAccountId]);

  const selected = useMemo(
    () => accounts.find((status) => status.account.id === selectedAccountId) ?? accounts[0] ?? null,
    [accounts, selectedAccountId],
  );
  const corporateAccount = useMemo(
    () => accounts.find((status) => status.account.accountType === 'corporate' && status.account.isDefault)
      ?? accounts.find((status) => status.account.accountType === 'corporate') ?? null,
    [accounts],
  );
  const serverActionsAvailable = evolutionGoServerActionsAvailable(corporateAccount?.integration);

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
      if (instanceTokenRejected(error) && selected) setInstanceAuthRejectedFor(selected.account.id);
      await refreshAfterLifecycleError(error, () => refresh(false));
      setNotice({ tone: 'error', text: errorCopy(error) });
    } finally {
      setBusy(null);
    }
  };

  const addCorporateAccount = async () => {
    const label = corporateLabel.trim();
    if (!label) {
      setNotice({ tone: 'error', text: 'Informe o nome da conta corporativa.' });
      return;
    }
    setBusy('create_account');
    setNotice(null);
    try {
      const next = await createEvolutionGoAccount({ accountType: 'corporate', label });
      replaceStatus(next);
      setCorporateLabel('');
      setAddingCorporate(false);
      setNotice({ tone: 'success', text: 'Conta corporativa adicionada. Configure e valide o servidor antes de preparar instâncias individuais.' });
    } catch (error) {
      setNotice({ tone: 'error', text: errorCopy(error) });
    } finally {
      setBusy(null);
    }
  };

  const saveServer = async () => {
    if (!corporateAccount || !serverActionsAvailable) return;
    setBusy(`save_server:${corporateAccount.account.id}`);
    setNotice(null);
    try {
      const next = await saveEvolutionGoServer(corporateAccount.account.id, {
        baseUrl: serverForm.baseUrl.trim(), globalApiKey: serverForm.globalApiKey.trim(),
      });
      replaceStatus(next);
      setServerConfiguring(false);
      setServerForm({ baseUrl: '', globalApiKey: '' });
      setNotice({ tone: 'success', text: 'Servidor salvo no cofre. Teste a conexão antes de preparar as instâncias.' });
    } catch (error) {
      setNotice({ tone: 'error', text: evolutionGoServerUnsupportedActionCopy(error, 'save') ?? errorCopy(error) });
    } finally {
      setBusy(null);
    }
  };

  const testServer = async () => {
    if (!corporateAccount || !serverActionsAvailable) return;
    setBusy(`test_server:${corporateAccount.account.id}`);
    setNotice(null);
    try {
      const next = await testEvolutionGoServer(corporateAccount.account.id);
      replaceStatus(next);
      const validation = next.integration?.serverValidation;
      setNotice(validation?.status === 'passed'
        ? { tone: 'success', text: 'Servidor Evolution GO autenticado. Nenhuma mensagem foi enviada.' }
        : { tone: 'error', text: serverTestErrorCopy(validation?.errorCode) });
    } catch (error) {
      setNotice({ tone: 'error', text: evolutionGoServerUnsupportedActionCopy(error, 'test') ?? errorCopy(error) });
    } finally {
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
      if (instanceTokenRejected(error)) setInstanceAuthRejectedFor(accountId);
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
      if (instanceTokenRejected(error)) setInstanceAuthRejectedFor(accountId);
      await refreshAfterLifecycleError(error, () => refresh(false));
      setNotice({ tone: 'error', text: errorCopy(error) });
    } finally {
      setBusy(null);
    }
  };

  const inspectRecovery = async () => {
    if (!canManage || !selected || selected.account.accountType !== 'seller') return;
    setBusy(`recovery_inspect:${selected.account.id}`);
    setNotice(null);
    setRecoveryInspection(null);
    setRecoveryConfirmation('');
    try {
      const inspection = await inspectEvolutionGoInstance(selected.account.id);
      setRecoveryInspection({ ...inspection, accountId: selected.account.id });
    } catch (error) {
      setNotice({ tone: 'error', text: errorCopy(error) });
    } finally {
      setBusy(null);
    }
  };

  const replaceRecovery = async () => {
    const inspection = recoveryInspection;
    if (!canManage || !selected || !inspection || inspection.accountId !== selected.account.id ||
      !inspection.provider_id || inspection.provider_connected ||
      recoveryConfirmation !== inspection.instance_name) return;
    if (!window.confirm(`Excluir definitivamente a instância desconectada ${inspection.instance_name} no Evolution GO e criar outra com novo token? A sessão remota antiga será perdida; o histórico salvo no WayFlex será mantido.`)) return;
    setBusy(`recovery_replace:${selected.account.id}`);
    setNotice(null);
    try {
      const result = await replaceEvolutionGoInstance(selected.account.id,
        inspection.instance_name, inspection.provider_id);
      setRecoveryInspection(null);
      setRecoveryConfirmation('');
      await refresh(false);
      setNotice({ tone: 'success', text: `Nova instância ${result.instance_name} confirmada no provedor com token novo. O vendedor pode atualizar a Central de Atendimento; envio e Ana permanecem desativados.` });
    } catch (error) {
      setRecoveryInspection(null);
      await refresh(false);
      setNotice({ tone: 'error', text: errorCopy(error) });
    } finally {
      setBusy(null);
    }
  };

  const selectedInstanceAuthRejected = selected?.account.id === instanceAuthRejectedFor;
  const selectedBadge = selectedInstanceAuthRejected
    ? { label: 'Instância não confirmada', className: 'bg-accent-50 text-accent-800', icon: 'ri-error-warning-line' }
    : statusUnconfirmed
    ? { label: 'Estado não confirmado', className: 'bg-[#FFF1D8] text-[#965A12]', icon: 'ri-time-line' }
    : evolutionGoStatusCopy(selected);
  const selectedScope = selected
    ? selfService ? 'Sua conta individual Evolution GO' : accountScope(selected.account, members)
    : '';
  const selectedConnected = !statusUnconfirmed && selected?.account.connectionStatus === 'connected' && selected.integration?.connected === true;
  const selectedActive = selected?.account.enabled === true;
  const selectedOperational = !statusUnconfirmed && isEvolutionGoOperational(selected);
  const selectedAutomationReady = !statusUnconfirmed && isEvolutionGoAutomationReady(selected);
  const selectedPairingOpen = !statusUnconfirmed && !selectedInstanceAuthRejected && selected?.account.connectionStatus === 'qr' && !channelLifecycleBlocked(selected.lifecycle);
  const phoneValid = phone.replace(/\D/g, '').length >= 10;
  const qrForSelected = selected?.canViewQr && qr?.accountId === selected.account.id ? qr : null;
  const pairingForSelected = selected?.canViewQr && pairing?.accountId === selected.account.id ? pairing : null;
  const qrImage = qrForSelected?.qrcode?.startsWith('data:image/') ? qrForSelected.qrcode : null;
  const sellerAccounts = accounts.filter((status) => status.account.accountType === 'seller');
  const connectedSellerAccounts = sellerAccounts.filter((status) => !statusUnconfirmed && status.account.connectionStatus === 'connected' && status.integration?.connected === true).length;
  const sellerAccountsCopy = `${sellerAccounts.length} conta${sellerAccounts.length === 1 ? '' : 's'} individual${sellerAccounts.length === 1 ? '' : 'is'} vinculada${sellerAccounts.length === 1 ? '' : 's'}`;
  const availableAccountsCopy = accounts.length === 1 ? '1 conta disponível' : `${accounts.length} contas disponíveis`;
  const serverConfigured = corporateAccount?.integration?.serverConfigured === true;
  const serverValidated = serverActionsAvailable && corporateAccount?.integration?.serverValidation?.status === 'passed';
  const serverSummary = !corporateAccount
    ? { value: 'Não configurado', detail: 'Cadastre a conta corporativa.', tone: 'warning' as const }
    : !serverActionsAvailable
      ? { value: 'Requer atualização', detail: 'Backend sem suporte para configuração.', tone: 'warning' as const }
      : serverValidated
        ? { value: 'Acesso validado', detail: 'Teste administrativo confirmado.', tone: 'success' as const }
        : serverConfigured
          ? { value: 'Teste pendente', detail: 'Credencial salva; valide a conexão.', tone: 'warning' as const }
          : { value: 'Configuração pendente', detail: 'URL HTTPS e chave global ainda não registradas.', tone: 'warning' as const };

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
        <div><h4 className="font-semibold text-foreground-950">{selfService ? inCentral ? 'Conectar meu WhatsApp' : 'Meu WhatsApp' : 'Evolution GO · servidor e conectores'}</h4><p className="mt-1 text-xs leading-5 text-foreground-500">{selfService ? inCentral ? 'Conecte somente a sua instância Evolution GO para receber e atender conversas atribuídas a você.' : 'Conecte sua instância individual Evolution GO por QR Code ou código temporário.' : 'Configure e valide o servidor; acompanhe os conectores sem parear o WhatsApp dos vendedores.'}</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => { setInstanceAuthRejectedFor(null); void refresh(); }}><i className={busy === 'refresh' ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} />Atualizar</button>
        {canManage && !corporateAccount && <button type="button" className="wf-btn-primary text-xs" disabled={busy !== null} onClick={() => { setAddingCorporate((value) => !value); setNotice(null); }}><i className="ri-add-line" />Adicionar conta corporativa</button>}
      </div>
    </header>

    <p className="mt-3 rounded-xl border border-background-200 bg-background-50 px-3 py-2 text-[11px] leading-5 text-foreground-500"><i className="ri-lock-2-line mr-1" />{selfService ? 'Seu acesso é individual. URL, chave global e token da instância ficam protegidos no servidor; você não precisa digitá-los para parear seu WhatsApp.' : 'Credenciais ficam no backend. Esta tela recebe somente estados e nunca preenche os campos protegidos.'}</p>
    {channelLifecycleMessage(selected?.lifecycle) && <p role="status" className="mt-4 rounded-xl border border-background-200 bg-background-50 px-3 py-2 text-xs text-foreground-700">{channelLifecycleMessage(selected?.lifecycle)}</p>}
    {canManage && selected && channelLifecycleBlocked(selected.lifecycle) && <ChannelLifecycleRecovery key={`${selected.account.id}:${selected.lifecycle?.revision}`} provider="evolution_go" accountId={selected.account.id} disabled={Boolean(busy) || statusUnconfirmed} onReconciled={refresh} />}
    {notice && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-xl border px-3 py-2 text-xs ${notice.tone === 'success' ? 'border-[#B9E4CB] bg-[#EFFAF3] text-[#176B43]' : 'border-[#E8B8B1] bg-[#FFF4F2] text-[#8B3027]'}`}>{notice.text}</p>}

    {!selfService && canManage && <section className="mt-4" aria-label="Resumo operacional Evolution GO">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h5 className="text-sm font-semibold text-foreground-900">Resumo operacional</h5><p className="mt-1 text-xs leading-5 text-foreground-500">Informações confirmadas pelo estado atual do servidor e das contas vinculadas.</p></div><span className="text-[11px] text-foreground-500">Atualize para consultar novamente</span></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <EvolutionSummaryCard icon="ri-server-line" label="Servidor" value={serverSummary.value} detail={serverSummary.detail} tone={serverSummary.tone} />
        <EvolutionSummaryCard icon="ri-user-settings-line" label="Instâncias individuais" value={`${sellerAccounts.length} cadastrada${sellerAccounts.length === 1 ? '' : 's'}`} detail="Vinculadas a vendedores no WayFlex." tone={sellerAccounts.length > 0 ? 'success' : 'neutral'} />
        <EvolutionSummaryCard icon="ri-link-m" label="Conexões confirmadas" value={`${connectedSellerAccounts} conectada${connectedSellerAccounts === 1 ? '' : 's'}`} detail="Instâncias individuais com sessão confirmada." tone={connectedSellerAccounts > 0 ? 'success' : 'neutral'} />
        <EvolutionSummaryCard icon="ri-time-line" label="Última validação" value={stamp(corporateAccount?.integration?.serverValidation?.checkedAt)} detail={serverValidated ? 'Teste do servidor aprovado.' : 'Consulte o teste do servidor abaixo.'} tone={serverValidated ? 'success' : 'neutral'} />
      </div>
    </section>}

    {!selfService && canManage && corporateAccount && <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
    <section className="rounded-xl border border-primary-200 bg-primary-50/40 p-4" aria-label="Servidor Evolution GO">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h5 className="text-sm font-semibold text-foreground-900">Servidor Evolution GO</h5><p className="mt-1 text-xs leading-5 text-foreground-600">Conta corporativa: {corporateAccount.account.label}. Configure a URL HTTPS e a chave global da empresa. O teste consulta o acesso administrativo sem criar instâncias ou enviar mensagens.</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${serverActionsAvailable && corporateAccount.integration?.serverValidation?.status === 'passed' ? 'bg-[#E8F7EF] text-[#147445]' : 'bg-[#FFF1D8] text-[#965A12]'}`}>{!serverActionsAvailable ? 'Backend incompatível' : corporateAccount.integration?.serverValidation?.status === 'passed' ? 'Acesso validado' : corporateAccount.integration?.serverValidation?.status === 'failed' ? 'Teste falhou' : corporateAccount.integration?.serverConfigured ? 'Teste pendente' : 'Configuração pendente'}</span></div>
      {serverActionsAvailable && <p className="mt-2 text-xs text-foreground-600">Último teste: {stamp(corporateAccount.integration?.serverValidation?.checkedAt)}{corporateAccount.integration?.serverValidation?.status === 'failed' && <> · {serverTestErrorCopy(corporateAccount.integration.serverValidation.errorCode)}</>}</p>}
      {!serverActionsAvailable && <p role="alert" className="mt-3 rounded-xl border border-[#E9D2A9] bg-[#FFF8EA] p-3 text-xs leading-5 text-[#7B521B]">A função Evolution GO publicada ainda não oferece a configuração e o teste do servidor. Os controles ficam bloqueados para evitar novo envio da chave. A integração precisa de atualização coordenada no backend.</p>}
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null || !serverActionsAvailable} onClick={() => { setServerConfiguring((value) => !value); setServerForm({ baseUrl: '', globalApiKey: '' }); setNotice(null); }}><i className="ri-lock-2-line" />{serverConfiguring ? 'Fechar' : 'Configurar servidor'}</button><button type="button" className="wf-btn-primary text-xs disabled:opacity-60" disabled={busy !== null || !serverActionsAvailable || !corporateAccount.integration?.serverConfigured} onClick={() => void testServer()}><i className="ri-pulse-line" />{busy?.startsWith('test_server:') ? 'Testando…' : 'Testar conexão'}</button></div>
      {serverConfiguring && serverActionsAvailable && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-foreground-700">URL HTTPS do servidor<input type="url" autoComplete="off" spellCheck={false} value={serverForm.baseUrl} onChange={(event) => setServerForm({ ...serverForm, baseUrl: event.target.value })} placeholder="https://servidor.exemplo.com" className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm" /></label><label className="text-xs font-medium text-foreground-700">Chave global da API<input type="password" autoComplete="new-password" spellCheck={false} value={serverForm.globalApiKey} onChange={(event) => setServerForm({ ...serverForm, globalApiKey: event.target.value })} placeholder="Chave fornecida pelo servidor" className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm" /></label><p className="text-[11px] leading-5 text-foreground-500 sm:col-span-2">Campos vazios preservam valores já salvos. A origem HTTPS precisa estar autorizada no backend. Salvar não conecta WhatsApp nem libera mensagens.</p><div className="sm:col-span-2 sm:text-right"><button type="button" className="wf-btn-primary text-xs disabled:opacity-60" disabled={busy !== null || (!corporateAccount.integration?.serverConfigured && (!serverForm.baseUrl.trim() || !serverForm.globalApiKey.trim())) || corporateAccount.account.enabled || corporateAccount.integration?.enabled || corporateAccount.integration?.connected} onClick={() => void saveServer()}>{busy?.startsWith('save_server:') ? 'Salvando…' : 'Salvar servidor'}</button></div></div>}
      {corporateAccount.integration?.serverValidation?.status === 'passed' && <p className="mt-3 text-[11px] leading-5 text-foreground-600">Servidor autenticado. Cada vendedor conecta a própria instância na Central de Atendimento; entrada, saída e Ana exigem liberação administrativa separada.</p>}
    </section>
    <aside className="rounded-xl border border-background-200 bg-background-50 p-4" aria-label="Checklist de estado Evolution GO">
      <h5 className="text-sm font-semibold text-foreground-900">Checklist de estado</h5><p className="mt-1 text-xs leading-5 text-foreground-500">Situação atual, sem habilitar canais ou criar instâncias.</p>
      <ul className="mt-4 space-y-3">
        <EvolutionChecklistItem ready={Boolean(corporateAccount)} label="Conta corporativa" detail={corporateAccount ? 'Registro corporativo disponível.' : 'A conta corporativa ainda não foi cadastrada.'} />
        <EvolutionChecklistItem ready={serverConfigured} label="Credenciais protegidas" detail={serverConfigured ? 'URL e chave estão armazenadas no cofre.' : 'Ainda não há configuração segura registrada.'} />
        <EvolutionChecklistItem ready={serverValidated} label="Acesso ao servidor" detail={serverValidated ? 'Último teste administrativo aprovado.' : 'O teste administrativo ainda não foi aprovado.'} />
        <EvolutionChecklistItem ready={sellerAccounts.length > 0} label="Instâncias individuais" detail={sellerAccounts.length > 0 ? `${sellerAccountsCopy}.` : 'Nenhuma conta individual vinculada ainda.'} />
      </ul>
    </aside>
    </div>}
    {!selfService && canManage && <section className="mt-4 rounded-xl border border-background-200 bg-background-50 p-4" aria-label="Provisionamento automático dos vendedores">
      <h5 className="text-sm font-semibold text-foreground-900">Instâncias individuais dos vendedores</h5>
      <p className="mt-1 text-xs leading-5 text-foreground-600">Depois que o acesso do vendedor é concluído, o provisionamento automático prepara e vincula a instância individual. Não crie ou associe instâncias de vendedores manualmente neste painel; o vendedor conclui o pareamento na Central de Atendimento.</p>
      <p className="mt-2 text-[11px] leading-5 text-foreground-500">Enquanto o servidor corporativo não estiver validado, o provisionamento continua protegido. Esta área acompanha conectores sem expor QR Code, código temporário ou credenciais de outras pessoas.</p>
    </section>}
    {!selfService && !loading && canManage && !corporateAccount && <p role="status" className="mt-4 rounded-xl border border-[#E9D2A9] bg-[#FFF8EA] p-3 text-xs text-[#7B521B]">Cadastre uma conta corporativa para guardar e validar as credenciais do servidor. As contas individuais dos vendedores serão preparadas automaticamente pelo fluxo de acesso.</p>}

    {addingCorporate && canManage && !corporateAccount && <div className="mt-4 rounded-xl border border-background-200 bg-background-50 p-4">
      <div className="flex items-start justify-between gap-3"><div><h5 className="text-sm font-semibold text-foreground-900">Conta corporativa Evolution GO</h5><p className="mt-1 text-xs leading-5 text-foreground-500">Esta criação registra somente a conta da empresa para guardar e validar o servidor. As instâncias individuais continuam no provisionamento automático.</p></div><button type="button" className="rounded-lg p-1.5 text-foreground-500 hover:bg-background-100" onClick={() => setAddingCorporate(false)} aria-label="Fechar cadastro"><i className="ri-close-line" /></button></div>
      <label className="mt-4 block text-xs font-medium text-foreground-700">Nome do canal corporativo<input value={corporateLabel} onChange={(event) => setCorporateLabel(event.target.value)} placeholder="WhatsApp corporativo" className="mt-1.5 w-full rounded-lg border border-background-200 bg-white px-3 py-2 text-sm" /></label>
      <div className="mt-4 flex justify-end gap-2"><button type="button" className="wf-btn-secondary text-xs" onClick={() => setAddingCorporate(false)}>Cancelar</button><button type="button" className="wf-btn-primary text-xs disabled:opacity-60" disabled={busy !== null || !corporateLabel.trim()} onClick={() => void addCorporateAccount()}>{busy === 'create_account' ? 'Adicionando…' : 'Adicionar conta corporativa'}</button></div>
    </div>}

    {loading ? <div className="mt-4 rounded-xl border border-background-200 p-7 text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin" />Carregando contas autorizadas…</div>
      : accounts.length === 0
        ? <div className="mt-4 rounded-xl border border-dashed border-background-300 bg-background-50 p-7 text-center"><i className="ri-whatsapp-line text-3xl text-foreground-300" /><p className="mt-2 font-semibold text-foreground-800">Nenhuma conta Evolution GO disponível</p><p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-foreground-500">{selfService ? 'Nenhuma conta individual está vinculada à sua identidade. Se você tiver acesso de vendedor, a instância será preparada automaticamente depois que seu acesso for concluído; atualize esta tela quando o provisionamento terminar. Você não precisa informar a chave da API.' : canManage ? 'Adicione a conta corporativa para configurar e validar o servidor. As contas individuais dos vendedores são preparadas automaticamente pelo fluxo de acesso.' : 'Seu usuário ainda não possui uma conta individual, e nenhuma conta corporativa foi compartilhada.'}</p></div>
        : <div className={`mt-4 ${selfService ? '' : 'space-y-4'}`}>
          {!selfService && <section className="rounded-xl border border-background-200 bg-white p-4" aria-label="Contas Evolution GO disponíveis"><div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h5 className="text-sm font-semibold text-foreground-900">Instâncias vinculadas</h5><p className="mt-1 text-xs leading-5 text-foreground-500">Selecione uma conta para acompanhar seu estado e administrar o uso do conector.</p></div><span className="text-[11px] text-foreground-500">{availableAccountsCopy}</span></div><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{accounts.map((status) => {
            const badge = statusUnconfirmed ? selectedBadge : evolutionGoStatusCopy(status);
            const selectedAccount = status.account.id === selected?.account.id;
            return <button key={status.account.id} type="button" aria-pressed={selectedAccount} onClick={() => setSelectedAccountId(status.account.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedAccount ? 'border-primary-300 bg-primary-50/50 ring-1 ring-primary-200' : 'border-background-200 bg-white hover:border-background-300 hover:bg-background-50'}`}>
              <span className="flex items-start justify-between gap-2"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground-900">{status.account.label}</span><span className="mt-1 block text-[11px] leading-4 text-foreground-500">{accountScope(status.account, members)}</span></span><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${badge.className}`}><i className={`${badge.icon} mr-1`} />{badge.label}</span></span>
              <span className="mt-3 flex items-center justify-between text-[11px] text-foreground-500"><span>{status.account.phoneSuffix ? `Número final ${status.account.phoneSuffix}` : 'Número não confirmado'}</span>{status.account.isDefault && <span className="font-semibold text-primary-700">Padrão</span>}</span>
            </button>;
          })}</div></section>}

          {selected && <article className={`rounded-xl border border-background-200 p-4 ${selfService ? '' : 'bg-white'}`}>
            <div className="flex flex-wrap items-center gap-2"><h5 className="font-semibold text-foreground-950">{selected.account.label}</h5><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${selectedBadge.className}`}><i className={`${selectedBadge.icon} mr-1`} />{selectedBadge.label}</span></div><p className="mt-1 text-xs text-foreground-500">{selectedScope}</p>

            {selfService && !inCentral ? <section className="mt-4 rounded-xl border border-primary-200 bg-primary-50/40 p-3.5" aria-label="Dados para conectar meu WhatsApp">
              <h6 className="text-sm font-semibold text-foreground-900">Dados da sua conexão</h6>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><div><dt className="text-foreground-500">Conta vinculada</dt><dd className="mt-0.5 font-semibold text-foreground-900">{selected.account.label}</dd></div><div><dt className="text-foreground-500">Nome reservado no WayFlex</dt><dd className="mt-0.5 break-all font-semibold text-foreground-900">{selected.integration?.instanceName || 'Aguardando provisionamento'}</dd></div></dl>
              <ol className="mt-3 list-inside list-decimal space-y-1 text-xs leading-5 text-foreground-700"><li>Aguarde a instância aparecer como pronta para conectar.</li><li>Use Conectar e leia o QR em WhatsApp → Aparelhos conectados, ou gere um código com seu telefone.</li><li>Depois do pareamento, use Validar status para confirmar o número e a conexão.</li></ol>
              <p className="mt-2 text-[11px] leading-5 text-foreground-600">O QR e o código são temporários. Não informe sua senha do WhatsApp nem a chave da API neste painel.</p>
            </section> : !selfService ? <h6 className="mt-4 text-sm font-semibold text-foreground-900">Estado do conector selecionado</h6> : null}

            {!inCentral && <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">{selfService ? 'Estado registrado' : 'Conexão real'}</dt><dd className="mt-1 font-semibold text-foreground-900">{statusUnconfirmed ? 'Não confirmado' : connectionCopy[selected.account.connectionStatus] ?? 'Estado indisponível'}</dd></div>
              <div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">Número</dt><dd className="mt-1 font-semibold text-foreground-900">{selected.account.phoneSuffix ? `Final ${selected.account.phoneSuffix}` : 'Não confirmado'}</dd></div>
              <div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">Roteamento</dt><dd className="mt-1 font-semibold text-foreground-900">{statusUnconfirmed ? 'Não confirmado' : selected.account.enabled ? selected.account.isDefault ? 'Ativo · padrão' : 'Ativo' : 'Desativado'}</dd></div>
              <div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">Instância</dt><dd className="mt-1 truncate font-semibold text-foreground-900">{selected.integration?.instanceName || (selected.configured ? 'Identificador protegido' : 'Não provisionada')}</dd></div>
              <div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">Última validação</dt><dd className="mt-1 font-semibold text-foreground-900">{stamp(selected.integration?.lastTestedAt || selected.account.checkedAt)}</dd></div>
              <div className="rounded-xl bg-background-50 p-3"><dt className="text-foreground-500">Entrada / saída</dt><dd className="mt-1 font-semibold text-foreground-900">{statusUnconfirmed ? 'Não confirmado' : selectedOperational ? 'Liberadas' : 'Protegidas'}</dd></div>
            </dl>}

            {selfService && inCentral && <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
              <section className="rounded-xl border border-background-200 bg-background-50 p-4" aria-label="QR Code da minha instância Evolution GO">
                <h6 className="text-sm font-semibold text-foreground-900">QR Code da minha instância</h6><p className="mt-1 text-xs leading-5 text-foreground-500">Escaneie pelo WhatsApp para conectar somente o seu número.</p>
                <div className="mt-4 flex min-h-52 items-center justify-center rounded-xl border border-background-200 bg-white p-3">
                  {qrImage ? <img src={qrImage} alt="QR Code temporário da sua conta Evolution GO" className="h-48 w-48 rounded-lg object-contain" /> : pairingForSelected ? <div className="w-full text-center"><p className="text-xs font-semibold text-foreground-800">Código temporário</p><code className="mt-3 block rounded-lg bg-background-50 p-3 text-lg font-bold tracking-widest text-foreground-950">{pairingForSelected.code}</code><p className="mt-2 text-[11px] leading-5 text-foreground-500">Use somente no WhatsApp desta conta e valide o status em seguida.</p></div> : <div className="max-w-xs text-center"><i className="ri-qr-code-line text-4xl text-foreground-300" /><p className="mt-3 text-sm font-semibold text-foreground-800">{selectedPairingOpen ? 'QR Code aguardando atualização' : 'QR Code ainda não disponível'}</p><p className="mt-1 text-xs leading-5 text-foreground-500">{selectedInstanceAuthRejected ? 'O servidor não confirmou esta instância; o QR permanece protegido até a revisão administrativa.' : selectedPairingOpen ? 'Use Gerar novo QR para solicitar uma atualização segura ao backend.' : 'A conexão por QR será disponibilizada quando a instância estiver pronta.'}</p></div>}
                </div>
                {qrForSelected && <p className="mt-2 text-center text-[11px] text-foreground-500">Expira: {stamp(qrForSelected.expiresAt)}</p>}
                {selected.configured && selected.canConnect && <div className="mt-4 space-y-3"><div className="flex flex-wrap gap-2">
                  {!selectedConnected && !selectedPairingOpen && !selectedInstanceAuthRejected && <button type="button" className="wf-btn-primary text-xs" disabled={busy !== null} onClick={() => action('connect', 'Conexão iniciada. Use o QR Code ou o pareamento temporário desta conta.')}><i className="ri-link" />Conectar</button>}
                  {selectedConnected && <button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => action('reconnect', 'Reconexão solicitada. Gere um novo QR Code ou código temporário.')}><i className="ri-restart-line" />Reconectar</button>}
                  <button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => action('refresh_status', 'Status real atualizado a partir do provedor.')}><i className={busy?.startsWith('refresh_status:') ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} />Validar status</button>
                  {!selectedActive && <button type="button" className="wf-btn-primary text-xs" disabled={busy !== null || !selectedConnected} onClick={() => { if (window.confirm('Habilitar sua conta? Os controles administrativos de recebimento, envio e Ana não serão alterados.')) action('activate', 'Conta habilitada. Os controles administrativos de recebimento, envio e Ana não foram alterados.'); }}><i className="ri-play-circle-line" />Habilitar minha conta</button>}
                </div>
                {selectedPairingOpen && <div className="rounded-xl border border-background-200 bg-white p-3"><div className="flex flex-wrap gap-2"><button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => void loadQr()}><i className="ri-qr-code-line" />Gerar novo QR</button><input aria-label="Telefone para pareamento Evolution GO" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="5511999999999" className="w-44 rounded-lg border border-background-200 bg-white px-3 py-2 text-xs" /><button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null || !phoneValid} onClick={() => void requestPairing()}><i className="ri-smartphone-line" />Gerar código</button></div><p className="mt-2 text-[11px] leading-5 text-foreground-500">QR e código são temporários; o backend revalida sua permissão em cada solicitação.</p></div>}
                </div>}
              </section>
              <div className="space-y-4">
                <section className="rounded-xl border border-background-200 bg-white p-4" aria-label="Status de validação da conexão">
                  <h6 className="text-sm font-semibold text-foreground-900">Status de validação</h6><p className="mt-1 text-xs leading-5 text-foreground-500">O que já está confirmado para liberar sua conexão.</p>
                  <ul className="mt-4 space-y-3"><EvolutionChecklistItem ready label="Conta individual vinculada" detail="Seu acesso consulta somente esta conta." /><EvolutionChecklistItem ready={selected.configured && Boolean(selected.integration?.instanceName)} label="Instância Evolution GO preparada" detail={selected.integration?.instanceName ? 'Instância registrada para sua conta.' : 'A instância ainda aguarda provisionamento.'} /><EvolutionChecklistItem ready={selectedConnected} label="Sessão WhatsApp confirmada" detail={selectedConnected ? 'A sessão foi confirmada pelo provedor.' : 'A conexão ainda não foi confirmada.'} /><EvolutionChecklistItem ready={Boolean(selected.account.phoneSuffix)} label="Número vinculado" detail={selected.account.phoneSuffix ? `Número final ${selected.account.phoneSuffix}.` : 'Nenhum número confirmado ainda.'} /><EvolutionChecklistItem ready={selectedOperational} label="Uso no atendimento" detail={selectedOperational ? 'O atendimento está liberado para esta conta.' : 'Entrada e saída permanecem protegidas.'} /></ul>
                </section>
                <section className="rounded-xl border border-primary-200 bg-primary-50/40 p-4" aria-label="Como conectar seu WhatsApp">
                  <h6 className="text-sm font-semibold text-foreground-900">Como conectar seu WhatsApp</h6><ol className="mt-3 space-y-2.5 text-xs leading-5 text-foreground-700"><li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-800">1</span><span><strong>Abra o WhatsApp no celular.</strong><br />No seu aparelho, abra o aplicativo.</span></li><li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-800">2</span><span><strong>Acesse Aparelhos conectados.</strong><br />Use o menu de configurações do WhatsApp.</span></li><li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-800">3</span><span><strong>Leia o QR Code.</strong><br />Depois, valide o status para confirmar a conexão.</span></li></ol>
                </section>
                <section className="rounded-xl border border-background-200 bg-background-50 p-4" aria-label="Dados da minha conexão"><h6 className="text-sm font-semibold text-foreground-900">Dados da minha conexão</h6><dl className="mt-3 space-y-2 text-xs"><div className="flex items-start justify-between gap-4"><dt className="text-foreground-500">Conta vinculada</dt><dd className="text-right font-semibold text-foreground-900">{selected.account.label}</dd></div><div className="flex items-start justify-between gap-4"><dt className="text-foreground-500">Instância atribuída</dt><dd className="max-w-[58%] break-all text-right font-semibold text-foreground-900">{selected.integration?.instanceName || 'Aguardando provisionamento'}</dd></div><div className="flex items-start justify-between gap-4"><dt className="text-foreground-500">Estado da sessão</dt><dd className="text-right font-semibold text-foreground-900">{statusUnconfirmed ? 'Não confirmado' : connectionCopy[selected.account.connectionStatus]}</dd></div><div className="flex items-start justify-between gap-4"><dt className="text-foreground-500">Última validação</dt><dd className="text-right font-semibold text-foreground-900">{stamp(selected.integration?.lastTestedAt || selected.account.checkedAt)}</dd></div></dl></section>
              </div>
            </div>}

            {!statusUnconfirmed && (selectedInstanceAuthRejected || selected.integration?.statusDetail) && <p className="mt-3 rounded-xl border border-background-200 bg-background-50 px-3 py-2 text-xs leading-5 text-foreground-600"><span className="font-semibold text-foreground-700">Estado do servidor:</span> {selectedInstanceAuthRejected ? 'Token individual recusado. O estado de QR salvo no WayFlex não confirma uma instância no Evolution GO.' : selected.integration?.statusDetail}</p>}
            {selected.account.errorCode && <p className="mt-3 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-800">Falha registrada: {selected.account.errorCode}</p>}

            {!selected.configured && <div className="mt-4 rounded-xl border border-[#E9D2A9] bg-[#FFF8EA] p-3 text-xs leading-5 text-[#7B521B]"><i className="ri-information-line mr-1" />{selfService ? 'Seu acesso está vinculado à conta, mas o administrador ainda precisa validar o servidor e concluir o provisionamento. A conexão por QR será liberada quando a instância estiver pronta.' : 'A conta existe, mas ainda depende do provisionamento seguro do servidor. Nenhum estado de conexão será presumido.'}</div>}
            {selfService && selected.configured && !selected.canConnect && <div className="mt-4 rounded-xl border border-background-200 bg-background-50 p-3 text-xs leading-5 text-foreground-600"><i className="ri-eye-line mr-1" />Seu acesso atual não permite gerar QR Code ou código de pareamento. Solicite a permissão de conexão ao administrador.</div>}

            {selfService && !inCentral && selected.configured && selected.canConnect && <div className="mt-4 rounded-xl border border-background-200 p-3.5">
              <div><h6 className="text-sm font-semibold text-foreground-900">Conectar seu WhatsApp</h6><p className="mt-1 text-xs leading-5 text-foreground-500">As ações abaixo alcançam somente sua instância individual. Primeiro conecte; quando o estado passar para “Aguardando leitura do QR”, gere o QR Code ou o código temporário.</p></div>
              {selectedInstanceAuthRejected && <p role="alert" className="mt-3 rounded-xl border border-accent-200 bg-accent-50 p-3 text-xs leading-5 text-accent-800">O servidor não reconheceu o token desta instância. QR e pareamento ficam indisponíveis nesta tela até o administrador conferir o provisionamento; depois use Atualizar.</p>}
              {selfService && selectedConnected && !selectedActive && <div role="status" className="mt-3 rounded-xl border border-[#E9D2A9] bg-[#FFF8EA] p-3 text-xs leading-5 text-[#7B521B]"><p className="font-semibold text-[#70430E]"><i className="ri-checkbox-circle-line mr-1" />WhatsApp conectado. Sua conta ainda está desabilitada.</p><p className="mt-1">Habilitar a conta não altera os controles administrativos. Recebimento, envio e Ana dependem de liberação separada.</p></div>}
              {selfService && selectedConnected && selectedActive && !selectedOperational && <div role="status" className="mt-3 rounded-xl border border-[#E9D2A9] bg-[#FFF8EA] p-3 text-xs leading-5 text-[#7B521B]"><p className="font-semibold text-[#70430E]"><i className="ri-shield-check-line mr-1" />Sua conta está conectada, mas o atendimento ainda está protegido.</p><p className="mt-1">A conexão não precisa de outro QR Code. O recebimento e o envio dependem de liberação administrativa; atualizar o status não muda essa autorização.</p></div>}
              {selfService && selectedOperational && <div role="status" className="mt-3 flex flex-col gap-3 rounded-xl border border-[#B9E4CB] bg-[#EFFAF3] p-3 text-xs leading-5 text-[#176B43] sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold"><i className="ri-checkbox-circle-line mr-1" />Seu WhatsApp está conectado e liberado.</p><p className="mt-1">{selectedAutomationReady ? 'As conversas atribuídas a você e a automação da Ana já podem ser atendidas pela Central.' : 'As conversas atribuídas a você já podem ser atendidas na Central. A Ana automática aguarda a liberação geral da empresa.'}</p></div><Link to="/dashboard/atendimento" className="wf-btn-primary shrink-0 text-xs"><i className="ri-customer-service-2-line" />Abrir Central de Atendimento</Link></div>}
              <div className="mt-3 flex flex-wrap gap-2">
                {!selectedConnected && !selectedPairingOpen && !selectedInstanceAuthRejected && <button type="button" className="wf-btn-primary text-xs" disabled={busy !== null} onClick={() => action('connect', 'Conexão iniciada. Use o QR Code ou o pareamento temporário desta conta.')}><i className="ri-link" />Conectar</button>}
                {selectedConnected && <button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => action('reconnect', 'Reconexão solicitada. Gere um novo QR Code ou código temporário.')}><i className="ri-restart-line" />Reconectar</button>}
                <button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => action('refresh_status', 'Status real atualizado a partir do provedor.')}><i className={busy?.startsWith('refresh_status:') ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} />Validar status</button>
                {!selectedActive && <button type="button" className="wf-btn-primary text-xs" disabled={busy !== null || !selectedConnected} onClick={() => { if (window.confirm('Habilitar sua conta? Os controles administrativos de recebimento, envio e Ana não serão alterados.')) action('activate', 'Conta habilitada. Os controles administrativos de recebimento, envio e Ana não foram alterados.'); }}><i className="ri-play-circle-line" />Habilitar minha conta</button>}
              </div>

              {selectedPairingOpen && selected.canViewQr && <div className="mt-4 rounded-xl bg-background-50 p-3"><div className="flex flex-wrap items-center gap-2"><button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => void loadQr()}><i className="ri-qr-code-line" />Gerar novo QR</button><input aria-label="Telefone para pareamento Evolution GO" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="5511999999999" className="w-44 rounded-lg border border-background-200 bg-white px-3 py-2 text-xs" /><button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null || !phoneValid} onClick={() => void requestPairing()}><i className="ri-smartphone-line" />Gerar código</button></div><p className="mt-2 text-[11px] leading-5 text-foreground-500">O QR é carregado automaticamente ao abrir esta tela e pode ser renovado aqui. O backend revalida sua permissão para cada geração; QR e código nunca são incluídos na resposta de consulta da conta.</p></div>}

              {(qrForSelected || pairingForSelected) && <div className="mt-4 grid gap-3 rounded-xl border border-background-200 bg-background-50 p-3 sm:grid-cols-2">
                {qrForSelected && <div><p className="text-xs font-semibold text-foreground-800">QR Code temporário</p>{qrImage ? <img src={qrImage} alt={selfService ? 'QR Code temporário da sua conta Evolution GO' : 'QR Code temporário da conta Evolution GO selecionada'} className="mt-2 h-40 w-40 rounded-lg bg-white object-contain p-2" /> : <p className="mt-2 text-[11px] leading-5 text-foreground-600">O provedor não retornou uma imagem segura para exibição. Gere um código de pareamento ou atualize o QR.</p>}<p className="mt-2 text-[11px] text-foreground-500">Expira: {stamp(qrForSelected.expiresAt)}</p></div>}
                {pairingForSelected && <div><p className="text-xs font-semibold text-foreground-800">Código temporário</p><code className="mt-2 block rounded-lg bg-white p-3 text-base font-bold tracking-widest text-foreground-950">{pairingForSelected.code}</code><p className="mt-2 text-[11px] leading-5 text-foreground-500">Use somente no WhatsApp desta conta e valide o status em seguida.</p></div>}
              </div>}
            </div>}
            {!selfService && canManage && selected.canManage && <section className="mt-4 rounded-xl border border-background-200 bg-background-50 p-3.5" aria-label="Controle administrativo do conector">
              <h6 className="text-sm font-semibold text-foreground-900">Controle do conector</h6>
              <p className="mt-1 text-xs leading-5 text-foreground-600">{selected.account.accountType === 'seller' ? 'O vendedor faz o pareamento na Central de Atendimento. Aqui você acompanha o estado e controla o uso do conector, sem visualizar QR ou credenciais.' : 'Esta conta corporativa é acompanhada aqui; o teste da chave global fica no cartão Servidor Evolution GO. O pareamento não é feito nesta área.'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!selectedActive && selectedConnected && <button type="button" className="wf-btn-primary text-xs" disabled={busy !== null || statusUnconfirmed} onClick={() => { if (window.confirm('Habilitar o uso desta conta? Os controles globais de recebimento, envio e Ana permanecem separados.')) action('activate', 'Conector habilitado sem alterar os controles globais.'); }}><i className="ri-play-circle-line" />Habilitar conector</button>}
                {selectedActive && <button type="button" className="wf-btn-secondary text-xs text-accent-700" disabled={busy !== null || statusUnconfirmed} onClick={() => { if (window.confirm('Desativar o uso desta conta sem apagar a sessão ou o histórico?')) action('deactivate', 'Uso do conector desativado; sessão e histórico preservados.'); }}><i className="ri-pause-circle-line" />Desativar conector</button>}
                {!selectedConnected && <span className="self-center text-xs text-foreground-500">A habilitação exige conexão confirmada.</span>}
              </div>
            </section>}
            {!selfService && canManage && selected.account.accountType === 'seller' && <section className="mt-4 rounded-xl border border-[#E9D2A9] bg-[#FFF8EA] p-3.5" aria-label="Recuperação da instância individual">
              <h6 className="text-sm font-semibold text-foreground-900">Recuperação da instância individual</h6>
              <p className="mt-1 text-xs leading-5 text-foreground-600">Use somente quando o token individual for recusado. A verificação não modifica o provedor. A substituição exclui a sessão remota antiga, cria uma nova instância para o mesmo vendedor e mantém envio e Ana desativados.</p>
              <button type="button" className="wf-btn-secondary mt-3 text-xs" disabled={busy !== null || statusUnconfirmed} onClick={() => void inspectRecovery()}>{busy?.startsWith('recovery_inspect:') ? 'Verificando…' : 'Verificar instância no servidor'}</button>
              {recoveryInspection?.accountId === selected.account.id && <div className="mt-3 rounded-lg border border-[#E9D2A9] bg-white p-3 text-xs">
                <p>Instância: <strong className="break-all">{recoveryInspection.instance_name}</strong></p>
                <p className="mt-1">ID no provedor: <strong className="break-all">{recoveryInspection.provider_id || 'Não encontrada'}</strong></p>
                <p className="mt-1">Token armazenado: <strong>{recoveryInspection.token_accepted ? 'Aceito' : 'Recusado'}</strong> · Sessão: <strong>{recoveryInspection.provider_connected ? 'Conectada' : 'Desconectada'}</strong></p>
                {recoveryInspection.provider_id && !recoveryInspection.provider_connected && !recoveryInspection.token_accepted && recoveryInspection.job_state === 'awaiting_qr' && <div className="mt-3">
                  <label className="block font-medium text-foreground-700">Digite o nome exato da instância para confirmar a substituição<input value={recoveryConfirmation} onChange={(event) => setRecoveryConfirmation(event.target.value)} autoComplete="off" spellCheck={false} className="mt-1.5 w-full rounded-lg border border-background-200 px-3 py-2 text-xs" /></label>
                  <button type="button" className="wf-btn-secondary mt-3 text-xs text-accent-700 disabled:opacity-50" disabled={busy !== null || recoveryConfirmation !== recoveryInspection.instance_name} onClick={() => void replaceRecovery()}>Excluir e recriar instância</button>
                </div>}
                {(recoveryInspection.provider_connected || recoveryInspection.token_accepted || recoveryInspection.job_state !== 'awaiting_qr') && <p className="mt-2 text-foreground-600">Substituição bloqueada: a sessão está ativa, o token já funciona ou o provisionamento exige revisão.</p>}
              </div>}
            </section>}
          </article>}
        </div>}

    <p className="mt-4 text-[11px] leading-5 text-foreground-500">{selfService ? 'Esta área consulta somente a conta individual vinculada à sua identidade. A geração de conexão, QR e código é revalidada pelo backend a cada solicitação.' : <>As contas individuais continuam vinculadas ao <code>owner_user_id</code>. Este painel administrativo não entrega QR, código ou credenciais da instância ao navegador.</>}</p>
  </section>;
}
