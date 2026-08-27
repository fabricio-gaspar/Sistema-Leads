import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { useConversasStore } from '@/hooks/useConversasStore';
import { usePropostasStore } from '@/hooks/usePropostasStore';
import { useVendasStore } from '@/hooks/useVendasStore';
import { useFluxoComercial } from '@/hooks/useFluxoComercial';
import { periodoDesde, maxDataString, dentroDoPeriodo } from '@/lib/periodo';
import { proposalForSale } from '@/lib/reporting';
import SaudeWhatsappCard from '@/components/feature/SaudeWhatsappCard';
import IntegracoesStatus from '@/pages/dashboard/components/IntegracoesStatus';
import CentralPendencias from '@/pages/dashboard/components/CentralPendencias';
import TelemetriaAna from '@/pages/dashboard/components/TelemetriaAna';
import AtividadeRecente from '@/pages/dashboard/components/AtividadeRecente';
import FilaTarefas from '@/pages/dashboard/components/FilaTarefas';

function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtInt(v: number) {
  return v.toLocaleString('pt-BR');
}

function fmtMoneyK(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function FunnelChart({ conversas: c, leads: l, vendas: v }: { conversas: number; leads: number; vendas: number }) {
  const total = Math.max(c, 1);
  const degraus = [
    { label: 'Conversas', valor: c, pct: 100, cor: 'bg-accent-100 text-accent-900' },
    { label: 'Leads', valor: l, pct: Math.max(Math.round((l / total) * 100), 14), cor: 'bg-accent-400 text-background-50' },
    { label: 'Vendas', valor: v, pct: Math.max(Math.round((v / total) * 100), 10), cor: 'bg-accent-500 text-background-50' },
  ];
  return (
    <div className="space-y-2.5">
      {degraus.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-20 text-[11px] font-medium text-foreground-500 text-right shrink-0">{d.label}</span>
          <div className="flex-1 flex justify-center">
            <div
              className={`${d.cor} h-10 rounded-lg flex items-center justify-center font-heading font-bold text-sm transition-all`}
              style={{ width: `${d.pct}%` }}
            >
              {d.valor}
            </div>
          </div>
          <span className="w-11 text-[11px] text-foreground-400 text-right shrink-0">{d.pct}%</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [periodo, setPeriodo] = useState('Este mês');
  const [toast, setToast] = useState('');
  const fluxo = useFluxoComercial();
  const { propostas: propostasBrutas } = usePropostasStore();
  const { vendas: vendasBrutas } = useVendasStore();
  const [leadsBrutos] = useLeadsStore();
  const { conversas } = useConversasStore();

  const refDate = maxDataString([
    ...vendasBrutas.map((v) => v.data),
    ...propostasBrutas.map((p) => p.data),
    ...leadsBrutos.map((l) => l.criadoEm),
  ]);
  const desde = periodoDesde(periodo, refDate);
  const propostas = propostasBrutas.filter((p) => dentroDoPeriodo(p.data, desde));
  const vendas = vendasBrutas.filter((v) => dentroDoPeriodo(v.data, desde));
  const leads = leadsBrutos.filter((l) => dentroDoPeriodo(l.criadoEm, desde));

  const stats = useMemo(() => {
    const vendasPagas = vendas.filter((v) => v.status === 'pago');
    const receita = vendasPagas.reduce((s, v) => s + v.valor, 0);
    const qtdVendas = vendasPagas.length;
    const ticketMedio = receita / (qtdVendas || 1);
    const pipeline = propostas
      .filter((p) => ['rascunho', 'enviada', 'visualizada'].includes(p.status))
      .reduce((s, p) => s + p.valor, 0);
    const gerado = propostas.reduce((s, p) => s + p.valor, 0);
    const leadsTotal = leads.length;
    const ganhos = leads.filter((l) => l.etapa === 'Fechado — Ganho').length;
    const perdidos = leads.filter((l) => l.etapa === 'Fechado — Perdido').length;
    const abertos = leadsTotal - ganhos - perdidos;

    const vendedores = ['Marina Sales', 'João Vendedor', 'Fabrício Gaspar'];
    const porVendedor = vendedores.map((nome) => {
      const isFab = nome === 'Fabrício Gaspar';
      const matchLead = (l: (typeof leads)[0]) =>
        l.responsavel === nome || (isFab && l.responsavel === 'Ana (IA)');
      const matchProp = (p: (typeof propostas)[0]) =>
        p.responsavel === nome || (isFab && p.responsavel === 'Ana (IA)');
      const propostasVend = propostas.filter(matchProp);
      const vendasVend = vendasPagas.filter((v) => {
        const prop = proposalForSale(propostas, v);
        return prop && (prop.responsavel === nome || (isFab && prop.responsavel === 'Ana (IA)'));
      });
      const leadsVend = leads.filter(matchLead);
      return {
        nome,
        avatar: nome.charAt(0),
        role:
          nome === 'Marina Sales'
            ? 'Gestor Comercial'
            : nome === 'João Vendedor'
              ? 'Vendedor'
              : 'Administrador',
        gerado: propostasVend.reduce((s, p) => s + p.valor, 0),
        leads: leadsVend.length,
        receita: vendasVend.reduce((s, v) => s + v.valor, 0),
        vendas: vendasVend.length,
        ganhos: vendasVend.length,
        abertos: leadsVend.filter((l) => !['Fechado — Ganho', 'Fechado — Perdido'].includes(l.etapa)).length,
        perdidos: leadsVend.filter((l) => l.etapa === 'Fechado — Perdido').length,
      };
    });

    const topVendedor = [...porVendedor].sort((a, b) => b.receita - a.receita)[0];

    const propostasWhatsApp = propostas.filter((p) => p.canal === 'WhatsApp');
    const propostasEmail = propostas.filter((p) => p.canal === 'E-mail');
    const vendasWhatsApp = vendasPagas.filter((v) => {
      const prop = proposalForSale(propostas, v);
      return prop?.canal === 'WhatsApp';
    });
    const vendasEmail = vendasPagas.filter((v) => {
      const prop = proposalForSale(propostas, v);
      return prop?.canal === 'E-mail';
    });

    const totalConv = conversas.length;
    const volWhats = Math.max(1, Math.round(totalConv * 0.55));
    const volInsta = Math.max(1, Math.round(totalConv * 0.25));
    const volOutros = Math.max(0, totalConv - volWhats - volInsta);

    const mensagensEnviadas = conversas.reduce(
      (s, c) => s + c.mensagens.filter((m) => m.autor === 'ana').length,
      0
    );

    const temposFechamento: number[] = vendasPagas
      .map((v) => {
        const prop = proposalForSale(propostas, v);
        const lead = prop?.leadId ? leadsBrutos.find((l) => l.id === prop.leadId) : undefined;
        if (!lead?.criadoEm) return null;
        const criado = new Date(`${lead.criadoEm}T00:00:00`).getTime();
        const venda = new Date(`${v.data}T00:00:00`).getTime();
        const dias = Math.round((venda - criado) / 86400000);
        return dias >= 0 ? dias : null;
      })
      .filter((d): d is number => d !== null);
    const tempoFechamento =
      temposFechamento.length > 0
        ? Math.round(temposFechamento.reduce((s, d) => s + d, 0) / temposFechamento.length)
        : null;

    return {
      receita,
      qtdVendas,
      ticketMedio,
      pipeline,
      gerado,
      leadsTotal,
      ganhos,
      perdidos,
      abertos,
      porVendedor,
      topVendedor,
      propostasWhatsApp,
      propostasEmail,
      vendasWhatsApp,
      vendasEmail,
      volWhats,
      volInsta,
      volOutros,
      totalConv,
      mensagensEnviadas,
      tempoFechamento,
    };
  }, [propostas, vendas, leads, leadsBrutos, conversas]);

  const periodos = ['Hoje', '7 dias', 'Este mês', 'Este ano'];

  const funilConversas = stats.totalConv;
  const funilLeads = stats.leadsTotal;
  const funilVendas = stats.qtdVendas;

  const executarAutomatizacoes = async () => {
    const r = await fluxo.processarAutomacoesPendentes();
    const partes = [
      r.followUps ? `${r.followUps} follow-up(s)` : '',
      r.timeouts ? `${r.timeouts} timeout(s)` : '',
      r.lembretes ? `${r.lembretes} lembrete(s) de reunião` : '',
      r.noShows ? `${r.noShows} no-show(s) remarcado(s)` : '',
      r.fluxos ? `${r.fluxos} mensagem(ns) de fluxo` : '',
    ].filter(Boolean);
    setToast(
      partes.length
        ? `Automações processadas: ${partes.join(', ')}.`
        : 'Nenhuma automação pendente no momento.'
    );
    setTimeout(() => setToast(''), 4000);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* ===== HEADER RECEITA + CONTROLES ===== */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold text-foreground-500 mb-1">Receita</h1>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 tracking-tight">
              {fmtMoney(stats.receita)}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
              <i className="ri-arrow-up-line"></i>
              0.0%
            </span>
          </div>
          <p className="text-[10px] text-foreground-400 mt-0.5">
            Vendas {fmtMoney(stats.receita)} · Pipeline {fmtMoney(stats.pipeline)} · Ticket {fmtMoney(stats.ticketMedio)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={executarAutomatizacoes}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary-500 hover:bg-secondary-600 text-background-50 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-play-circle-line"></i>
            Executar automações
          </button>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="text-[11px] bg-background-50 border border-background-200 rounded-lg px-2.5 py-1.5 text-foreground-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            {periodos.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <div className="flex items-center bg-background-50 border border-background-200 rounded-lg overflow-hidden">
            <button className="px-3 py-1.5 text-[11px] font-medium bg-foreground-900 text-background-50 cursor-pointer whitespace-nowrap">
              Visão Geral
            </button>
            <Link
              to="/dashboard/equipe"
              className="px-3 py-1.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap inline-flex items-center gap-1 text-primary-700 bg-primary-100 hover:bg-primary-200/70 transition-colors"
            >
              <i className="ri-team-line text-sm"></i>
              Equipe
            </Link>
          </div>
        </div>
      </div>

      {toast && (
        <div className="bg-primary-100 border border-primary-200 text-primary-800 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      {/* ===== SAÚDE + INTEGRAÇÕES (compactos, lado a lado) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-5">
          <SaudeWhatsappCard />
        </div>
        <div className="lg:col-span-7">
          <IntegracoesStatus />
        </div>
      </div>

      {/* ===== KPIs PRINCIPAIS (5 cards compactos em 1 linha) ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-background-50 border border-background-200/60 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-foreground-500 font-medium">Leads</span>
            <i className="ri-user-search-line text-foreground-400 text-xs"></i>
          </div>
          <p className="text-lg font-heading font-extrabold text-foreground-900">{fmtInt(stats.leadsTotal)}</p>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-foreground-400">
            {stats.ganhos} ganhos · {stats.abertos} abertos
          </div>
        </div>
        <div className="bg-background-50 border border-background-200/60 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-foreground-500 font-medium">Gerado</span>
            <i className="ri-file-list-3-line text-foreground-400 text-xs"></i>
          </div>
          <p className="text-lg font-heading font-extrabold text-foreground-900">{fmtMoney(stats.gerado)}</p>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-foreground-400">
            propostas no período
          </div>
        </div>
        <div className="bg-background-50 border border-background-200/60 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-foreground-500 font-medium">Vendas</span>
            <i className="ri-money-dollar-circle-line text-foreground-400 text-xs"></i>
          </div>
          <p className="text-lg font-heading font-extrabold text-foreground-900">{fmtMoney(stats.receita)}</p>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-foreground-400">
            {stats.qtdVendas} vendas pagas
          </div>
        </div>
        <div className="bg-foreground-900 rounded-xl p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-background-400 font-medium">Ticket médio</span>
            <i className="ri-star-line text-background-400 text-xs"></i>
          </div>
          <p className="text-lg font-heading font-extrabold text-background-50">{fmtMoney(stats.ticketMedio)}</p>
          <p className="text-[10px] text-background-400 mt-0.5">por negócio ganho</p>
          <button className="absolute right-3 bottom-3 w-5 h-5 rounded-full bg-background-50/10 flex items-center justify-center text-background-400 hover:text-background-200 cursor-pointer">
            <i className="ri-arrow-right-line text-[10px]"></i>
          </button>
        </div>
        <div className="bg-background-50 border border-background-200/60 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-foreground-500 font-medium">Top vendas</span>
            <i className="ri-trophy-line text-foreground-400 text-xs"></i>
          </div>
          <p className="text-lg font-heading font-extrabold text-foreground-900">{fmtMoney(stats.topVendedor?.receita || 0)}</p>
          <p className="text-[10px] text-foreground-400 mt-0.5">{stats.topVendedor?.nome || '—'}</p>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-foreground-400">
            {stats.topVendedor?.vendas || 0} vendas · {stats.topVendedor?.ganhos || 0} ganhos
          </div>
        </div>
      </div>

      {/* ===== CANAIS + VOLUME + DINÂMICA (3 colunas) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Canais */}
        <div className="lg:col-span-4 bg-background-50 border border-background-200/60 rounded-xl p-4">
          {[
            {
              nome: 'WhatsApp',
              icon: 'ri-whatsapp-line',
              cor: 'text-emerald-500',
              pct: 45,
              gerado: stats.propostasWhatsApp.reduce((s, p) => s + p.valor, 0),
              fechado: stats.vendasWhatsApp.reduce((s, v) => s + v.valor, 0),
              perdido: 0,
            },
            {
              nome: 'Instagram',
              icon: 'ri-instagram-line',
              cor: 'text-rose-500',
              pct: 30,
              gerado: 0,
              fechado: 0,
              perdido: 0,
            },
            {
              nome: 'Outros',
              icon: 'ri-global-line',
              cor: 'text-foreground-400',
              pct: 25,
              gerado: stats.propostasEmail.reduce((s, p) => s + p.valor, 0),
              fechado: stats.vendasEmail.reduce((s, v) => s + v.valor, 0),
              perdido: 0,
            },
          ].map((canal, i) => (
            <div
              key={canal.nome}
              className={`flex items-center gap-3 ${i > 0 ? 'mt-3 pt-3 border-t border-background-100' : ''}`}
            >
              <div className="w-7 h-7 rounded-lg bg-background-100 flex items-center justify-center shrink-0">
                <i className={`${canal.icon} ${canal.cor} text-sm`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-foreground-800">{canal.nome}</span>
                  <span className="text-xs font-bold text-foreground-900">
                    {fmtInt(Math.round(stats.leadsTotal * (canal.pct / 100)))}{' '}
                    <span className="text-foreground-400 font-normal text-[10px]">{canal.pct}%</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-foreground-400">
                  <div>Gerado <span className="block text-foreground-700 font-medium">{fmtMoney(canal.gerado)}</span></div>
                  <div>Fechado <span className="block text-foreground-700 font-medium">{fmtMoney(canal.fechado)}</span></div>
                  <div>Perdido <span className="block text-foreground-700 font-medium">{fmtMoney(canal.perdido)}</span></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Volume de conversas */}
        <div className="lg:col-span-4 bg-background-50 border border-background-200/60 rounded-xl p-4 flex flex-col">
          <div className="mb-3">
            <h3 className="text-[10px] font-medium text-foreground-500">Volume de conversas</h3>
            <p className="text-[10px] text-foreground-400">por canal de origem</p>
          </div>
          <div className="flex items-end justify-center gap-6 mb-4 flex-1">
            {[
              { nome: 'WhatsApp', icon: 'ri-whatsapp-line', pct: Math.round((stats.volWhats / stats.totalConv) * 100) || 0, valor: stats.volWhats },
              { nome: 'Instagram', icon: 'ri-instagram-line', pct: Math.round((stats.volInsta / stats.totalConv) * 100) || 0, valor: stats.volInsta },
              { nome: 'Outros', icon: 'ri-global-line', pct: Math.round((stats.volOutros / stats.totalConv) * 100) || 0, valor: stats.volOutros },
            ].map((c) => (
              <div key={c.nome} className="flex flex-col items-center gap-1.5">
                <div className="w-12 h-12 rounded-full bg-background-100 flex items-center justify-center border border-background-200">
                  <i className={`${c.icon} text-foreground-500 text-lg`}></i>
                </div>
                <span className="text-xs font-bold text-foreground-800">{c.valor}</span>
                <span className="text-[10px] text-foreground-400">{c.pct}%</span>
              </div>
            ))}
          </div>
          <div className="w-full space-y-1.5">
            {[
              { nome: 'WhatsApp', cor: 'bg-emerald-500', pct: Math.round((stats.volWhats / stats.totalConv) * 100) || 0 },
              { nome: 'Instagram', cor: 'bg-rose-500', pct: Math.round((stats.volInsta / stats.totalConv) * 100) || 0 },
              { nome: 'Outros', cor: 'bg-foreground-400', pct: Math.round((stats.volOutros / stats.totalConv) * 100) || 0 },
            ].map((c) => (
              <div key={c.nome} className="flex items-center gap-2">
                <span className="text-[10px] text-foreground-500 w-14">{c.nome}</span>
                <div className="flex-1 h-1.5 bg-background-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${c.cor}`} style={{ width: `${c.pct}%` }}></div>
                </div>
                <span className="text-[10px] text-foreground-700 font-medium w-7 text-right">{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dinâmica de vendas */}
        <div className="lg:col-span-4 bg-background-50 border border-background-200/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-medium text-foreground-500">Dinâmica de vendas</h3>
            <i className="ri-bar-chart-line text-foreground-400 text-xs"></i>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <p className="text-[10px] text-foreground-400 mb-0.5">Ganhos</p>
              <p className="text-lg font-bold text-foreground-900">{stats.ganhos}</p>
              <p className="text-[10px] text-foreground-400">gerado {fmtMoney(stats.receita)}</p>
            </div>
            <div className="text-center border-x border-background-100">
              <p className="text-[10px] text-foreground-400 mb-0.5">Perdidos</p>
              <p className="text-lg font-bold text-foreground-900">{stats.perdidos}</p>
              <p className="text-[10px] text-foreground-400">R$ 0</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-foreground-400 mb-0.5">Conversão</p>
              <p className="text-lg font-bold text-primary-500">{((stats.ganhos / (stats.leadsTotal || 1)) * 100).toFixed(0)}%</p>
              <p className="text-[10px] text-foreground-400">{stats.abertos} abertos</p>
            </div>
          </div>
          <div className="py-2">
            <div className="flex h-2 rounded-full overflow-hidden bg-background-100">
              <div className="bg-emerald-500 h-full" style={{ width: `${stats.leadsTotal ? (stats.ganhos / stats.leadsTotal) * 100 : 0}%` }} />
              <div className="bg-primary-500 h-full" style={{ width: `${stats.leadsTotal ? (stats.abertos / stats.leadsTotal) * 100 : 0}%` }} />
              <div className="bg-rose-500 h-full" style={{ width: `${stats.leadsTotal ? (stats.perdidos / stats.leadsTotal) * 100 : 0}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] text-foreground-400">
              <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Ganhos</span>
              <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>Abertos</span>
              <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Perdidos</span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-background-100">
            <span className="px-2 py-0.5 rounded-full bg-foreground-900 text-background-50 text-[10px] font-medium">Todos</span>
            <span className="px-2 py-0.5 rounded-full bg-background-100 text-foreground-600 text-[10px] font-medium inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
              {stats.topVendedor?.nome || '—'} {fmtMoneyK(stats.topVendedor?.receita || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* ===== PULSO OPERACIONAL (Pendências + Telemetria) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-7">
          <CentralPendencias />
        </div>
        <div className="lg:col-span-5">
          <TelemetriaAna />
        </div>
      </div>

      {/* ===== FUNIL + DESEMPENHO ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-7 bg-background-50 border border-background-200/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                <i className="ri-filter-3-line text-primary-600 text-xs"></i>
              </div>
              <div>
                <p className="text-[10px] text-foreground-400">Funil de conversão</p>
                <p className="text-xs font-bold text-foreground-800">Conversas → Leads → Vendas</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
              <i className="ri-arrow-up-line"></i>
              0.0%
            </span>
          </div>
          <FunnelChart conversas={funilConversas} leads={funilLeads} vendas={funilVendas} />
        </div>

        <div className="lg:col-span-5 bg-background-50 border border-background-200/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-medium text-foreground-500">Desempenho</h3>
            <Link to="/dashboard/leads" className="text-[10px] text-primary-600 hover:text-primary-700 font-medium cursor-pointer whitespace-nowrap">
              Ver detalhes
            </Link>
          </div>
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-background-100">
                  <th className="text-left py-1.5 text-foreground-400 font-normal">Vendedor</th>
                  <th className="text-right py-1.5 text-foreground-400 font-normal">Gerado</th>
                  <th className="text-right py-1.5 text-foreground-400 font-normal">Leads</th>
                  <th className="text-right py-1.5 text-foreground-400 font-normal">Receita</th>
                  <th className="text-right py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {stats.porVendedor.map((v) => (
                  <tr key={v.nome} className="border-b border-background-50 hover:bg-background-50/50">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-[9px] font-bold flex items-center justify-center">
                          {v.avatar}
                        </div>
                        <span className="text-foreground-700 font-medium">{v.nome}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right text-foreground-700">{fmtMoney(v.gerado)}</td>
                    <td className="py-2 text-right">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-foreground-900 text-background-50 text-[9px] flex items-center justify-center font-bold">{v.leads}</span>
                      </span>
                    </td>
                    <td className="py-2 text-right text-foreground-700">{fmtMoney(v.receita)}</td>
                    <td className="py-2 text-right">
                      <button className="w-5 h-5 rounded-full bg-primary-500 text-background-50 flex items-center justify-center cursor-pointer">
                        <i className="ri-arrow-right-s-line text-xs"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {[
              { label: 'Conversas', valor: fmtInt(stats.totalConv), sub: 'Nenhuma conversa no período', icon: 'ri-chat-3-line' },
              { label: 'Mensagens enviadas', valor: fmtInt(stats.mensagensEnviadas), sub: 'pela Ana nos atendimentos', icon: 'ri-send-plane-line' },
              { label: 'Conversão', valor: stats.leadsTotal ? `${Math.round((stats.ganhos / stats.leadsTotal) * 100)}%` : '—', sub: stats.leadsTotal ? 'de leads em vendas' : 'Sem leads no período', icon: 'ri-bar-chart-line' },
              { label: 'Tempo de fechamento', valor: stats.tempoFechamento != null ? `${stats.tempoFechamento} dias` : '—', sub: stats.tempoFechamento != null ? 'média da criação à venda' : 'Sem vendas ganhas no período', icon: 'ri-time-line' },
            ].map((c) => (
              <div key={c.label} className="bg-background-100/50 rounded-lg p-2.5">
                <div className="flex items-center gap-1 mb-1">
                  <i className={`${c.icon} text-foreground-400 text-[10px]`}></i>
                  <span className="text-[10px] text-foreground-500">{c.label}</span>
                </div>
                <p className="text-sm font-bold text-foreground-800">{c.valor}</p>
                <p className="text-[10px] text-foreground-400 mt-0.5 leading-tight">{c.sub}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center py-1 text-foreground-400 text-[10px]">
            Sem dados suficientes no período
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-background-100 text-[10px] text-foreground-500">
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Ganhos {stats.ganhos}</span>
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>Abertos {stats.abertos}</span>
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Perdidos {stats.perdidos}</span>
          </div>
        </div>
      </div>

      {/* ===== ATIVIDADE + TAREFAS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-7">
          <AtividadeRecente />
        </div>
        <div className="lg:col-span-5">
          <FilaTarefas />
        </div>
      </div>
    </div>
  );
}
