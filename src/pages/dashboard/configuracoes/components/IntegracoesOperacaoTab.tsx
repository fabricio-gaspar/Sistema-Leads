import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import IntegracoesTab from './IntegracoesTab';
import WhatsAppSiteEntry from './WhatsAppSiteEntry';
import WhatsappAccountPanel from '@/components/feature/WhatsappAccountPanel';
import WhatsappProviderControlPanel from '@/components/feature/WhatsappProviderControlPanel';
import { loadOperationalStatus, type OperationalStatus } from '@/lib/crm/operationalDiagnosticsRepository';
import { operationalIcon, operationalIconTone, presentIntegrationStatus } from '@/lib/crm/operationalStatusPresentation';

const inboundStatusClass = {
  positive: 'bg-[#168654]/10 text-[#116B43]',
  attention: 'bg-[#BC8B42]/10 text-[#8C651D]',
  critical: 'bg-[#BD3D32]/10 text-[#A52F27]',
  neutral: 'bg-background-100 text-foreground-600',
} as const;

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Ainda não recebido';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'Data indisponível';
}

function WhatsAppInboundStatus() {
  const [status, setStatus] = useState<OperationalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setStatus(await loadOperationalStatus());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const webhook = status?.integrations.find((item) => item.key === 'zapi_webhook');
  const zapi = status?.integrations.find((item) => item.key === 'whatsapp_zapi');
  const presentation = webhook
    ? zapi?.enabled === false
      ? presentIntegrationStatus(zapi)
      : presentIntegrationStatus(webhook)
    : { label: loading ? 'Consultando' : 'Não configurada', tone: 'neutral' as const };
  const detail = error
    ? 'Não foi possível consultar o estado de entrada agora. Nenhuma configuração foi modificada.'
    : zapi?.enabled === false
      ? zapi.detail || 'A Z-API está desativada no WayFlex.'
      : status?.webhookDiagnostic.detail || 'Aguardando o diagnóstico do callback da Z-API.';

  return <section className="mt-5 rounded-xl border border-background-200 bg-gradient-to-br from-white to-[#F7F9FC] p-5 shadow-[0_10px_24px_rgba(29,29,31,0.035)]">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${operationalIconTone('zapi_webhook')}`}><i className={operationalIcon('zapi_webhook')} aria-hidden="true" /></span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-700">Entrada WhatsApp</p>
          <h4 className="mt-1 text-base font-semibold text-foreground-950">Recebimento pela Z-API</h4>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-foreground-500">Mostra se a Z-API já entregou callbacks ao Wayflex. Este cartão não testa, recadastra nem envia mensagens.</p>
        </div>
      </div>
      <span className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${inboundStatusClass[presentation.tone]}`}>{presentation.label}</span>
    </div>
    <p className="mt-4 rounded-xl border border-background-200/80 bg-white/80 px-3.5 py-3 text-sm leading-6 text-foreground-700">{detail}</p>
    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
      <div className="rounded-xl border border-background-200/80 bg-white/70 px-3.5 py-3"><dt className="text-xs text-foreground-500">Entrada cadastrada</dt><dd className="mt-1 font-semibold text-foreground-900">{formatDate(status?.webhookDiagnostic.registeredAt)}</dd></div>
      <div className="rounded-xl border border-background-200/80 bg-white/70 px-3.5 py-3"><dt className="text-xs text-foreground-500">Último callback</dt><dd className="mt-1 font-semibold text-foreground-900">{formatDate(status?.webhookDiagnostic.lastEventAt)}</dd></div>
    </dl>
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
      <Link to="/dashboard/configuracoes?tab=operacao&setup=whatsapp-webhook" className="wf-btn-secondary text-xs"><i className="ri-pulse-line" />Abrir diagnóstico</Link>
      <button type="button" className="wf-btn-secondary text-xs disabled:opacity-60" disabled={loading} onClick={() => void refresh()}><i className={loading ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} />{loading ? 'Atualizando…' : 'Atualizar status'}</button>
    </div>
  </section>;
}

