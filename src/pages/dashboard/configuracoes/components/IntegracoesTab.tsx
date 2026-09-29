import { useRef, useState } from 'react';
import type { CampoIntegracao } from '@/mocks/businessData';
import { useIntegracoesStore, type OperationalIntegration } from '@/hooks/useIntegracoesStore';
import { useFontesStore, type FonteLead } from '@/hooks/useFontesStore';
import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

const statusMeta = {
  validated: { label: 'Validada', className: 'border-[#168654]/25 bg-[#168654]/10 text-[#116B43]' },
  validation_due: { label: 'Validação vencida', className: 'border-[#BC8B42]/25 bg-[#BC8B42]/10 text-[#8C651D]' },
  inactive: { label: 'Configurada · inativa', className: 'border-background-200 bg-background-100 text-foreground-600' },
  paused: { label: 'Pausada', className: 'border-[#BC8B42]/25 bg-[#BC8B42]/10 text-[#8C651D]' },
  pending: { label: 'Entrada pendente', className: 'border-[#BC8B42]/25 bg-[#BC8B42]/10 text-[#8C651D]' },
  error: { label: 'Erro de conexão', className: 'border-[#BD3D32]/25 bg-[#BD3D32]/10 text-[#A52F27]' },
  not_configured: { label: 'Não configurada', className: 'border-background-200 bg-background-100 text-foreground-600' },
};

function errorMessage(code: string, name: string) {
  const messages: Record<string, string> = {
    integration_credentials_missing: `Salve as credenciais de ${name} antes de testar.`,
    apify_credentials_missing: 'A credencial da Apify não foi encontrada no cofre. Configure a fonte novamente.',
    source_credentials_missing: `Revise as credenciais de ${name} e salve novamente.`,
    source_not_configured: `${name} ainda não foi configurada.`,
    provider_error: `${name} recusou a validação. Confira chave, permissões e conta.`,
    ai_provider_required: 'Escolha OpenAI ou Claude como provedor principal.',
    ai_provider_key_required: 'Informe a chave do provedor principal selecionado.',
    ai_model_required: 'Escolha um modelo permitido para o provedor principal.',
    ai_model_not_allowed: 'O modelo informado não está entre as opções permitidas nesta tela.',
    ai_provider_key_missing: 'A chave do provedor principal não foi encontrada no cofre.',
    ai_provider_invalid: 'O provedor principal salvo não é válido. Configure OpenAI ou Claude novamente.',
    organization_access_denied: 'Seu usuário não possui permissão administrativa para configurar esta conexão.',
    test_phone_invalid: 'Informe um número de WhatsApp válido, com DDD. O DDI 55 é adicionado automaticamente quando necessário.',
    test_message_required: 'Escreva a mensagem de teste antes de enviar.',
    test_message_confirmation_required: 'Confirme o envio da mensagem de teste.',
    test_request_id_invalid: 'O identificador desta tentativa não é válido. Feche o teste e abra-o novamente antes de enviar.',
    test_reconciliation_required: 'A tentativa anterior pode ter chegado ao provedor e ainda está em reconciliação. Não repita o envio.',
    zapi_test_message_rejected: 'A Z-API recusou a mensagem de teste. Confira o número informado e a situação da instância.',
    zapi_test_receipt_missing: 'A Z-API não confirmou o recebimento da solicitação. Nenhuma entrega foi assumida.',
    zapi_credentials_rejected: 'A Z-API recusou as credenciais. Salve e valide novamente.',
    zapi_instance_not_connected: 'A instância existe, mas o WhatsApp ainda não está conectado.',
    zapi_phone_offline: 'O celular vinculado à instância está offline.',
    whatsapp_provider_disabled: 'A conexão com a Z-API foi validada, mas o provedor está desativado no WayFlex. Use “Ativar” no cartão Z-API acima antes de enviar uma mensagem de teste.',
    whatsapp_paused_by_risk_policy: 'O canal está pausado por uma política de risco. Consulte o Status operacional.',
  };
  return messages[code] || `Não foi possível validar ${name}. ${code || 'Tente novamente.'}`;
}

