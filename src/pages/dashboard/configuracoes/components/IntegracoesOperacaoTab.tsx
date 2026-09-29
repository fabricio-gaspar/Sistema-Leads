import IntegracoesTab from './IntegracoesTab';
import WhatsAppEntriesTab from './WhatsAppEntriesTab';
import ApisProvidersTab from './ApisProvidersTab';

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
  if (section === 'channels') return <WhatsAppEntriesTab />;
  if (section === 'apis') return <ApisProvidersTab />;

  const showChannels = !section || section === 'channels';
  const showApis = !section || section === 'apis';
  const copy = section ? sectionCopy[section] : null;

  return <div className="space-y-8">
    <header>
      <p className="wf-eyebrow">{copy?.eyebrow || 'Conexões'}</p>
      <h2 className="mt-1 text-xl font-semibold text-foreground-950">{copy?.title || 'Canais, APIs e fontes'}</h2>
      <p className="mt-2 text-sm leading-6 text-foreground-500">{copy?.description || 'Configure a comunicação, os serviços de inteligência e a origem dos leads.'}</p>
    </header>

    {showChannels && <section className="wf-settings-section"><WhatsAppEntriesTab /></section>}

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
