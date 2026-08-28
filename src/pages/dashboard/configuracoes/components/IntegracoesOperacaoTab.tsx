import { useState } from 'react';
import IntegracoesTab from './IntegracoesTab';
import AmbienteTab from './AmbienteTab';

type Secao = 'canais' | 'operacao';

const secoes: { id: Secao; label: string; descricao: string; icone: string }[] = [
  {
    id: 'canais',
    label: 'Canais e integrações',
    descricao: 'Conecte WhatsApp, e-mail, agenda, IA e futuros canais como telefonia.',
    icone: 'ri-plug-line',
  },
  {
    id: 'operacao',
    label: 'Modo de operação',
    descricao: 'Defina Demo, Sandbox ou Real e controle o que cada módulo pode executar.',
    icone: 'ri-shield-check-line',
  },
];

export default function IntegracoesOperacaoTab() {
  const [secao, setSecao] = useState<Secao>('canais');

  return (
    <div className="space-y-6">
      <header className="bg-background-50 border border-background-200/70 rounded-xl p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Configuração centralizada</p>
        <h2 className="mt-1 font-heading font-bold text-foreground-950 text-lg">Canais e operação</h2>
        <p className="mt-1 text-sm text-foreground-500 max-w-3xl">
          Configure por onde a Ana conversa e, no mesmo lugar, determine quando o sistema pode operar em modo demo, sandbox ou real.
        </p>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {secoes.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSecao(item.id)}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                secao === item.id
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-background-200/70 bg-background-50 hover:bg-background-100'
              }`}
            >
              <span className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 ${
                secao === item.id ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-600'
              }`}>
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

      <div className="flex gap-1 p-1 bg-background-100 rounded-full overflow-x-auto w-fit max-w-full">
        {secoes.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSecao(item.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              secao === item.id
                ? 'bg-background-50 text-foreground-900 shadow-sm'
                : 'text-foreground-500 hover:text-foreground-800'
            }`}
          >
            <i className={item.icone}></i>
            {item.label}
          </button>
        ))}
      </div>

      {secao === 'canais' ? <IntegracoesTab /> : <AmbienteTab />}
    </div>
  );
}
