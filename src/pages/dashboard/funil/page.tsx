import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { etapasCRM } from '@/mocks/leadsData';
import { periodoDesde, dentroDoPeriodo } from '@/lib/periodo';
import { stageFromLegacy } from '@/domain/pipeline';

const etapaCores: Record<string, string> = {
  'Novo': 'bg-background-200',
  'Apresentado': 'bg-primary-500/40',
  'Qualificando': 'bg-primary-500/60',
  'Reunião': 'bg-primary-500/70',
  'Orçamento': 'bg-primary-500',
  'Ganho': 'bg-secondary-500',
  'Perdido': 'bg-background-300',
};

const etapaTextos: Record<string, string> = {
  'Novo': 'text-foreground-700',
  'Apresentado': 'text-background-50',
  'Qualificando': 'text-background-50',
  'Reunião': 'text-background-50',
  'Orçamento': 'text-background-50',
  'Ganho': 'text-background-50',
  'Perdido': 'text-foreground-500',
};

export default function FunilConversao() {
  const [periodo, setPeriodo] = useState('Últimos 30 dias');
  const [leadsBrutos] = useLeadsStore();
  const navigate = useNavigate();
  // Leads aguardando aprovação (Busca/CSV) ficam fora do funil até serem aprovados.
  const leadsSemAprovacao = leadsBrutos.filter((l) => !l.aguardandoAtivacao);
  const refDate = new Date().toISOString().slice(0, 10);
  const desde = periodoDesde(periodo, refDate);
  const leads = leadsSemAprovacao.filter((l) => dentroDoPeriodo(l.criadoEm, desde));

  const dados = etapasCRM.map((etapa) => {
    const stageCode = stageFromLegacy(etapa);
    const lista = leads.filter((lead) => stageFromLegacy(lead.etapa) === stageCode);
    const quantidade = lista.length;
    const taxa = leads.length > 0 ? (quantidade / leads.length) * 100 : 0;
    return { etapa, quantidade, taxa: isNaN(taxa) ? 0 : taxa };
  });

  const maxQtd = Math.max(...dados.map((d) => d.quantidade), 1);
  const totalLeads = leads.length;
  const emPipeline = leads.filter((lead) => !['won', 'lost'].includes(stageFromLegacy(lead.etapa))).length;
  const fechados = leads.filter((lead) => stageFromLegacy(lead.etapa) === 'won').length;
  const taxaConversao = totalLeads > 0 ? ((fechados / totalLeads) * 100).toFixed(1) : '0.0';

  return (
    <div className="wf-page !max-w-6xl">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-2">
            Funil de Conversão
          </h1>
          <p className="text-foreground-600 text-sm">
            Distribuição atual da carteira por etapa. Conversão histórica aparece somente quando houver eventos auditados suficientes.
          </p>
        </div>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-700 cursor-pointer"
        >
          <option>Últimos 7 dias</option>
          <option>Últimos 30 dias</option>
          <option>Últimos 90 dias</option>
          <option>Este ano</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Total de leads',
            value: String(totalLeads),
            icon: 'ri-user-search-line',
            color: 'bg-primary-100 text-primary-600',
          },
          {
            label: 'Fechados',
            value: String(fechados),
            icon: 'ri-trophy-line',
            color: 'bg-secondary-100 text-secondary-600',
          },
          {
            label: 'Taxa de conversão',
            value: `${taxaConversao}%`,
            icon: 'ri-percent-line',
            color: 'bg-accent-100 text-accent-600',
          },
          {
            label: 'Em pipeline',
            value: String(emPipeline),
            icon: 'ri-flow-chart',
            color: 'bg-primary-500/20 text-primary-600',
          },
        ].map((kpi, i) => (
          <div key={i} className="bg-background-50 border border-background-200/70 rounded-xl p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${kpi.color}`}>
              <i className={`${kpi.icon} text-lg`}></i>
            </div>
            <p className="text-2xl font-heading font-extrabold text-foreground-950">{kpi.value}</p>
            <p className="text-foreground-500 text-sm mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Funil Visual */}
      <div className="bg-background-50 border border-background-200/70 rounded-xl p-6 md:p-8 mb-8">
          <h3 className="font-heading font-bold text-foreground-900 text-sm mb-6">
          Distribuição atual por etapa
        </h3>
        <div className="space-y-4 max-w-xl mx-auto">
          {dados.map((d) => {
            const widthPct = (d.quantidade / maxQtd) * 100;
            return (
              <button key={d.etapa} type="button" onClick={() => navigate(`/dashboard/leads?etapa=${encodeURIComponent(d.etapa)}`)} className="flex w-full items-center gap-4 text-left">
                <span className="text-sm font-medium text-foreground-700 w-28 text-right flex-shrink-0">
                  {d.etapa}
                </span>
                <div className="flex-1">
                  <div className="h-10 bg-background-100 rounded-lg overflow-hidden relative">
                    <div
                      className={`absolute inset-y-0 left-0 ${etapaCores[d.etapa]} rounded-lg transition-all flex items-center px-3`}
                      style={{ width: `${widthPct}%` }}
                    >
                      <span className={`text-sm font-bold ${etapaTextos[d.etapa]}`}>
                        {d.quantidade}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="w-24 flex-shrink-0 text-right">
                  <p className="text-xs text-foreground-500">
                    {d.taxa.toFixed(1)}% da carteira
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Leitura atual e temperatura; não infere perdas sem histórico. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-background-50 border border-background-200/70 rounded-xl p-6">
          <h3 className="font-heading font-bold text-foreground-900 text-sm mb-4">
            Concentração atual
          </h3>
          <div className="space-y-4">
            {dados.slice(0, -1).map((d, i) => {
              const prox = dados[i + 1];
              const diferenca = d.quantidade - prox.quantidade;
              const diferencaPct = d.quantidade > 0 ? ((Math.max(diferenca, 0) / d.quantidade) * 100).toFixed(1) : '0.0';
              return (
                <div key={d.etapa} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground-800">
                      {d.etapa} &gt; {prox.etapa}
                    </p>
                    <p className="text-xs text-foreground-500">
                      Diferença de distribuição atual: {Math.max(diferenca, 0)} lead(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-background-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-500 rounded-full"
                        style={{ width: `${Math.min(Number(diferencaPct), 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-accent-600 w-12 text-right">
                      {diferencaPct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-background-50 border border-background-200/70 rounded-xl p-6">
          <h3 className="font-heading font-bold text-foreground-900 text-sm mb-4">
            Temperatura por etapa
          </h3>
          <div className="space-y-3">
            {etapasCRM.map((etapa) => {
              const lista = leads.filter((lead) => stageFromLegacy(lead.etapa) === stageFromLegacy(etapa));
              const quentes = lista.filter((l) => l.temperatura === 'Quente').length;
              const mornos = lista.filter((l) => l.temperatura === 'Morno').length;
              const frios = lista.filter((l) => l.temperatura === 'Frio').length;
              const total = lista.length || 1;
              return (
                <div key={etapa}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-foreground-700">{etapa}</span>
                    <span className="text-xs text-foreground-500">{lista.length} leads</span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-background-100">
                    <div
                      className="bg-accent-500"
                      style={{ width: `${(quentes / total) * 100}%` }}
                    ></div>
                    <div
                      className="bg-primary-400"
                      style={{ width: `${(mornos / total) * 100}%` }}
                    ></div>
                    <div
                      className="bg-background-300"
                      style={{ width: `${(frios / total) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-foreground-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-500 inline-block mr-1"></span>
                      {quentes} Quente
                    </span>
                    <span className="text-[10px] text-foreground-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-400 inline-block mr-1"></span>
                      {mornos} Morno
                    </span>
                    <span className="text-[10px] text-foreground-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-background-300 inline-block mr-1"></span>
                      {frios} Frio
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
