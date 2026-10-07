import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadWhatsappAccounts,
  setWhatsappProviderEnabled,
  type WhatsappAccount,
  type WhatsappProviderControl,
} from '@/lib/crm/whatsappAccountsRepository';

type Provider = 'zapi' | 'meta_cloud';

const providerCopy: Record<Provider, {
  title: string;
  icon: string;
  iconClass: string;
  configureAnchor: string;
  configureLabel: string;
  connectLabel: string;
  description: string;
}> = {
  zapi: {
    title: 'Z-API',
    icon: 'ri-whatsapp-line',
    iconClass: 'bg-[#25D366]/10 text-[#128C3E]',
    configureAnchor: '#zapi-configuration',
    configureLabel: 'Configurar Z-API',
    connectLabel: 'Conectar a instância',
    description: 'Usa a instância corporativa já cadastrada no WayFlex.',
  },
  meta_cloud: {
    title: 'Meta WhatsApp Cloud API',
    icon: 'ri-meta-line',
    iconClass: 'bg-[#0866FF]/10 text-[#0866FF]',
    configureAnchor: '#meta-connection',
    configureLabel: 'Configurar Meta',
    connectLabel: 'Conectar com a Meta',
    description: 'Usa a conexão oficial da Meta, sem QR Code paralelo.',
  },
};

function controlFor(provider: Provider, controls: WhatsappProviderControl[], accounts: WhatsappAccount[]): WhatsappProviderControl {
  const saved = controls.find((control) => control.provider === provider);
  if (saved) return saved;
  const accountEnabled = accounts.some((account) => account.provider === provider && account.enabled && account.connected);
  return {
    provider,
    inboundEnabled: accountEnabled,
    sendEnabled: accountEnabled,
    automationEnabled: accountEnabled,
    killSwitch: !accountEnabled,
    active: accountEnabled,
    reason: null,
    updatedAt: null,
  };
}

function errorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  const copy: Record<string, string> = {
    provider_account_not_ready: 'Conecte e valide a conta antes de ativar este provedor.',
    provider_account_not_found: 'Não existe uma conta operacional deste provedor para ativar.',
    provider_activation_permission_denied: 'Seu usuário não pode alterar o provedor corporativo.',
    provider_control_save_failed: 'Não foi possível salvar a alteração do provedor.',
  };
  return copy[code] || 'Não foi possível alterar o provedor agora. Nenhum outro canal foi modificado.';
}

