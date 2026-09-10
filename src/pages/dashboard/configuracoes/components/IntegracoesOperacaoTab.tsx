import IntegracoesTab from './IntegracoesTab';
import FontesTab from './FontesTab';

const configurationMap = [
  {
    label: 'Canais',
    title: 'Entrada e saída de conversas',
    description: 'Configure o WhatsApp pela Z-API. Esta área controla a Central e a comunicação da Ana.',
    icon: 'ri-message-3-line',
  },
  {
    label: 'APIs',
    title: 'Serviços usados pelo sistema',
    description: 'Conecte a IA da Ana e os provedores que pesquisam empresas e contatos.',
    icon: 'ri-code-s-slash-line',
  },
  {
    label: 'Fontes',
    title: 'Origem dos novos leads',
    description: 'Depois de validar uma API de prospecção, escolha se ela ficará ativa na Busca de Leads.',
    icon: 'ri-radar-line',
  },
];

function SectionHeading({ number, eyebrow, title, description }: { number: string; eyebrow: string; title: string; description: string }) {
  return <div className="mb-4 flex items-start gap-3">
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">{number}</span>
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-primary-700">{eyebrow}</p>
      <h3 className="mt-1 text-lg font-semibold text-foreground-950">{title}</h3>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-foreground-500">{description}</p>
    </div>
  </div>;
}

export default function IntegracoesOperacaoTab() {
  return <div className="space-y-8">
    <header className="wf-surface overflow-hidden">
      <div className="border-b border-background-200 px-5 py-5 md:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-primary-700">Canais, APIs e fontes</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground-950">O que cada conexão configura</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-500">Cada bloco abaixo possui uma responsabilidade única. Credenciais ficam no cofre do backend; estado ativo só aparece após validação real.</p>
      </div>
      <div className="grid divide-y divide-background-200 md:grid-cols-3 md:divide-x md:divide-y-0">
        {configurationMap.map((item) => <article key={item.label} className="p-5">
          <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><i className={`${item.icon} text-base`} /></span><span className="text-[11px] font-semibold uppercase tracking-[.12em] text-primary-700">{item.label}</span></div>
          <h3 className="mt-3 text-sm font-semibold text-foreground-950">{item.title}</h3>
          <p className="mt-1 text-xs leading-5 text-foreground-500">{item.description}</p>
        </article>)}
      </div>
    </header>

    <section className="wf-settings-section">
      <SectionHeading number="1" eyebrow="Canais" title="WhatsApp e atendimento" description="Aqui ficam a instância Z-API, o teste de envio e a validação do canal. Esse teste não é repetido em nenhum outro módulo." />
      <IntegracoesTab category="communication" />
    </section>

    <section className="wf-settings-section">
      <SectionHeading number="2" eyebrow="APIs" title="Inteligência e prospecção" description="APIs são serviços externos consumidos pelo backend. A IA responde pela Ana; Apify e Google Places abastecem a pesquisa de leads." />
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
      <SectionHeading number="3" eyebrow="Fontes" title="Fontes da Busca de Leads" description="Depois que a API estiver validada, defina quais origens realmente podem criar oportunidades na Busca de Leads." />
      <FontesTab />
    </section>
  </div>;
}
