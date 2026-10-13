import { useState } from 'react';
import { useIntegracoesStore, type OperationalIntegration } from '@/hooks/useIntegracoesStore';
import { useFontesStore, type FonteLead } from '@/hooks/useFontesStore';
import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';
import { IntegrationConfigureModal } from './IntegrationConfigureModal';

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
    ai_provider_required: 'Escolha OpenAI, Claude ou FreeLLMAPI como provedor principal.',
    ai_provider_key_required: 'Informe a chave do provedor principal selecionado.',
    ai_model_required: 'Escolha um modelo permitido para o provedor principal.',
    ai_model_not_allowed: 'O modelo informado não está entre as opções permitidas nesta tela.',
    ai_provider_key_missing: 'A chave do provedor principal não foi encontrada no cofre.',
    ai_provider_invalid: 'O provedor principal salvo não é válido. Configure OpenAI, Claude ou FreeLLMAPI novamente.',
    organization_access_denied: 'Seu usuário não possui permissão administrativa para configurar esta conexão.',
    channel_not_supported: 'Este canal legado foi removido. Configure o WhatsApp em Canais com WA-AKG.',
  };
  return messages[code] || `Não foi possível validar ${name}. ${code || 'Tente novamente.'}`;
}

export default function IntegracoesTab({ category, layout = 'grid' }: { category?: OperationalIntegration['operationalCategory']; layout?: 'grid' | 'single' }) {
  const { integracoes, recarregar } = useIntegracoesStore();
  const { fontes, definirAtivacao, recarregar: recarregarFontes } = useFontesStore();
  const [configuring, setConfiguring] = useState<OperationalIntegration | null>(null);
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
      if (integration.remoteKey === 'ai') {
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
    <div className={layout === 'single' ? 'grid grid-cols-1 gap-3' : 'grid gap-3 md:grid-cols-2 xl:grid-cols-3'}>
      {visibleIntegrations.map((integration) => {
        const meta = statusMeta[integration.status];
        const anaConfiguration = integration.anaProviderConfiguration;
        const source = integration.operationalCategory === 'prospecting'
          ? fontes.find((item) => item.sourceKey === integration.remoteKey)
          : null;
        const sourceError = source?.lastError ?? null;
        const canRepairApifyActor = integration.remoteKey === 'apify'
          && (integration.lastError === 'apify_http_400' || sourceError === 'apify_http_400');
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
              <p>Configuração salva: {anaConfiguration.provider === 'openai' ? 'OpenAI' : anaConfiguration.provider === 'claude' ? 'Claude' : 'FreeLLMAPI'} · {anaConfiguration.model}</p>
              <p>Gateway FreeLLMAPI: {anaConfiguration.freellmConfigured ? 'disponível' : 'indisponível'} · OpenAI {anaConfiguration.openaiConfigured ? 'configurada' : 'não configurada'} · Claude {anaConfiguration.claudeConfigured ? 'configurada' : 'não configurada'}</p>
              <p className="text-[#8C651D]">Modelo ainda não validado por uma chamada ao modelo.</p>
            </>}
            {integration.lastError && <p className="line-clamp-2 text-[#A52F27]">{integration.lastError}</p>}
            {!integration.lastError && sourceError && <p className="line-clamp-2 text-[#A52F27]">Busca: {sourceError}</p>}
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-3"><button type="button" onClick={() => setConfiguring(integration)} className="wf-btn-secondary justify-center text-xs">{integration.connected || integration.enabled ? 'Editar configuração' : 'Configurar'}</button><button type="button" disabled={testing === integration.remoteKey || (integration.remoteKey === 'apify' && repairingApify)} onClick={() => void test(integration)} className="wf-btn-primary justify-center text-xs disabled:opacity-60">{testing === integration.remoteKey ? 'Validando…' : 'Testar conexão'}</button>{source && <button type="button" disabled={togglingSource === source.id || source.connectionStatus !== 'connected'} onClick={() => void toggleProspectingSource(source)} className="col-span-2 wf-btn-secondary justify-center text-xs disabled:cursor-not-allowed disabled:opacity-60" title={source.connectionStatus === 'connected' ? undefined : 'Configure e valide a conexão antes de ativar a Busca de Leads.'}><i className={togglingSource === source.id ? 'ri-loader-4-line animate-spin' : source.status === 'ativo' ? 'ri-pause-circle-line' : 'ri-play-circle-line'} />{togglingSource === source.id ? 'Salvando uso…' : source.status === 'ativo' ? 'Pausar na Busca de Leads' : 'Ativar na Busca de Leads'}</button>}{canRepairApifyActor && <button type="button" disabled={repairingApify} onClick={() => void repairApifyGoogleMapsActor(integration)} className="col-span-2 wf-btn-secondary justify-center text-xs text-primary-700 disabled:opacity-60"><i className={repairingApify ? 'ri-loader-4-line animate-spin' : 'ri-map-pin-line'} />{repairingApify ? 'Corrigindo Actor…' : 'Corrigir Actor Google Maps'}</button>}</div>
        </article>;
      })}
    </div>
    {visibleIntegrations.length === 0 && <div className="rounded-xl border border-dashed border-background-200 bg-white p-6 text-sm text-foreground-500">Nenhum conector desta categoria está disponível para esta empresa.</div>}
    {configuring && <IntegrationConfigureModal integration={configuring} onClose={() => setConfiguring(null)} onSaved={refresh} />}
  </div>;
}