function SectionHeading({ icon, eyebrow, title, description }: { icon: string; eyebrow: string; title: string; description: string }) {
  return <div className="mb-4 flex items-start gap-3">
    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><i className={icon} aria-hidden="true" /></span>
    <div>
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-700">{eyebrow}</p>
      <h3 className="mt-1 text-lg font-semibold text-foreground-950">{title}</h3>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-foreground-500">{description}</p>
    </div>
  </div>;
}

export type IntegrationOperationSection = 'channels' | 'apis';

const sectionCopy: Record<IntegrationOperationSection, { eyebrow: string; title: string; description: string }> = {
  channels: {
    eyebrow: 'Canais',
    title: 'Canais de atendimento',
    description: 'Configure a comunicação que conversa com leads e alimenta a Central de Atendimento.',
  },
  apis: {
    eyebrow: 'APIs',
    title: 'IA e provedores de busca',
    description: 'Configure, valide e libere os provedores que a Ana e a Busca de Leads usam no servidor.',
  },
};

export default function IntegracoesOperacaoTab({ section }: { section?: IntegrationOperationSection }) {
  const showChannels = !section || section === 'channels';
  const showApis = !section || section === 'apis';
  const copy = section ? sectionCopy[section] : null;

  return <div className="space-y-8">
    <header>
      <p className="wf-eyebrow">{copy?.eyebrow || 'Conexões'}</p>
      <h2 className="mt-1 text-xl font-semibold text-foreground-950">{copy?.title || 'Canais, APIs e fontes'}</h2>
      <p className="mt-2 text-sm leading-6 text-foreground-500">{copy?.description || 'Configure a comunicação, os serviços de inteligência e a origem dos leads.'}</p>
    </header>

    {showChannels && <section className="wf-settings-section">
      <SectionHeading icon="ri-message-3-line" eyebrow="Canais" title="WhatsApp e atendimento" description="Escolha o provedor corporativo, configure-o no próprio cartão e acompanhe o estado operacional real." />
      <WhatsappProviderControlPanel />
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div id="zapi-configuration" className="scroll-mt-24 rounded-2xl border border-background-200 bg-background-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#128C3E]">Z-API</p>
          <p className="mt-1 text-sm text-foreground-600">Credenciais protegidas, validação da instância e teste de saída controlado.</p>
          <div className="mt-4"><IntegracoesTab category="communication" /></div>
        </div>
        <div id="meta-connection" className="scroll-mt-24 rounded-2xl border border-background-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#0866ff]">Meta WhatsApp Cloud API</p>
          <p className="mt-1 text-sm text-foreground-600">Conexão oficial pela Meta. A ativação só aparece depois que a conta estiver conectada.</p>
          <div className="mt-4"><WhatsappAccountPanel mode="meta" /></div>
        </div>
      </div>
      <WhatsAppInboundStatus />
      <WhatsAppSiteEntry />
    </section>}

    {showApis && <section className="wf-settings-section">
      <SectionHeading icon="ri-code-s-slash-line" eyebrow="APIs" title="Inteligência e prospecção" description="Provedor de IA para a Ana e serviços de pesquisa de empresas e contatos." />
      <div className="space-y-7">
        <div id="ai-configuration" className="scroll-mt-24">
          <div className="mb-3 rounded-xl border border-background-200 bg-background-100 px-4 py-3">
            <h4 className="text-sm font-semibold text-foreground-900">IA da Ana</h4>
            <p className="mt-1 text-xs leading-5 text-foreground-500">Configura o provedor que interpreta mensagens e prepara respostas. Não altera o canal do WhatsApp.</p>
          </div>
          <IntegracoesTab category="intelligence" />
        </div>
        <div id="prospecting-providers" className="scroll-mt-24">
          <div className="mb-3 rounded-xl border border-background-200 bg-background-100 px-4 py-3">
            <h4 className="text-sm font-semibold text-foreground-900">Provedores da Busca de Leads</h4>
            <p className="mt-1 text-xs leading-5 text-foreground-500">Configure a credencial, teste a conexão e ative ou pause o uso de cada provedor na Busca de Leads aqui.</p>
          </div>
          <IntegracoesTab category="prospecting" />
        </div>
      </div>
    </section>}
  </div>;
}
