import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useConversasStore } from '@/hooks/useConversasStore';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { usePropostasStore } from '@/hooks/usePropostasStore';
import UsuarioDetalhesModal from '@/pages/dashboard/equipe/components/UsuarioDetalhesModal';
import {
  calcularMetricas,
  exportarCSV,
  exportarPDF,
  fmtMoney,
  fmtDecimal,
} from '@/pages/dashboard/equipe/equipeUtils';
import type { UsuarioMetricas } from '@/pages/dashboard/equipe/equipeUtils';
import { loadTeamMembers, type TeamMember } from '@/lib/crm/teamMembersRepository';
import '../command-secondary.css';

const periodos = ['7 DIAS', '15 DIAS', 'ESTE MÊS', 'MÊS PASSADO', 'TUDO'];

export default function EquipePage() {
  const [periodoAtivo, setPeriodoAtivo] = useState('ESTE MÊS');
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<UsuarioMetricas | null>(null);
  const { conversas } = useConversasStore();
  const [leads] = useLeadsStore();
  const { propostas } = usePropostasStore();
  const [membros, setMembros] = useState<TeamMember[]>([]);
  const [teamError, setTeamError] = useState('');

  useEffect(() => {
    void loadTeamMembers()
      .then((result) => { setMembros(result); setTeamError(''); })
      .catch(() => setTeamError('Não foi possível carregar a equipe real. Métricas por usuário ficaram indisponíveis.'));
  }, []);

  const metricas = useMemo(
    () => calcularMetricas(membros, conversas, leads, propostas),
    [membros, conversas, leads, propostas]
  );

  const leadsComConversa = leads.filter((l) => conversas.some((c) => c.leadId === l.id)).length;
  const leadsSemConversa = leads.filter((l) => !conversas.some((c) => c.leadId === l.id)).length;
  const taxaConversao = (leadsComConversa / (metricas.totalConversas || 1)) * 100;

  const totalInteracoes = conversas.reduce((s, c) => s + c.mensagens.length, 0);

  return (
    <div className="wf-page wf-secondary-page wf-secondary-page--team">
      {/* Header */}
      <div className="wf-secondary-header flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="wf-secondary-eyebrow">Pessoas e resultados</p>
          <h1 className="wf-page-title">Equipe</h1>
          <p className="wf-secondary-description text-sm text-foreground-500 mt-1">
            Métricas detalhadas de performance da equipe
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={periodoAtivo}
            onChange={(e) => setPeriodoAtivo(e.target.value)}
            className="text-xs bg-background-50 border border-background-200 rounded-lg px-3 py-2 text-foreground-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            {periodos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {/* Toggle Visão Geral / Equipe */}
          <div className="flex items-center bg-background-50 border border-background-200 rounded-lg overflow-hidden">
            <Link
              to="/dashboard"
              className="px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 text-primary-700 bg-primary-100 hover:bg-primary-200/70 transition-colors"
            >
              <i className="ri-arrow-left-line text-sm"></i>
              Visão Geral
            </Link>
            <span className="px-3 py-2 text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 bg-foreground-900 text-background-50">
              <i className="ri-team-line text-sm"></i>
              Equipe
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => exportarCSV(metricas)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-background-200 bg-background-50 text-[11px] font-semibold text-foreground-700 hover:bg-background-100 cursor-pointer whitespace-nowrap transition-colors"
            >
              <i className="ri-file-download-line text-sm"></i>
              CSV
            </button>
            <button
              onClick={() => exportarPDF(metricas, periodoAtivo)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-background-200 bg-background-50 text-[11px] font-semibold text-foreground-700 hover:bg-background-100 cursor-pointer whitespace-nowrap transition-colors"
            >
              <i className="ri-file-pdf-line text-sm"></i>
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Analytics da Equipe */}
      <div className="wf-secondary-section-title">
        <h2 className="text-sm font-bold text-foreground-800">Resultados por canal e responsável</h2>
        <p className="text-[11px] text-foreground-400 mt-0.5">
          Métricas detalhadas de performance por usuário e instância
        </p>
      </div>

      {teamError && <div className="rounded-xl border border-[#BD3D32]/25 bg-[#BD3D32]/10 px-4 py-3 text-xs text-[#BD3D32]">{teamError}</div>}

      {/* Grid principal */}
      <div className="wf-secondary-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Conversas por Instância */}
        <div className="wf-secondary-panel bg-background-50 border border-background-200/70 rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground-800">Conversas por Instância</h3>
              <p className="text-[10px] text-foreground-400 uppercase tracking-wider mt-0.5">
                Distribuição por canal
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                WhatsApp
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent-500"></span>
                Instagram
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-background-100/60 rounded-lg p-3">
              <p className="text-[10px] text-foreground-400 uppercase tracking-wider">Total Conversas</p>
              <p className="text-2xl font-bold text-foreground-900 mt-1">{metricas.totalConversas}</p>
            </div>
            <div className="bg-background-100/60 rounded-lg p-3">
              <p className="text-[10px] text-foreground-400 uppercase tracking-wider">Leads Gerados</p>
              <p className="text-2xl font-bold text-foreground-900 mt-1">{metricas.totalLeads}</p>
            </div>
          </div>

          {/* Barras de canal */}
          <div className="space-y-4 mb-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-foreground-600">WhatsApp</span>
              </div>
              <div className="h-3 bg-background-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{
                    width: `${(metricas.whatsAppConversas / Math.max(metricas.totalConversas, 1)) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-foreground-600">Instagram</span>
              </div>
              <div className="h-3 bg-background-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-500 rounded-full transition-all"
                  style={{
                    width: `${(metricas.instagramConversas / Math.max(metricas.totalConversas, 1)) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                <span className="text-xs text-foreground-700">WhatsApp</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-foreground-900">{metricas.whatsAppConversas}</span>
                <span className="text-foreground-400">
                  {metricas.whatsAppConversas > 0 ? `${metricas.whatsAppConversas} ativas` : '0 ativas'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-500"></span>
                <span className="text-xs text-foreground-700">Instagram</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-foreground-900">{metricas.instagramConversas}</span>
                <span className="text-foreground-400">0 ativas</span>
              </div>
            </div>
          </div>
        </div>

        {/* Conversas por Usuário */}
        <div className="wf-secondary-panel bg-background-50 border border-background-200/70 rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground-800">Conversas por Usuário</h3>
              <p className="text-[10px] text-foreground-400 uppercase tracking-wider mt-0.5">
                Performance Individual
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-background-100 text-[11px] text-foreground-600 font-medium">
              Total: {metricas.totalConversas}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-primary-50 text-[11px] text-primary-700 font-medium">
              Ativas: {conversas.filter((c) => c.status === 'ativo').length}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-accent-50 text-[11px] text-accent-700 font-medium">
              Resolvidas: {conversas.filter((c) => c.status === 'resolvido').length}
            </span>
          </div>

          <div className="space-y-3">
            {metricas.usuarios.map((u) => (
              <button
                key={u.id}
                onClick={() => setUsuarioSelecionado(u)}
                className="w-full flex items-center gap-3 p-3 bg-background-100/40 rounded-lg hover:bg-background-100 cursor-pointer text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {u.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground-800 truncate">{u.nome}</p>
                    <p className="text-xs font-bold text-foreground-700">{u.conversas}</p>
                  </div>
                  <p className="text-[10px] text-foreground-400">
                    {u.conversasAtivas} ativas · {u.conversasResolvidas} resolvidas
                  </p>
                </div>
                <i className="ri-arrow-right-s-line text-foreground-400 text-base"></i>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid inferior */}
      <div className="wf-secondary-grid grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tempo de Resposta */}
        <div className="wf-secondary-panel bg-background-50 border border-background-200/70 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground-800">Tempo de Resposta</h3>
            <p className="text-[10px] text-foreground-400 uppercase tracking-wider mt-0.5">
              Métricas de Agilidade
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-accent-50/60 rounded-lg p-3 text-center">
              <p className="text-[9px] text-accent-700 uppercase tracking-wider font-medium">Média Resposta</p>
              <p className="text-lg font-bold text-accent-600 mt-1">0,0</p>
              <p className="text-[9px] text-accent-500">min</p>
            </div>
            <div className="bg-primary-50/60 rounded-lg p-3 text-center">
              <p className="text-[9px] text-primary-700 uppercase tracking-wider font-medium">Interação</p>
              <p className="text-lg font-bold text-primary-600 mt-1">0,0</p>
              <p className="text-[9px] text-primary-500">min médio</p>
            </div>
            <div className="bg-primary-50 rounded-lg p-3 text-center">
              <p className="text-[9px] text-primary-700 uppercase tracking-wider font-medium">Interações</p>
              <p className="text-lg font-bold text-primary-600 mt-1">{totalInteracoes}</p>
              <p className="text-[9px] text-primary-500">total</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#E3E7ED] bg-[#F7F8FA] p-4 text-xs text-[#69717D]">
            Distribuição por hora e tempo médio não são exibidos até que o sistema tenha timestamps suficientes para calcular essas métricas sem estimativas.
          </div>
        </div>

        {/* Conversas → Leads */}
        <div className="wf-secondary-panel bg-background-50 border border-background-200/70 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground-800">Conversas → Leads</h3>
            <p className="text-[10px] text-foreground-400 uppercase tracking-wider mt-0.5">
              Taxa de Conversão por Usuário
            </p>
          </div>

          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground-600">Com Lead</span>
              <span className="text-sm font-bold text-foreground-900">{leadsComConversa}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground-600">Sem Lead</span>
              <span className="text-sm font-bold text-foreground-900">{leadsSemConversa}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-background-100">
              <span className="text-xs text-foreground-600 font-medium">Total</span>
              <span className="text-sm font-bold text-foreground-900">{metricas.totalLeads}</span>
            </div>
          </div>

          <div className="text-center mb-5">
            <p className="text-2xl font-bold text-foreground-900">{fmtDecimal(taxaConversao)}%</p>
            <p className="text-[10px] text-foreground-400">conversão</p>
          </div>

          <div>
            <p className="text-[10px] text-foreground-400 uppercase tracking-wider mb-2">
              Top Conversores
            </p>
            <div className="space-y-2">
              {metricas.usuarios
                .filter((u) => u.leads > 0)
                .sort((a, b) => b.leadsComConversa - a.leadsComConversa)
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setUsuarioSelecionado(u)}
                    className="w-full flex items-center gap-3 cursor-pointer text-left hover:opacity-80 transition-opacity"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {u.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground-700 truncate">{u.nome}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-foreground-500">
                        {((u.leadsComConversa / Math.max(u.leads, 1)) * 100).toFixed(1).replace('.', ',')}%
                      </span>
                      <span className="text-[11px] font-bold text-foreground-700 w-5 text-right">
                        {u.leadsComConversa}
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Performance de Orçamentos */}
        <div className="wf-secondary-panel bg-background-50 border border-background-200/70 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground-800">Performance de Orçamentos</h3>
            <p className="text-[10px] text-foreground-400 uppercase tracking-wider mt-0.5">
              Valor por Usuário
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="bg-primary-50 rounded-lg p-3 text-center">
              <p className="text-[9px] text-primary-700 uppercase tracking-wider font-medium">Valor orçado</p>
              <p className="text-base font-bold text-primary-600 mt-1">{fmtMoney(metricas.totalValorOrcado)}</p>
            </div>
            <div className="bg-background-100/60 rounded-lg p-3 text-center">
              <p className="text-[9px] text-foreground-500 uppercase tracking-wider font-medium">Orçamentos aceitos</p>
              <p className="text-base font-bold text-foreground-800 mt-1">{metricas.totalOrcamentosAceitos}</p>
            </div>
            <div className="bg-background-100/60 rounded-lg p-3 text-center">
              <p className="text-[9px] text-foreground-500 uppercase tracking-wider font-medium">Valor médio orçado</p>
              <p className="text-base font-bold text-foreground-800 mt-1">{fmtMoney(metricas.valorMedioOrcado)}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-foreground-400 uppercase tracking-wider mb-2">
              Distribuição por responsável
            </p>
            <div className="space-y-3">
              {metricas.usuarios
                .filter((u) => u.valorOrcado > 0 || u.orcamentosAceitos > 0)
                .sort((a, b) => b.valorOrcado - a.valorOrcado)
                .map((u, idx) => (
                  <button
                    key={u.id}
                    onClick={() => setUsuarioSelecionado(u)}
                    className="w-full flex items-center gap-3 p-2.5 bg-background-100/40 rounded-lg hover:bg-background-100 cursor-pointer text-left transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {u.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground-800 truncate">{u.nome}</p>
                      <p className="text-[10px] text-foreground-400">
                        {u.orcamentosAceitos} orçamentos aceitos ·{' '}
                        {((u.orcamentosAceitos / Math.max(metricas.totalOrcamentosAceitos, 1)) * 100).toFixed(0)}% do total
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground-900">{fmtMoney(u.valorOrcado)}</p>
                      <p className="text-[9px] text-foreground-400">
                        ≈ R${' '}
                        {(u.valorOrcado / Math.max(u.orcamentosAceitos, 1)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}{' '}
                        por orçamento
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de detalhes */}
      {usuarioSelecionado && (
        <UsuarioDetalhesModal
          usuario={usuarioSelecionado}
          onClose={() => setUsuarioSelecionado(null)}
        />
      )}
    </div>
  );
}
