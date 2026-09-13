import IntegracoesTab from './IntegracoesTab';
import FontesTab from './FontesTab';

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

export default function IntegracoesOperacaoTab() {
  return <div className="space-y-8">
    <header>
      <p className="wf-eyebrow">Conexões</p>
      <h2 className="mt-1 text-xl font-semibold text-foreground-950">Canais, APIs e fontes</h2>
      <p className="mt-2 text-sm leading-6 text-foreground-500">Configure a comunicação, os serviços de inteligência e a origem dos leads.</p>
    </header>

    <section className="wf-settings-section">
      <SectionHeading icon="ri-message-3-line" eyebrow="Canais" title="WhatsApp e atendimento" description="Instância Z-API, conexão do WhatsApp e teste de envio para a Central e a Ana." />
      <IntegracoesTab category="communication" />
    </section>

    <section className="wf-settings-section">
      <SectionHeading icon="ri-code-s-slash-line" eyebrow="APIs" title="Inteligência e prospecção" description="Provedor de IA para a Ana e serviços de pesquisa de empresas e contatos." />
      <div className="space-y-7">
        <div>
          <div className="mb-3 rounded-xl border border-background-200 bg-background-100 px-4 py-3">
            <h4 className="text-sm font-semibold text-foreground-900">IA da Ana</h4>
            <p className="mt-1 text-xs leading-5 text-foreground-500">Configura o provedor que interpreta mensagens e prepara respostas. Não altera o canal do WhatsApp.</p>
          </div>
          <IntegracoesTab category="intelligence" />
        </div>
        <div>
          <div className="mb-3 rounded-xl border border-background-200 bg-background-100 px-4 py-3">
            <h4 className="text-sm font-semibold text-foreground-900">APIs para encontrar leads</h4>
            <p className="mt-1 text-xs leading-5 text-foreground-500">Configura as credenciais e valida a conexão. Ativar ou pausar a fonte acontece no próximo bloco.</p>
          </div>
          <IntegracoesTab category="prospecting" />
        </div>
      </div>
    </section>

    <section className="wf-settings-section">
      <SectionHeading icon="ri-radar-line" eyebrow="Fontes" title="Fontes da Busca de Leads" description="Depois que a API estiver validada, defina quais origens realmente podem criar oportunidades na Busca de Leads." />
      <FontesTab />
    </section>
  </div>;
}
