import { useState } from 'react';
import { apresentacao } from '@/mocks/businessData';

export default function ApresentacaoTab() {
  const [gerando, setGerando] = useState(false);
  const [aprovado, setAprovado] = useState(true);
  const [copiado, setCopiado] = useState(false);

  const regenerar = () => {
    setGerando(true);
    setTimeout(() => {
      setGerando(false);
      setCopiado(false);
    }, 2500);
  };

  const copiar = () => {
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-heading font-bold text-foreground-900">
            Apresentação da Empresa
          </h2>
          <p className="text-foreground-600 text-sm">
            Material institucional gerado pela IA para qualificar e convencer leads. Revise antes de usar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={regenerar}
            disabled={gerando}
            className="inline-flex items-center gap-2 bg-background-100 hover:bg-background-200 disabled:opacity-60 text-foreground-700 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
          >
            {gerando ? (
              <>
                <div className="w-4 h-4 border-2 border-foreground-300 border-t-foreground-600 rounded-full animate-spin"></div>
                Gerando...
              </>
            ) : (
              <>
                <i className="ri-refresh-line"></i>
                Regenerar com IA
              </>
            )}
          </button>
          <button
            onClick={copiar}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 px-5 py-2.5 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
          >
            <i className={copiado ? 'ri-check-line' : 'ri-file-copy-line'}></i>
            {copiado ? 'Copiado!' : 'Copiar tudo'}
          </button>
        </div>
      </div>

      <div className="mb-6 bg-primary-100 border border-primary-200 rounded-xl px-5 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
          <i className="ri-check-line text-background-50"></i>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-primary-800">Apresentação aprovada e em uso pela Ana</p>
          <p className="text-xs text-primary-700">Última atualização: hoje às 09:32</p>
        </div>
        <button
          onClick={() => setAprovado(!aprovado)}
          className={`w-11 h-6 rounded-full relative transition-colors ${aprovado ? 'bg-primary-500' : 'bg-background-300'}`}
        >
          <div className={`absolute top-0.5 w-5 h-5 bg-background-50 rounded-full transition-all ${aprovado ? 'left-5' : 'left-0.5'}`}></div>
        </button>
      </div>

      <div className="space-y-6">
        <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
              <i className="ri-building-2-line text-primary-600"></i>
            </div>
            <h3 className="font-heading font-bold text-foreground-900">Apresentação institucional</h3>
          </div>
          <p className="text-foreground-700 leading-relaxed text-sm">{apresentacao.institucional}</p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-accent-100 rounded-lg flex items-center justify-center">
                <i className="ri-file-list-3-line text-accent-600"></i>
              </div>
              <h3 className="font-heading font-bold text-foreground-900">Resumo dos serviços</h3>
            </div>
            <p className="text-foreground-700 text-sm leading-relaxed">{apresentacao.servicos}</p>
          </section>

          <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
                <i className="ri-gift-line text-primary-600"></i>
              </div>
              <h3 className="font-heading font-bold text-foreground-900">Benefícios</h3>
            </div>
            <ul className="space-y-2.5">
              {apresentacao.beneficios.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground-700">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-checkbox-circle-line text-primary-500"></i>
                  </div>
                  {b}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-accent-100 rounded-lg flex items-center justify-center">
              <i className="ri-trophy-line text-accent-600"></i>
            </div>
            <h3 className="font-heading font-bold text-foreground-900">Cases de sucesso</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {apresentacao.cases.map((c, i) => (
              <div key={i} className="bg-background-100 rounded-lg p-4">
                <p className="font-semibold text-foreground-900 text-sm">{c.cliente}</p>
                <p className="text-xs text-foreground-500 mb-3">{c.segmento}</p>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-line-chart-line text-primary-500"></i>
                  </div>
                  <p className="text-xs font-medium text-primary-700">{c.resultado}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-secondary-100 rounded-lg flex items-center justify-center">
              <i className="ri-chat-3-line text-secondary-700"></i>
            </div>
            <h3 className="font-heading font-bold text-foreground-900">Argumentos de venda</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {apresentacao.argumentos.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 bg-background-100 rounded-lg p-3.5">
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <i className="ri-double-quotes-l text-secondary-500"></i>
                </div>
                <p className="text-sm text-foreground-700">{a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}