function ProviderCard({
  provider,
  account,
  control,
  canManage,
  busy,
  onChange,
}: {
  provider: Provider;
  account: WhatsappAccount | undefined;
  control: WhatsappProviderControl;
  canManage: boolean;
  busy: boolean;
  onChange: (provider: Provider, enabled: boolean, accountId?: string) => Promise<void>;
}) {
  const copy = providerCopy[provider];
  const configured = Boolean(account);
  const connected = account?.connected === true;
  const status = control.active ? 'Ativo' : configured && connected ? 'Pronto para ativar' : configured ? 'Aguardando conexão' : 'Não configurado';
  const statusClass = control.active
    ? 'bg-[#168654]/10 text-[#116B43]'
    : configured && connected
      ? 'bg-[#BC8B42]/10 text-[#8C651D]'
      : 'bg-background-100 text-foreground-600';
  const enable = () => void onChange(provider, true, account?.id);
  const disable = () => void onChange(provider, false, account?.id);

  return <article id={`whatsapp-provider-${provider}`} className="flex min-h-[240px] scroll-mt-24 flex-col rounded-2xl border border-background-200 bg-white p-5 shadow-[0_10px_24px_rgba(29,29,31,0.035)]">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${copy.iconClass}`}><i className={copy.icon} aria-hidden="true" /></span>
        <div>
          <h4 className="font-semibold text-foreground-950">{copy.title}</h4>
          <p className="mt-1 text-xs leading-5 text-foreground-500">{copy.description}</p>
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>{status}</span>
    </div>

    <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
      <div className="rounded-xl bg-background-50 px-3 py-2"><dt className="text-foreground-500">Conta</dt><dd className="mt-0.5 truncate font-semibold text-foreground-800">{account?.verifiedName || account?.label || 'Não cadastrada'}</dd></div>
      <div className="rounded-xl bg-background-50 px-3 py-2"><dt className="text-foreground-500">Conexão</dt><dd className="mt-0.5 font-semibold text-foreground-800">{connected ? 'Conectada' : configured ? 'Pendente' : '—'}</dd></div>
    </dl>

    <p className="mt-3 text-xs leading-5 text-foreground-500">
      {control.active
        ? 'Entrada, saída e automações da Ana usam este provedor.'
        : 'O WayFlex não envia, recebe nem inicia automações da Ana por este provedor.'}
    </p>

    <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
      <a href={copy.configureAnchor} className="wf-btn-secondary text-xs"><i className={copy.icon} />{configured ? copy.configureLabel : copy.connectLabel}</a>
      {canManage && control.active && <button type="button" className="wf-btn-secondary text-xs text-accent-700 disabled:opacity-60" disabled={busy} onClick={disable}><i className="ri-pause-circle-line" />Desativar</button>}
      {canManage && !control.active && configured && connected && <button type="button" className="wf-btn-primary text-xs disabled:opacity-60" disabled={busy} onClick={enable}><i className="ri-play-circle-line" />Ativar</button>}
    </div>
  </article>;
}

/** Painel único de escolha do canal corporativo. Não contém credenciais. */
export default function WhatsappProviderControlPanel() {
  const [accounts, setAccounts] = useState<WhatsappAccount[]>([]);
  const [controls, setControls] = useState<WhatsappProviderControl[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadWhatsappAccounts();
      setAccounts(result.accounts);
      setControls(result.providerControls);
      setCanManage(result.canManage);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const providerAccount = useMemo(() => (provider: Provider) => accounts.find((account) => account.provider === provider && account.isDefault)
    || accounts.find((account) => account.provider === provider && account.accountType === 'corporate')
    || accounts.find((account) => account.provider === provider), [accounts]);

  const change = async (provider: Provider, enabled: boolean, accountId?: string) => {
    if (!enabled && !window.confirm(`Desativar ${providerCopy[provider].title} no WayFlex? A conta e o histórico serão preservados, mas entrada, saída e a Ana ficarão bloqueadas por este provedor.`)) return;
    setBusy(provider); setError(''); setNotice('');
    try {
      await setWhatsappProviderEnabled(provider, enabled, accountId);
      setNotice(enabled
        ? `${providerCopy[provider].title} foi ativada. O outro provedor corporativo foi mantido desativado para evitar rotas ambíguas.`
        : `${providerCopy[provider].title} foi desativada no WayFlex. A sessão remota e o histórico foram preservados.`);
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="cc-channel-provider-choice-grid grid gap-4"><div className="h-60 animate-pulse rounded-2xl bg-background-100" /><div className="h-60 animate-pulse rounded-2xl bg-background-100" /></div>;

  return <section aria-label="Provedor corporativo do WhatsApp">
    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div><h4 className="text-sm font-semibold text-foreground-900">Provedor corporativo do WhatsApp</h4><p className="mt-1 text-xs leading-5 text-foreground-500">Ative apenas um provedor corporativo por vez. A troca não exclui a configuração nem o histórico.</p></div>
      <button type="button" className="wf-btn-secondary w-fit text-xs" onClick={() => void refresh()}><i className="ri-refresh-line" />Atualizar leitura</button>
    </div>
    {error && <p role="alert" className="mb-3 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-800">{error}</p>}
    {notice && <p role="status" className="mb-3 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-800">{notice}</p>}
    <div className="cc-channel-provider-choice-grid grid gap-4">
      {(['zapi', 'meta_cloud'] as Provider[]).map((provider) => <ProviderCard
        key={provider}
        provider={provider}
        account={providerAccount(provider)}
        control={controlFor(provider, controls, accounts)}
        canManage={canManage}
        busy={busy !== null}
        onChange={change}
      />)}
    </div>
  </section>;
}
