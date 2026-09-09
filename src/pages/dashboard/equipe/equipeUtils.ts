import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Conversa } from '@/mocks/atendimentoData';
import type { Lead } from '@/mocks/leadsData';
import type { Proposta } from '@/mocks/propostasData';
import type { TeamMember } from '@/lib/crm/teamMembersRepository';

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
  orcamentosAceitos: number;
  valorOrcado: number;
  valorMedioOrcado: number;
  tempoResposta: number | null;
  canalWhatsapp: number;
  canalInstagram: number;
  canalEmail: number;
}

export interface MetricasEquipe {
  usuarios: UsuarioMetricas[];
  totalConversas: number;
  totalLeads: number;
  totalOrcamentosAceitos: number;
  totalValorOrcado: number;
  valorMedioOrcado: number;
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
  membros: TeamMember[],
  conversas: Conversa[],
  leads: Lead[],
  propostas: Proposta[]
): MetricasEquipe {
  const orcamentosAceitos = propostas.filter((proposal) => proposal.status === 'aceita');
  const totalValorOrcado = orcamentosAceitos.reduce((s, proposal) => s + proposal.valor, 0);
  const valorMedioOrcado = totalValorOrcado / (orcamentosAceitos.length || 1);

  const usuarios = membros.filter((member) => member.status === 'active').map((u) => {
    const nome = u.name;

    const convDoUsuario = conversas.filter((c) => {
      const lead = leads.find((l) => l.id === c.leadId);
      if (!lead) return false;
      return lead.responsavelId === u.userId || lead.responsavel === nome;
    });

    const leadsDoUsuario = leads.filter(
      (l) => l.responsavelId === u.userId || l.responsavel === nome
    );

    const propostasDoUsuario = propostas.filter(
      (p) => p.responsavel === nome
    );

    const orcamentosAceitosDoUsuario = orcamentosAceitos.filter((proposal) => proposal.responsavel === nome);
    const valorOrcadoUsuario = orcamentosAceitosDoUsuario.reduce((s, proposal) => s + proposal.valor, 0);

    return {
      id: u.userId,
      nome: u.name,
      email: u.email,
      role: u.role,
      company: 'WayFlex',
      avatar: u.avatar || u.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      conversas: convDoUsuario.length,
      conversasAtivas: convDoUsuario.filter((c) => c.status === 'ativo').length,
      conversasResolvidas: convDoUsuario.filter((c) => c.status === 'resolvido').length,
      leads: leadsDoUsuario.length,
      leadsComConversa: leadsDoUsuario.filter((l) => conversas.some((c) => c.leadId === l.id)).length,
      leadsSemConversa: leadsDoUsuario.filter((l) => !conversas.some((c) => c.leadId === l.id)).length,
      propostas: propostasDoUsuario.length,
      orcamentosAceitos: orcamentosAceitosDoUsuario.length,
      valorOrcado: valorOrcadoUsuario,
      valorMedioOrcado: valorOrcadoUsuario / (orcamentosAceitosDoUsuario.length || 1),
      tempoResposta: null,
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
    totalOrcamentosAceitos: orcamentosAceitos.length,
    totalValorOrcado,
    valorMedioOrcado,
    whatsAppConversas,
    instagramConversas,
    emailConversas,
  };
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
    'Orçamentos aceitos',
    'Valor orçado (R$)',
    'Valor médio orçado (R$)',
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
    u.orcamentosAceitos,
    u.valorOrcado,
    Math.round(u.valorMedioOrcado),
    u.tempoResposta === null ? 'Não calculado' : fmtDecimal(u.tempoResposta),
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
  doc.text(`Orçamentos aceitos: ${metricas.totalOrcamentosAceitos}`, 14, 47);
  doc.text(`Valor em orçamentos: ${fmtMoney(metricas.totalValorOrcado)}`, 14, 53);
  doc.text(`Valor médio orçado: ${fmtMoney(metricas.valorMedioOrcado)}`, 14, 59);

  autoTable(doc, {
    startY: 66,
    head: [
      ['Membro', 'Cargo', 'Conversas', 'Leads', 'Propostas', 'Orç. aceitos', 'Valor orçado', 'Valor médio', 'Tempo Resp.'],
    ],
    body: metricas.usuarios.map((u) => [
      u.nome,
      u.role,
      String(u.conversas),
      String(u.leads),
      String(u.propostas),
      String(u.orcamentosAceitos),
      fmtMoney(u.valorOrcado),
      fmtMoney(u.valorMedioOrcado),
      u.tempoResposta === null ? 'Não calculado' : `${fmtDecimal(u.tempoResposta)} min`,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
  });

  const hoje = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio-equipe-${hoje}.pdf`);
}