function CredentialField({ field, value, onChange }: { field: CampoIntegracao; value: string; onChange: (value: string) => void }) {
  const inputClass = 'w-full rounded-xl border border-background-200 bg-background-100 px-3.5 py-2.5 text-sm text-foreground-950 placeholder:text-foreground-400 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20';
  return <label className="block text-sm font-semibold text-[#3A3A3C]"><span className="mb-1.5 block">{field.rotulo}{field.obrigatorio && <span className="ml-1 text-[#BD3D32]">*</span>}</span>{field.tipo === 'selecao' ? <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Selecione…</option>{(field.opcoes || []).map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input className={inputClass} type={field.tipo === 'senha' ? 'password' : 'text'} value={value} placeholder={field.placeholder} autoComplete="off" onChange={(event) => onChange(event.target.value)} />}{field.ajuda && <span className="mt-1.5 block text-xs font-normal text-[#777E89]">{field.ajuda}</span>}</label>;
}

export function ConfigureModal({ integration, onClose, onSaved }: { integration: OperationalIntegration; onClose: () => void; onSaved: () => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const configuration = integration.anaProviderConfiguration;
    if (integration.remoteKey !== 'ai' || !configuration) return {};
    return {
      provedor_principal: configuration.provider === 'openai' ? 'OpenAI' : 'Claude',
      ...(configuration.openaiModel ? { openai_model: configuration.openaiModel } : {}),
      ...(configuration.claudeModel ? { claude_model: configuration.claudeModel } : {}),
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    const missing = integration.campos.filter((field) => field.obrigatorio && !values[field.id]?.trim()).map((field) => field.rotulo);
    if (integration.remoteKey === 'apify' && !values.actor_id?.trim() && !values.task_id?.trim()) missing.push('Actor ID ou Task ID');
    const selectedProvider = values.provedor_principal?.trim().toLowerCase();
    if (integration.remoteKey === 'ai' && (selectedProvider === 'openai' || selectedProvider === 'claude')) {
      const modelField = selectedProvider === 'openai' ? 'openai_model' : 'claude_model';
      if (!values[modelField]?.trim()) missing.push(`Modelo ${selectedProvider === 'openai' ? 'OpenAI' : 'Claude'}`);
    }
    if (missing.length) { setError(`Preencha: ${[...new Set(missing)].join(', ')}.`); return; }
    setSaving(true); setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('configurar-integracao', { body: { canal: integration.remoteKey, credenciais: values } });
      if (invokeError || !data?.ok) throw new Error(data?.erro || await detalheDoErroDeFuncao(invokeError));
      await onSaved();
      onClose();
    } catch (cause) { setError(errorMessage(cause instanceof Error ? cause.message : '', integration.nome)); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14151A]/45 p-4" onClick={onClose}><section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-background-200 bg-white shadow-xl" onClick={(event) => event.stopPropagation()}><header className="flex items-start justify-between border-b border-background-200 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-700">Cofre seguro</p><h3 className="mt-1 text-lg font-bold tracking-tight text-foreground-950">Configurar {integration.nome}</h3><p className="mt-1 text-xs text-foreground-500">As chaves são enviadas diretamente ao backend e não permanecem no navegador.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" aria-label="Fechar"><i className="ri-close-line text-lg" /></button></header><div className="space-y-4 p-5">{error && <div className="rounded-xl border border-[#BD3D32]/25 bg-[#BD3D32]/10 px-3.5 py-3 text-sm text-[#A52F27]">{error}</div>}{integration.campos.map((field) => <CredentialField key={field.id} field={field} value={values[field.id] || ''} onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))} />)}</div><footer className="flex justify-end gap-2 border-t border-background-200 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={saving} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar credenciais'}</button></footer></section></div>;
}

function WhatsAppTestModal({ integration, onClose, onCompleted }: { integration: OperationalIntegration; onClose: () => void; onCompleted: (environmentMessage: string | null) => Promise<void> }) {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('Olá! Esta é uma mensagem de teste enviada pela WayFlex.');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const requestIdRef = useRef<string | null>(null);
  const requestFingerprintRef = useRef<string | null>(null);

  const resetRequestForChangedInput = () => {
    requestIdRef.current = null;
    requestFingerprintRef.current = null;
  };

  const send = async () => {
    if (!phone.trim() || !message.trim() || sending) return;
    if (!window.confirm(`Enviar uma mensagem real de teste para o número final ${phone.replace(/\D/g, '').slice(-4) || 'informado'}?`)) return;
    const fingerprint = `${phone.replace(/\D/g, '')}:${message.trim()}`;
    if (requestFingerprintRef.current !== fingerprint || !requestIdRef.current) {
      requestFingerprintRef.current = fingerprint;
      requestIdRef.current = crypto.randomUUID();
    }
    setSending(true); setError(''); setSuccess('');
    try {
      const validation = await supabase.functions.invoke('testar-integracao', { body: { canal: 'whatsapp' } });
      if (validation.error || !validation.data?.pronto) throw new Error(validation.error ? await detalheDoErroDeFuncao(validation.error) : validation.data?.erro || validation.data?.detalhe);
      if (validation.data?.canalPronto === false) throw new Error(validation.data?.bloqueioOperacional || 'whatsapp_provider_disabled');
      const directTest = await supabase.functions.invoke('enviar-teste-whatsapp', {
        body: { phone, message, request_id: requestIdRef.current, confirmation: 'SEND_REAL_WHATSAPP_TEST' },
      });
      if (directTest.error || !directTest.data?.ok) throw new Error(directTest.error ? await detalheDoErroDeFuncao(directTest.error) : directTest.data?.erro);
      if (directTest.data?.reconciliationRequired) {
        setError('A solicitação pode ter sido aceita pelo provedor, mas ainda precisa de reconciliação. Não envie novamente; consulte o Registro do Sistema.');
        return;
      }
      await onCompleted(validation.data?.ambienteRealMensagem || null);
      setSuccess(`Mensagem aceita pela Z-API para o número final ${directTest.data.phoneSuffix}. Entrega e leitura aguardam os callbacks do canal.`);
    } catch (cause) {
      setError(errorMessage(cause instanceof Error ? cause.message : '', integration.nome));
    } finally { setSending(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14151A]/45 p-4" onClick={onClose}>
    <section className="w-full max-w-xl rounded-2xl border border-background-200 bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-start justify-between border-b border-background-200 px-5 py-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-700">Teste real do canal</p><h3 className="mt-1 text-lg font-bold tracking-tight text-foreground-950">Enviar teste pelo WhatsApp</h3><p className="mt-1 text-xs leading-relaxed text-foreground-500">Informe um número seu. O sistema valida a Z-API e envia uma única mensagem real, sem criar lead, conversa ou automação.</p></div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" aria-label="Fechar"><i className="ri-close-line text-lg" /></button>
      </header>
      <div className="space-y-4 p-5">
        {error && <div className="rounded-xl border border-[#BD3D32]/25 bg-[#BD3D32]/10 px-3.5 py-3 text-sm text-[#A52F27]">{error}</div>}
        {success && <div className="rounded-xl border border-[#168654]/25 bg-[#168654]/10 px-3.5 py-3 text-sm text-[#116B43]">{success}</div>}
        <label className="block text-sm font-semibold text-foreground-800"><span className="mb-1.5 block">Número para teste</span><input className="w-full rounded-xl border border-background-200 bg-background-100 px-3.5 py-2.5 text-sm text-foreground-950 placeholder:text-foreground-400 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => { resetRequestForChangedInput(); setPhone(event.target.value); }} placeholder="(11) 99999-9999" /></label>
        <label className="block text-sm font-semibold text-foreground-800"><span className="mb-1.5 block">Mensagem</span><textarea className="min-h-24 w-full resize-y rounded-xl border border-background-200 bg-background-100 px-3.5 py-2.5 text-sm text-foreground-950 placeholder:text-foreground-400 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20" maxLength={600} value={message} onChange={(event) => { resetRequestForChangedInput(); setMessage(event.target.value); }} /></label>
        <p className="rounded-xl border border-[#BC8B42]/25 bg-[#BC8B42]/10 px-3 py-2.5 text-xs leading-relaxed text-[#8C651D]">Este envio é real. Use um número sob seu controle. A aceitação pela Z-API não confirma entrega, leitura, callbacks nem o acionamento da Ana.</p>
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-background-200 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={onClose}>Fechar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={sending || !phone.trim() || !message.trim()} onClick={() => void send()}><i className={sending ? 'ri-loader-4-line animate-spin' : 'ri-send-plane-fill'} />{sending ? 'Validando e enviando…' : 'Validar e enviar teste'}</button></footer>
    </section>
  </div>;
}

export default function IntegracoesTab({ category }: { category?: OperationalIntegration['operationalCategory'] }) {
  const { integracoes, recarregar } = useIntegracoesStore();
  const { fontes, definirAtivacao, recarregar: recarregarFontes } = useFontesStore();
  const [configuring, setConfiguring] = useState<OperationalIntegration | null>(null);
  const [whatsappTest, setWhatsappTest] = useState<OperationalIntegration | null>(null);
  const [testing, setTesting] = useState<OperationalIntegration['remoteKey'] | null>(null);
  const [repairingApify, setRepairingApify] = useState(false);
  const [togglingSource, setTogglingSource] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = async () => { await Promise.all([recarregar(), recarregarFontes()]); };
  const refreshStatus = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setNotice('');
    try {
      await refresh();
      setNotice('Status atualizado com a leitura operacional mais recente.');
    } catch {
      setNotice('Não foi possível atualizar o status agora. Nenhuma configuração foi alterada.');
    } finally {
      setRefreshing(false);
    }
  };
  const test = async (integration: OperationalIntegration) => {
    setTesting(integration.remoteKey); setNotice('');
    try {
      const { data, error } = await supabase.functions.invoke('testar-integracao', { body: { canal: integration.remoteKey } });
      if (error || !data?.pronto) throw new Error(error ? await detalheDoErroDeFuncao(error) : data?.erro || data?.detalhe);
      await refresh();
      if (integration.remoteKey === 'whatsapp') {
        setNotice(`A Z-API respondeu que a instância está conectada. Isso não confirma entrega ou leitura, callbacks de entrada nem automações da Ana.${data.ambienteRealMensagem ? ` ${data.ambienteRealMensagem}` : ''}`);
      } else if (integration.remoteKey === 'ai') {
        setNotice('As credenciais do provedor da Ana responderam à validação. Esta etapa não executa nem valida o modelo selecionado e não ativa automações.');
      } else {
        setNotice(`${integration.nome} foi validada. O teste não gerou conversa nem enviou mensagem a leads.`);
      }
    } catch (cause) { setNotice(errorMessage(cause instanceof Error ? cause.message : '', integration.nome)); }
    finally { setTesting(null); }
  };

  const repairApifyGoogleMapsActor = async (integration: OperationalIntegration) => {
    if (repairingApify) return;
    setRepairingApify(true); setNotice('');
    try {
      const { data, error } = await supabase.functions.invoke('configurar-integracao', {
        body: { canal: 'apify', credenciais: { usar_actor_google_maps: true } },
      });
      if (error || !data?.ok) throw new Error(error ? await detalheDoErroDeFuncao(error) : data?.erro);
      await refresh();
      setNotice('Actor de Google Maps corrigido no cofre. Agora use “Testar conexão”; a fonte só será ativada se a Apify aceitar a validação.');
    } catch (cause) {
      setNotice(errorMessage(cause instanceof Error ? cause.message : '', integration.nome));
    } finally { setRepairingApify(false); }
  };

  const toggleProspectingSource = async (source: FonteLead) => {
    if (togglingSource) return;
    const activate = source.status !== 'ativo';
    setTogglingSource(source.id); setNotice('');
    try {
      await definirAtivacao(source.id, activate);
      await refresh();
      setNotice(activate
        ? `${source.nome} está ativa para a Busca de Leads.`
        : `${source.nome} foi pausada para a Busca de Leads.`);
    } catch (cause) {
      setNotice(cause instanceof Error && cause.message === 'source_not_validated'
        ? `${source.nome} precisa ser configurada e validada antes de ser ativada.`
        : `Não foi possível alterar o uso de ${source.nome} na Busca de Leads.`);
    } finally { setTogglingSource(null); }
  };

  const visibleIntegrations = category ? integracoes.filter((integration) => integration.operationalCategory === category) : integracoes;

  return <div className="space-y-4">
    {notice && <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">{notice}</div>}
    <div className="flex justify-end">
      <button type="button" className="wf-btn-secondary text-xs" disabled={refreshing} onClick={() => void refreshStatus()}>
        <i className={refreshing ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} />{refreshing ? 'Atualizando…' : 'Atualizar status'}
      </button>
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {visibleIntegrations.map((integration) => {
        const meta = statusMeta[integration.status];
        const anaConfiguration = integration.anaProviderConfiguration;
        const source = integration.operationalCategory === 'prospecting'
          ? fontes.find((item) => item.sourceKey === integration.remoteKey)
          : null;
        const sourceError = source?.lastError ?? null;
        const canRepairApifyActor = integration.remoteKey === 'apify'
          && (integration.lastError === 'apify_http_400' || sourceError === 'apify_http_400');
        const whatsappNeedsActivation = integration.remoteKey === 'whatsapp'
          && integration.connected
          && (integration.paused || !integration.enabled);
        const focusWhatsappActivation = () => document.getElementById('whatsapp-provider-zapi')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return <article key={integration.remoteKey} className="flex min-h-[250px] flex-col rounded-xl border border-background-200 bg-white p-4 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><i className={`${integration.icone} text-base`} /></div>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${meta.className}`}>{meta.label}</span>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground-950">{integration.nome}</h3>
          <p className="mt-1 line-clamp-3 text-xs leading-5 text-foreground-500">{integration.descricao}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-background-100 p-3 text-[11px]">
            <div><dt className="text-foreground-400">Validação</dt><dd className="mt-0.5 font-semibold text-foreground-700">{integration.status === 'validated' ? 'Confirmada' : integration.status === 'validation_due' ? 'Vencida' : integration.connected ? 'Credencial salva' : 'Não validada'}</dd></div>
            <div><dt className="text-foreground-400">Uso operacional</dt><dd className="mt-0.5 font-semibold text-foreground-700">{integration.paused ? 'Pausado' : integration.enabled ? 'Habilitado' : 'Inativo'}</dd></div>
            {source && <div className="col-span-2"><dt className="text-foreground-400">Busca de Leads</dt><dd className="mt-0.5 font-semibold text-foreground-700">{source.status === 'ativo' ? 'Ativa' : source.status === 'inativo' ? 'Pausada' : 'Aguardando validação'}</dd></div>}
          </dl>
          <div className="mt-3 space-y-1 text-[11px] text-foreground-400">
            <p>Último teste: {integration.ultimoTeste}</p>
            {anaConfiguration && <>
              <p>Configuração salva: {anaConfiguration.provider === 'openai' ? 'OpenAI' : 'Claude'} · {anaConfiguration.model}</p>
              <p>Chaves no cofre: OpenAI {anaConfiguration.openaiConfigured ? 'configurada' : 'não configurada'} · Claude {anaConfiguration.claudeConfigured ? 'configurada' : 'não configurada'}</p>
              <p className="text-[#8C651D]">Modelo ainda não validado por uma chamada ao modelo.</p>
            </>}
            {integration.lastError && <p className="line-clamp-2 text-[#A52F27]">{integration.lastError}</p>}
            {!integration.lastError && sourceError && <p className="line-clamp-2 text-[#A52F27]">Busca: {sourceError}</p>}
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-3"><button type="button" onClick={() => setConfiguring(integration)} className="wf-btn-secondary justify-center text-xs">{integration.connected || integration.enabled ? 'Editar configuração' : 'Configurar'}</button><button type="button" disabled={testing === integration.remoteKey || (integration.remoteKey === 'apify' && repairingApify)} onClick={() => whatsappNeedsActivation ? focusWhatsappActivation() : integration.remoteKey === 'whatsapp' ? integration.connected ? setWhatsappTest(integration) : void test(integration) : void test(integration)} className="wf-btn-primary justify-center text-xs disabled:opacity-60">{testing === integration.remoteKey ? 'Validando…' : whatsappNeedsActivation ? 'Ativar Z-API acima' : integration.remoteKey === 'whatsapp' ? integration.connected ? 'Testar envio' : 'Validar conexão' : 'Testar conexão'}</button>{source && <button type="button" disabled={togglingSource === source.id || source.connectionStatus !== 'connected'} onClick={() => void toggleProspectingSource(source)} className="col-span-2 wf-btn-secondary justify-center text-xs disabled:cursor-not-allowed disabled:opacity-60" title={source.connectionStatus === 'connected' ? undefined : 'Configure e valide a conexão antes de ativar a Busca de Leads.'}><i className={togglingSource === source.id ? 'ri-loader-4-line animate-spin' : source.status === 'ativo' ? 'ri-pause-circle-line' : 'ri-play-circle-line'} />{togglingSource === source.id ? 'Salvando uso…' : source.status === 'ativo' ? 'Pausar na Busca de Leads' : 'Ativar na Busca de Leads'}</button>}{canRepairApifyActor && <button type="button" disabled={repairingApify} onClick={() => void repairApifyGoogleMapsActor(integration)} className="col-span-2 wf-btn-secondary justify-center text-xs text-primary-700 disabled:opacity-60"><i className={repairingApify ? 'ri-loader-4-line animate-spin' : 'ri-map-pin-line'} />{repairingApify ? 'Corrigindo Actor…' : 'Corrigir Actor Google Maps'}</button>}</div>
        </article>;
      })}
    </div>
    {visibleIntegrations.length === 0 && <div className="rounded-xl border border-dashed border-background-200 bg-white p-6 text-sm text-foreground-500">Nenhum conector desta categoria está disponível para esta empresa.</div>}
    {configuring && <ConfigureModal integration={configuring} onClose={() => setConfiguring(null)} onSaved={refresh} />}
    {whatsappTest && <WhatsAppTestModal integration={whatsappTest} onClose={() => setWhatsappTest(null)} onCompleted={async (environmentMessage) => { await refresh(); setNotice(`A Z-API aceitou a solicitação de teste. Isso não confirma entrega ou leitura, callbacks de entrada nem automações da Ana.${environmentMessage ? ` ${environmentMessage}` : ''}`); }} />}
  </div>;
}
