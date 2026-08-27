import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { mockUsers } from '@/mocks/users';
import type { Conversa } from '@/mocks/atendimentoData';
import type { Lead } from '@/mocks/leadsData';
import type { Proposta, Venda } from '@/mocks/propostasData';

export interface UsuarioMetricas {
  id: string;
  nome: string;
  email: string;
  role: string;
  company: string;
  avatar: string;
  conversas: number;
  conversasAtivas: number;
  conversasResolvidas: number;
  leads: number;
  leadsComConversa: number;
  leadsSemConversa: number;
  propostas: number;
  vendas: number;
  receita: number;
  ticketMedio: number;
  tempoResposta: number;
  canalWhatsapp: number;
  canalInstagram: number;
  canalEmail: number;
}

export interface MetricasEquipe {
  usuarios: UsuarioMetricas[];
  totalConversas: number;
  totalLeads: number;
  totalVendasPagas: number;
  totalReceita: number;
  ticketMedio: number;
  whatsAppConversas: number;
  instagramConversas: number;
  emailConversas: number;
}

export function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function fmtDecimal(v: number) {
  return v.toFixed(1).replace('.', ',');
}

export function calcularMetricas(
  conversas: Conversa[],
  leads: Lead[],
  propostas: Proposta[],
  vendas: Venda[]
): MetricasEquipe {
  const vendasPagas = vendas.filter((v) => v.status === 'pago');
  const totalReceita = vendasPagas.reduce((s, v) => s + v.valor, 0);
  const ticketMedio = totalReceita / (vendasPagas.length || 1);

  const usuarios = mockUsers.map((u) => {
    const nome = u.name;
    const isAna = nome === 'Fabrício';
    const anaAlias = 'Ana (IA)';

    const convDoUsuario = conversas.filter((c) => {
      const lead = leads.find((l) => l.id === c.leadId);
      if (!lead) return false;
      return lead.responsavel === nome || (isAna && lead.responsavel === anaAlias);
    });

    const leadsDoUsuario = leads.filter(
      (l) => l.responsavel === nome || (isAna && l.responsavel === anaAlias)
    );

    const propostasDoUsuario = propostas.filter(
      (p) => p.responsavel === nome || (isAna && p.responsavel === anaAlias)
    );

    const vendasDoUsuario = vendasPagas.filter((v) => {
      const prop = propostas.find((p) => p.numero === v.proposta);
      return prop && (prop.responsavel === nome || (isAna && prop.responsavel === anaAlias));
    });

    const receitaUsuario = vendasDoUsuario.reduce((s, v) => s + v.valor, 0);

    return {
      id: u.id,
      nome: u.name,
      email: u.email,
      role: u.role,
      company: u.company,
      avatar: u.avatar,
      conversas: convDoUsuario.length,
      conversasAtivas: convDoUsuario.filter((c) => c.status === 'ativo').length,
      conversasResolvidas: convDoUsuario.filter((c) => c.status === 'resolvido').length,
      leads: leadsDoUsuario.length,
      leadsComConversa: leadsDoUsuario.filter((l) => conversas.some((c) => c.leadId === l.id)).length,
      leadsSemConversa: leadsDoUsuario.filter((l) => !conversas.some((c) => c.leadId === l.id)).length,
      propostas: propostasDoUsuario.length,
      vendas: vendasDoUsuario.length,
      receita: receitaUsuario,
      ticketMedio: receitaUsuario / (vendasDoUsuario.length || 1),
      tempoResposta: isAna ? 2.3 : nome === 'Marina Sales' ? 5.9 : 8.2,
      canalWhatsapp: convDoUsuario.filter((c) => c.canal === 'whatsapp').length,
      canalInstagram: convDoUsuario.filter((c) => c.canal === 'instagram').length,
      canalEmail: convDoUsuario.filter((c) => c.canal === 'email').length,
    };
  });

  const whatsAppConversas = conversas.filter((c) => c.canal === 'whatsapp').length;
  const instagramConversas = conversas.filter((c) => c.canal === 'instagram').length;
  const emailConversas = conversas.filter((c) => c.canal === 'email').length;

  return {
    usuarios,
    totalConversas: conversas.length,
    totalLeads: leads.length,
    totalVendasPagas: vendasPagas.length,
    totalReceita,
    ticketMedio,
    whatsAppConversas,
    instagramConversas,
    emailConversas,
  };
}

