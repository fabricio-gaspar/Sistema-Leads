import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TeamMember } from '@/lib/crm/teamMembersRepository';
import {
  configureSellerWhatsappAccount,
  loadWhatsappAccounts,
  refreshWhatsappAccount,
  requestWhatsappConnectorToken,
  setWhatsappAccountEnabled,
  type WhatsappAccount,
  type WhatsappConnectionStatus,
} from '@/lib/crm/whatsappAccountsRepository';
import { openZapiConnector } from '@/lib/zapiConnector';
import MetaCoexistencePanel from '@/components/feature/MetaCoexistencePanel';

const statusCopy: Record<WhatsappConnectionStatus, { label: string; tone: string; icon: string }> = {
  unconfigured: { label: 'Não configurado', tone: 'bg-background-100 text-foreground-600', icon: 'ri-settings-4-line' },
  configured: { label: 'Aguardando conexão', tone: 'bg-amber-50 text-amber-800', icon: 'ri-time-line' },
  qr: { label: 'QR Code aberto', tone: 'bg-primary-50 text-primary-800', icon: 'ri-qr-code-line' },
  connected: { label: 'Conectado', tone: 'bg-primary-50 text-primary-800', icon: 'ri-checkbox-circle-line' },
  disconnected: { label: 'Desconectado', tone: 'bg-amber-50 text-amber-800', icon: 'ri-link-unlink-m' },
  expired: { label: 'Instância expirada', tone: 'bg-accent-50 text-accent-800', icon: 'ri-error-warning-line' },
  error: { label: 'Erro de validação', tone: 'bg-accent-50 text-accent-800', icon: 'ri-close-circle-line' },
};

const errorCopy: Record<string, string> = {
  permission_denied: 'Seu usuário não pode gerenciar esta conta.',
  whatsapp_account_access_denied: 'Esta conta pertence a outro usuário.',
  whatsapp_account_owner_already_assigned: 'Este usuário já possui uma conta operacional.',
  whatsapp_account_owner_required: 'Selecione o usuário responsável.',
  whatsapp_account_label_required: 'Informe um nome para a conta.',
  zapi_credentials_required: 'Informe Instance ID, Token da instância e Client-Token.',
  zapi_credentials_incomplete: 'As credenciais desta instância estão incompletas.',
  zapi_credentials_rejected: 'A Z-API recusou as credenciais informadas.',
  zapi_client_token_rejected: 'A Z-API recusou o Client-Token.',
  zapi_instance_not_found: 'A instância não foi encontrada na Z-API.',
  zapi_connector_load_failed: 'Não foi possível carregar o conector oficial da Z-API.',
  zapi_connector_unavailable: 'O conector oficial da Z-API não ficou disponível.',
  zapi_instance_not_connected: 'A instância está válida, mas o WhatsApp ainda não está conectado.',
  corporate_whatsapp_account_protected: 'O WhatsApp corporativo padrão não pode ser desativado aqui.',
};

function messageFor(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return errorCopy[code] ?? 'A operação não foi concluída. O estado anterior foi preservado.';
}

function dateTime(value: string | null): string {
  if (!value) return 'Ainda não confirmado';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Ainda não confirmado' : date.toLocaleString('pt-BR');
}

