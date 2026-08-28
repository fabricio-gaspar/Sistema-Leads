import IntegracoesTab from './IntegracoesTab';
import AmbienteTab from './AmbienteTab';

const secoes = [
  {
    id: 'modo-operacao',
    label: 'Modo de operação',
    descricao: 'Demo, Sandbox ou Real; controles de ativação e contatos de teste.',
    icone: 'ri-shield-check-line',
  },
  {
    id: 'canais-integracoes',
    label: 'Canais e conexões',
    descricao: 'WhatsApp, e-mail, agenda, IA, Instagram e VoIP, cada um com configuração e teste.',
    icone: 'ri-plug-line',
  },
];

export default function IntegracoesOperacaoTab() {
  const irPara = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="space-y-6">
      <header className="bg-background-50 border border-background-200/70 rounded-xl p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Configuração centralizada</p>
        <h2 className="mt-1 font-heading font-bold text-foreground-950 text-lg">Canais e integrações</h2>
        <p className="mt-1 text-sm text-foreground-500 max-w-3xl">
          Configure os canais da Ana, teste cada conexão e determine, no mesmo lugar, se ela opera em modo Demo, Sandbox ou Real.
        </p>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {secoes.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => irPara(item.id)}
              className="flex items-start gap-3 p-4 rounded-xl border border-background-200/70 bg-background-50 hover:bg-background-100 text-left transition-colors cursor-pointer"
            >
              <span className="w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 bg-primary-100 text-primary-700">
                <i className={item.icone}></i>
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-primary-700">Passo {index + 1}</span>
                <span className="block mt-0.5 text-sm font-semibold text-foreground-900">{item.label}</span>
                <span className="block mt-1 text-xs leading-relaxed text-foreground-500">{item.descricao}</span>
              </span>
            </button>
          ))}
        </div>
      </header>

      <section id="modo-operacao" className="scroll-mt-6">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Passo 1</p>
          <h3 className="mt-1 font-heading font-bold text-foreground-950">Modo de operação e ativação</h3>
          <p className="mt-1 text-sm text-foreground-500">Escolha Demo, Sandbox ou Real, libere cada módulo e mantenha os testes sob controle.</p>
        </div>
        <AmbienteTab />
      </section>

      <section id="canais-integracoes" className="scroll-mt-6">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Passo 2</p>
          <h3 className="mt-1 font-heading font-bold text-foreground-950">Canais e conexões</h3>
          <p className="mt-1 text-sm text-foreground-500">Configure, teste, conecte ou desconecte cada provedor. Nenhum segredo fica exposto no navegador.</p>
        </div>
        <IntegracoesTab />
      </section>
    </div>
  );
}