export interface TendenciaPonto {
  label: string;
  receita: number;
  vendas: number;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function formatarDia(dia: number, mes: number) {
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

export function gerarTendencia(periodo: string): TendenciaPonto[] {
  if (periodo === 'TUDO') {
    const rand = mulberry32(99);
    const meses = ['Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago'];
    return meses.map((m, i) => {
      const receita = Math.max(
        8000,
        Math.round((25000 + i * 18000 + (rand() - 0.5) * 22000) / 100) * 100
      );
      return { label: m, receita, vendas: Math.max(2, Math.round(receita / 5200)) };
    });
  }

  let dias: number;
  let seed: number;
  let inicio: Date;

  switch (periodo) {
    case '7 DIAS':
      dias = 7;
      seed = 7;
      inicio = new Date(2026, 7, 14);
      break;
    case '15 DIAS':
      dias = 15;
      seed = 15;
      inicio = new Date(2026, 7, 6);
      break;
    case 'MÊS PASSADO':
      dias = 31;
      seed = 31;
      inicio = new Date(2026, 6, 1);
      break;
    case 'ESTE MÊS':
    default:
      dias = 20;
      seed = 20;
      inicio = new Date(2026, 7, 1);
      break;
  }

  const rand = mulberry32(seed);
  const pontos: TendenciaPonto[] = [];
  for (let i = 0; i < dias; i += 1) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    const onda = Math.sin(i / 2.5) * 3200;
    const receita = Math.max(
      1500,
      Math.round((9000 + i * 480 + onda + (rand() - 0.5) * 7000) / 100) * 100
    );
    pontos.push({
      label: formatarDia(d.getDate(), d.getMonth() + 1),
      receita,
      vendas: Math.max(1, Math.round(receita / 4800)),
    });
  }
  return pontos;
}

function csvCampo(v: string | number) {
  const s = String(v);
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function baixarArquivo(nome: string, conteudo: string | Blob, mime: string) {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportarCSV(metricas: MetricasEquipe) {
  const cabecalho = [
    'Membro',
    'Cargo',
    'Conversas',
    'Ativas',
    'Resolvidas',
    'Leads',
    'Com Conversa',
    'Sem Conversa',
    'Propostas',
    'Vendas',
    'Receita (R$)',
    'Ticket Médio (R$)',
    'Tempo Resposta (min)',
    'WhatsApp',
    'Instagram',
    'E-mail',
  ];
  const linhas = metricas.usuarios.map((u) => [
    u.nome,
    u.role,
    u.conversas,
    u.conversasAtivas,
    u.conversasResolvidas,
    u.leads,
    u.leadsComConversa,
    u.leadsSemConversa,
    u.propostas,
    u.vendas,
    u.receita,
    Math.round(u.ticketMedio),
    fmtDecimal(u.tempoResposta),
    u.canalWhatsapp,
    u.canalInstagram,
    u.canalEmail,
  ]);
  const csv = [cabecalho, ...linhas].map((linha) => linha.map(csvCampo).join(';')).join('\n');
  const hoje = new Date().toISOString().slice(0, 10);
  baixarArquivo(`relatorio-equipe-${hoje}.csv`, `\ufeff${csv}`, 'text/csv;charset=utf-8;');
}

export function exportarPDF(metricas: MetricasEquipe, periodo: string) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Relatório de Equipe', 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Período: ${periodo}  •  Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 26);
  doc.setTextColor(30);

  doc.setFontSize(11);
  doc.text(`Total de Conversas: ${metricas.totalConversas}`, 14, 35);
  doc.text(`Total de Leads: ${metricas.totalLeads}`, 14, 41);
  doc.text(`Vendas Pagas: ${metricas.totalVendasPagas}`, 14, 47);
  doc.text(`Receita Total: ${fmtMoney(metricas.totalReceita)}`, 14, 53);
  doc.text(`Ticket Médio: ${fmtMoney(metricas.ticketMedio)}`, 14, 59);

  autoTable(doc, {
    startY: 66,
    head: [
      ['Membro', 'Cargo', 'Conversas', 'Leads', 'Propostas', 'Vendas', 'Receita', 'Ticket Médio', 'Tempo Resp.'],
    ],
    body: metricas.usuarios.map((u) => [
      u.nome,
      u.role,
      String(u.conversas),
      String(u.leads),
      String(u.propostas),
      String(u.vendas),
      fmtMoney(u.receita),
      fmtMoney(u.ticketMedio),
      `${fmtDecimal(u.tempoResposta)} min`,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
  });

  const hoje = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio-equipe-${hoje}.pdf`);
}