export default function WhatsappAccountPanel({
  member,
  mode = 'full',
  showMetaUnavailable = false,
}: {
  member?: TeamMember;
  mode?: 'full' | 'meta';
  showMetaUnavailable?: boolean;
}) {
  const [accounts, setAccounts] = useState<WhatsappAccount[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ label: '', instanceId: '', instanceToken: '', clientToken: '', urlBase: 'https://api.z-api.io' });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadWhatsappAccounts();
      setAccounts(result.accounts);
      setCanManage(result.canManage);
      setError('');
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const visibleAccounts = useMemo(() => accounts.filter((account) => account.provider === 'zapi'
    && (!member || account.ownerUserId === member.userId)), [accounts, member]);
  const memberAccount = member ? visibleAccounts[0] : undefined;

  const startEditing = () => {
    setForm({
      label: memberAccount?.label || `WhatsApp de ${member?.name ?? 'vendedor'}`,
      instanceId: '', instanceToken: '', clientToken: '', urlBase: 'https://api.z-api.io',
    });
    setEditing(true);
    setError('');
    setNotice('');
  };

  const saveConfiguration = async () => {
    if (!member) return;
    setBusy('configure');
    try {
      await configureSellerWhatsappAccount({
        accountId: memberAccount?.id,
        ownerUserId: member.userId,
        label: form.label.trim(),
        instanceId: form.instanceId.trim() || undefined,
        instanceToken: form.instanceToken.trim() || undefined,
        clientToken: form.clientToken.trim() || undefined,
        urlBase: form.urlBase.trim() || undefined,
      });
      setEditing(false);
      setNotice('Configuração guardada no cofre. Agora conecte o WhatsApp pelo QR Code ou telefone.');
      await refresh();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(null);
    }
  };

  const connect = async (account: WhatsappAccount) => {
    setBusy(account.id);
    setError('');
    setNotice('');
    try {
      const token = await requestWhatsappConnectorToken(account.id);
      const connected = await openZapiConnector(token);
      const status = await refreshWhatsappAccount(account.id);
      setNotice(connected && status.connected
        ? 'WhatsApp conectado e callbacks de entrada registrados.'
        : 'Conector fechado. O status real da instância foi atualizado.');
      await refresh();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(null);
    }
  };

  const checkStatus = async (account: WhatsappAccount) => {
    setBusy(account.id);
    setError('');
    try {
      const status = await refreshWhatsappAccount(account.id);
      setNotice(status.connected
        ? 'Conexão, saída e callbacks de entrada confirmados pela Z-API.'
        : 'A instância respondeu, mas ainda não existe uma sessão WhatsApp conectada.');
      await refresh();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (account: WhatsappAccount) => {
    setBusy(account.id);
    try {
      await setWhatsappAccountEnabled(account.id, !account.enabled);
      setNotice(account.enabled ? 'Conta desativada sem apagar o histórico.' : 'Conta habilitada para novas conversas atribuídas.');
      await refresh();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(null);
    }
  };

  return <div className="space-y-4">
    {mode === 'full' && <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-700">Canal operacional</p>
        <h2 className="mt-1 font-heading text-xl font-bold text-foreground-950">{member ? `WhatsApp de ${member.name}` : 'WhatsApps da empresa'}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground-500">
          {member
            ? 'O usuário conecta a própria sessão pelo conector oficial. Credenciais permanecem no backend e nunca aparecem no navegador.'
            : 'O número corporativo continua padrão. Contas individuais ficam isoladas por responsável e conversa.'}
        </p>
      </div>
      {member && canManage && !editing && <button type="button" onClick={startEditing} className="wf-btn-secondary whitespace-nowrap">
        <i className={memberAccount ? 'ri-edit-line' : 'ri-add-line'} />{memberAccount ? 'Editar instância' : 'Configurar instância'}
      </button>}
    </div>}

    <MetaCoexistencePanel member={member} accounts={accounts} canManage={canManage} onConnected={refresh} showUnavailableWhenDisabled={showMetaUnavailable} />

    {error && <div role="alert" className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800">{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">{notice}</div>}

    {mode === 'full' && <>{editing && member && <section className="rounded-2xl border border-background-200 bg-background-100/60 p-4">
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        <i className="ri-lock-2-line mt-0.5 text-base" />
        <span>Use uma instância já criada na Z-API. Salvar não cria plano, não faz cobrança e não envia mensagens. Em uma edição, deixe os segredos vazios para preservá-los.</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AccountField label="Nome interno"><input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="WhatsApp comercial — Juca" /></AccountField>
        <AccountField label="URL da API"><input value={form.urlBase} onChange={(event) => setForm({ ...form, urlBase: event.target.value })} /></AccountField>
        <AccountField label="Instance ID"><input autoComplete="off" value={form.instanceId} onChange={(event) => setForm({ ...form, instanceId: event.target.value })} placeholder={memberAccount ? 'Vazio mantém o atual' : 'ID da instância'} /></AccountField>
        <AccountField label="Token da instância"><input type="password" autoComplete="new-password" value={form.instanceToken} onChange={(event) => setForm({ ...form, instanceToken: event.target.value })} placeholder={memberAccount ? 'Vazio mantém o atual' : 'Token da instância'} /></AccountField>
        <AccountField label="Client-Token"><input type="password" autoComplete="new-password" value={form.clientToken} onChange={(event) => setForm({ ...form, clientToken: event.target.value })} placeholder={memberAccount ? 'Vazio mantém o atual' : 'Token de segurança'} /></AccountField>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="wf-btn-secondary" onClick={() => setEditing(false)}>Cancelar</button>
        <button type="button" disabled={busy === 'configure'} className="wf-btn-primary disabled:opacity-60" onClick={() => void saveConfiguration()}>{busy === 'configure' ? 'Salvando…' : 'Salvar no cofre'}</button>
      </div>
    </section>}

    {loading ? <div className="rounded-2xl border border-background-200 p-8 text-center text-sm text-foreground-500">Carregando status real…</div>
      : visibleAccounts.length === 0
        ? <div className="rounded-2xl border border-dashed border-background-300 bg-background-100/60 p-7 text-center">
          <i className="ri-whatsapp-line text-3xl text-foreground-300" />
          <p className="mt-2 font-semibold text-foreground-800">Nenhuma conta operacional atribuída</p>
          <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-foreground-500">{canManage ? 'Configure uma instância existente para este usuário.' : 'Peça ao administrador para atribuir uma instância Z-API ao seu usuário.'}</p>
          {member && canManage && <button type="button" onClick={startEditing} className="wf-btn-primary mt-4"><i className="ri-add-line" />Configurar instância</button>}
        </div>
        : <div className="grid gap-3 lg:grid-cols-2">{visibleAccounts.map((account) => {
          const status = statusCopy[account.connectionStatus] ?? statusCopy.error;
          return <article key={account.id} className="rounded-2xl border border-background-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#e9fbf0] text-xl text-[#128c4a]"><i className="ri-whatsapp-line" /></div>
                <div className="min-w-0"><h3 className="truncate font-semibold text-foreground-900">{account.label}</h3><p className="truncate text-xs text-foreground-500">{account.isDefault ? 'Corporativo padrão' : account.ownerName || account.ownerEmail || 'Conta individual'}</p></div>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.tone}`}><i className={status.icon} />{status.label}</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-background-100/70 p-3 text-xs">
              <div><dt className="text-foreground-400">Número</dt><dd className="mt-1 font-semibold text-foreground-700">{account.connectedPhoneSuffix ? `final ${account.connectedPhoneSuffix}` : 'Não identificado'}</dd></div>
              <div><dt className="text-foreground-400">Roteamento</dt><dd className="mt-1 font-semibold text-foreground-700">{account.enabled ? 'Ativo' : 'Desativado'}</dd></div>
              <div className="col-span-2"><dt className="text-foreground-400">Última validação</dt><dd className="mt-1 font-semibold text-foreground-700">{dateTime(account.statusCheckedAt)}</dd></div>
            </dl>
            {account.lastErrorCode && <p className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-800">Falha registrada: {account.lastErrorCode}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {!account.isDefault && account.configured && <button type="button" disabled={busy === account.id} onClick={() => void connect(account)} className="wf-btn-primary text-xs disabled:opacity-60"><i className="ri-qr-code-line" />{account.connected ? 'Reconectar' : 'Conectar WhatsApp'}</button>}
              {account.configured && <button type="button" disabled={busy === account.id} onClick={() => void checkStatus(account)} className="wf-btn-secondary text-xs disabled:opacity-60"><i className="ri-refresh-line" />Validar agora</button>}
              {!account.isDefault && canManage && <button type="button" disabled={busy === account.id} onClick={() => void toggle(account)} className="wf-btn-secondary text-xs disabled:opacity-60"><i className={account.enabled ? 'ri-pause-circle-line' : 'ri-play-circle-line'} />{account.enabled ? 'Desativar' : 'Ativar'}</button>}
            </div>
          </article>;
        })}</div>}</>}
  </div>;
}

function AccountField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-semibold text-foreground-700"><span className="mb-1.5 block">{label}</span><span className="block [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-background-200 [&_input]:bg-white [&_input]:px-3.5 [&_input]:py-2.5 [&_input]:text-sm">{children}</span></label>;
}
