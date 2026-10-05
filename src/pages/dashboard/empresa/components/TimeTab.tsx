import { useState } from 'react';
import { equipe } from '@/mocks/businessData';

const statusCor: Record<string, string> = {
  ativo: 'bg-secondary-100 text-secondary-700',
  inativo: 'bg-background-200 text-foreground-600',
};

export default function TimeTab() {
  const [membros] = useState(equipe);
  const [toast, setToast] = useState('');

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
            <i className="ri-team-line text-primary-600"></i>
          </div>
          <div>
            <h3 className="font-heading font-bold text-foreground-900">Time e responsáveis</h3>
            <p className="text-sm text-foreground-500">Quem recebe o lead quando a Ana transfere a conversa.</p>
          </div>
        </div>

        <div className="mt-4 bg-primary-100/50 border border-primary-200 rounded-lg p-4 mb-5">
          <p className="flex items-start gap-2 text-sm text-foreground-700">
            <i className="ri-lightbulb-line text-primary-600 mt-0.5"></i>
            <span>
              Cada cargo abaixo define para onde a Ana encaminha cada tipo de situação: o <strong>Vendedor</strong> recebe leads
              quentes, o <strong>Gestor Comercial</strong> recebe negociações e o <strong>CX</strong> recebe suporte e reclamações.
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {membros.map((m) => (
            <div key={m.id} className="bg-background-100/50 border border-background-200/70 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-background-50 dark:text-foreground-950 font-heading font-bold text-base">{m.avatar}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground-900 text-sm truncate">{m.nome}</p>
                  <p className="text-xs text-foreground-500">{m.cargo}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="text-foreground-700 flex items-center gap-2">
                  <i className="ri-mail-line text-foreground-400"></i>
                  {m.email}
                </p>
                <p className="text-foreground-700 flex items-center gap-2">
                  <i className="ri-building-line text-foreground-400"></i>
                  {m.departamento}
                </p>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${statusCor[m.status]}`}>{m.status}</span>
                <button
                  onClick={() => mostrarToast(`Definir responsabilidades de ${m.nome}`)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-settings-3-line"></i>
                  Configurar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-accent-100 rounded-lg flex items-center justify-center">
            <i className="ri-shuffle-line text-accent-600"></i>
          </div>
          <div>
            <h3 className="font-heading font-bold text-foreground-900">Regras de encaminhamento</h3>
            <p className="text-sm text-foreground-500">Para onde a Ana direciona cada tipo de lead.</p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { tipo: 'Lead quente (score alto)', destino: 'Vendedor', icone: 'ri-fire-line' },
            { tipo: 'Pedido de desconto ou negociação', destino: 'Gestor Comercial', icone: 'ri-percent-line' },
            { tipo: 'Reclamação ou suporte', destino: 'CX', icone: 'ri-customer-service-line' },
            { tipo: 'Agendamento de reunião', destino: 'Vendedor', icone: 'ri-calendar-check-line' },
          ].map((r) => (
            <div key={r.tipo} className="flex items-center gap-3 bg-background-100/50 border border-background-200/70 rounded-lg p-3">
              <div className="w-9 h-9 bg-secondary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className={`${r.icone} text-secondary-700`}></i>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground-900">{r.tipo}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm text-foreground-600">
                <i className="ri-arrow-right-line"></i>
                <span className="font-medium text-foreground-900">{r.destino}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}