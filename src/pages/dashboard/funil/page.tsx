import { useState } from 'react';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { etapasCRM } from '@/mocks/leadsData';
import { periodoDesde, maxDataString, dentroDoPeriodo } from '@/lib/periodo';
import LeadBaseManager from '../leads/components/LeadBaseManager';

const etapaCores: Record<string, string> = {
  'Novo': 'bg-background-200',
  'Em Contato': 'bg-primary-500/40',
  'Aguardando Resposta': 'bg-primary-500/50',
  'Em Qualificação': 'bg-primary-500/60',
  'Reunião Agendada': 'bg-primary-500/65',
  'Proposta em Preparação': 'bg-primary-500/70',
  'Orçamento Enviado': 'bg-primary-500/80',
  'Negociação': 'bg-primary-500',
  'Fechado — Ganho': 'bg-secondary-500',
  'Fechado — Perdido': 'bg-background-300',
  'Pausado': 'bg-background-200',
};

const etapaTextos: Record<string, string> = {
  'Novo': 'text-foreground-700',
  'Em Contato': 'text-background-50',
  'Aguardando Resposta': 'text-background-50',
  'Em Qualificação': 'text-background-50',
  'Reunião Agendada': 'text-background-50',
  'Proposta em Preparação': 'text-background-50',
  'Orçamento Enviado': 'text-background-50',
  'Negociação': 'text-background-50',
  'Fechado — Ganho': 'text-background-50',
  'Fechado — Perdido': 'text-foreground-500',
  'Pausado': 'text-foreground-500',
};

export default function FunilConversao() {
  const [periodo, setPeriodo] = useState('Últimos 30 dias');
  const [leadsBrutos] = useLeadsStore();
  // Leads aguardando aprovação (Busca/CSV) ficam fora do funil até serem aprovados.
  const leadsSemAprovacao = leadsBrutos.filter((l) => !l.aguardandoAtivacao);
  const refDate = maxDataString(leadsSemAprovacao.map((l) => l.criadoEm));
  const desde = periodoDesde(periodo, refDate);
  const leads = leadsSemAprovacao.filter((l) => dentroDoPeriodo(l.criadoEm, desde));

  const dados = etapasCRM.map((etapa) => {
    const lista = leads.filter((l) => l.etapa === etapa);
    const quantidade = lista.length;
    const totalInicial = leads.filter((l) => l.etapa === etapasCRM[0]).length;
    const taxa =
      etapasCRM.indexOf(etapa) === 0
        ? 100
        : totalInicial > 0
          ? (quantidade / totalInicial) * 100
          : 0;
    return { etapa, quantidade, taxa: isNaN(taxa) ? 0 : taxa };
  });

  const maxQtd = Math.max(...dados.map((d) => d.quantidade), 1);
  const totalLeads = leads.length;
  const emPipeline = leads.filter((l) => l.etapa !== 'Fechado — Ganho' && l.etapa !== 'Fechado — Perdido').length;
  const fechados = leads.filter((l) => l.etapa === 'Fechado — Ganho').length;
  const taxaConversao = totalLeads > 0 ? ((fechados / totalLeads) * 100).toFixed(1) : '0.0';

  return (
    <div className="wf-page !max-w-6xl">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-2">
            Funil de Conversão
          </h1>
          <p className="text-foreground-600 text-sm">
            Visualize a evolução dos leads por etapa e identifique gargalos no funil.
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
          Leads por etapa
        </h3>
        <div className="space-y-4 max-w-xl mx-auto">
          {dados.map((d) => {
            const widthPct = (d.quantidade / maxQtd) * 100;
            return (
              <div key={d.etapa} className="flex items-center gap-4">
                <span className="text-sm font-medium text-foreground-700 w-28 text-right flex-shrink-0">
                  {d.etapa}
                </span>
                <div className="flex-1">
                  <div className="h-10 bg-background-100 rounded-lg overflow-hidden relative">
                    <div
                      className={`absolute inset-y-0 left-0 ${etapaCores[d.etapa]} rounded-lg transition-all flex items-center px-3`}
                      style={{ width: `${Math.max(widthPct, 8)}%` }}
                    >
                      <span className={`text-sm font-bold ${etapaTextos[d.etapa]}`}>
                        {d.quantidade}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="w-24 flex-shrink-0 text-right">
                  <p className="text-xs text-foreground-500">
                    {d.taxa.toFixed(1)}% da base
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Análise de gargalos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-background-50 border border-background-200/70 rounded-xl p-6">
          <h3 className="font-heading font-bold text-foreground-900 text-sm mb-4">
            Gargalos do funil
          </h3>
          <div className="space-y-4">
            {dados.slice(0, -1).map((d, i) => {
              const prox = dados[i + 1];
              const perda = d.quantidade - prox.quantidade;
              const perdaPct = d.quantidade > 0 ? ((perda / d.quantidade) * 100).toFixed(1) : '0.0';
              return (
                <div key={d.etapa} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground-800">
                      {d.etapa} &gt; {prox.etapa}
                    </p>
                    <p className="text-xs text-foreground-500">
                      {perda} leads perdidos
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-background-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-500 rounded-full"
                        style={{ width: `${Math.min(Number(perdaPct), 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-accent-600 w-12 text-right">
                      {perdaPct}%
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
              const lista = leads.filter((l) => l.etapa === etapa);
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

      <div className="mt-8">
        <LeadBaseManager />
      </div>
    </div>
  );
}
