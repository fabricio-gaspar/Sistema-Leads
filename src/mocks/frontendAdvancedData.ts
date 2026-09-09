export interface Notificacao {
  id: string;
  titulo: string;
  descricao: string;
  tipo: 'lead' | 'proposta' | 'venda' | 'sistema' | 'alerta';
  lida: boolean;
  data: string;
  link?: string;
}

export interface Compromisso {
  id: string;
  titulo: string;
  lead: string;
  empresa: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  tipo: 'reuniao' | 'ligacao' | 'followup' | 'proposta';
  canal: 'presencial' | 'video' | 'telefone' | 'whatsapp';
  status: 'agendado' | 'realizado' | 'cancelado' | 'no_show';
  responsavel: string;
  observacoes: string;
  leadId?: string;
  origem?: 'ana' | 'manual';
  // Lembretes já disparados pela Ana antes da reunião ("24h" e/ou "1h").
  lembretesEnviados?: string[];
}

export const notificacoes: Notificacao[] = [
  {
    id: 'ntf-1',
    titulo: 'Novo lead qualificado',
    descricao: 'Carlos Mendes (Tech Solutions) atingiu score 92 e foi movido para Qualificado.',
    tipo: 'lead',
    lida: false,
    data: '2026-08-14 10:42',
    link: '/dashboard/leads',
  },
  {
    id: 'ntf-2',
    titulo: 'Documento processado',
    descricao: 'A Ana concluiu o processamento do documento "Catálogo de serviços 2026".',
    tipo: 'sistema',
    lida: false,
    data: '2026-08-14 09:15',
    link: '/dashboard/empresa',
  },
  {
    id: 'ntf-3',
    titulo: 'Lead convertido',
    descricao: 'Juliana Costa avançou para a etapa Fechado no funil.',
    tipo: 'lead',
    lida: false,
    data: '2026-08-14 08:30',
    link: '/dashboard/leads',
  },
  {
    id: 'ntf-4',
    titulo: 'SLA próximo do vencimento',
    descricao: 'Ticket #TCK-2026-0841 (Carlos Mendes) com SLA de 1h 20min restante.',
    tipo: 'alerta',
    lida: true,
    data: '2026-08-14 07:55',
    link: '/dashboard/atendimento',
  },
  {
    id: 'ntf-5',
    titulo: 'Handoff aceito',
    descricao: 'Marina Sales aceitou a transferência de Juliana Costa (Negociação).',
    tipo: 'sistema',
    lida: true,
    data: '2026-08-13 16:20',
    link: '/dashboard/atendimento',
  },
  {
    id: 'ntf-6',
    titulo: 'Lead perdido',
    descricao: 'Sérgio Barros (FinanPrime) foi movido para Perdido. Motivo: sem interesse.',
    tipo: 'lead',
    lida: true,
    data: '2026-08-13 14:10',
    link: '/dashboard/leads',
  },
  {
    id: 'ntf-7',
    titulo: 'Lead movido no Kanban',
    descricao: 'Carlos Mendes foi movido para a etapa Qualificado.',
    tipo: 'lead',
    lida: true,
    data: '2026-08-13 11:05',
    link: '/dashboard/kanban',
  },
  {
    id: 'ntf-8',
    titulo: 'Opt-out registrado',
    descricao: 'Contato da Farmácia Bem Estar solicitou descadastro via WhatsApp.',
    tipo: 'alerta',
    lida: true,
    data: '2026-08-12 18:45',
    link: '/dashboard/configuracoes',
  },
];

// Gera data/hora relativas ao "agora" para manter reuniões de exemplo sempre no futuro
// (úteis para demonstrar os lembretes automáticos da Ana — 24h e 1h antes).
function dataHoraRelativa(horas: number): { data: string; horaInicio: string; horaFim: string } {
  const inicio = new Date();
  inicio.setTime(inicio.getTime() + horas * 3600 * 1000);
  const fim = new Date(inicio);
  fim.setHours(fim.getHours() + 1);
  const fmtData = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmtHora = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { data: fmtData(inicio), horaInicio: fmtHora(inicio), horaFim: fmtHora(fim) };
}

export const compromissos: Compromisso[] = [
  {
    id: 'comp-1',
    titulo: 'Apresentação comercial',
    lead: 'Carlos Mendes',
    empresa: 'Tech Solutions Ltda',
    data: '2026-08-14',
    horaInicio: '14:00',
    horaFim: '15:00',
    tipo: 'reuniao',
    canal: 'video',
    status: 'agendado',
    responsavel: 'Marina Sales',
    observacoes: 'Apresentar plano Pro e cases de sucesso do segmento de tecnologia.',
  },
  {
    id: 'comp-2',
    titulo: 'Follow-up de proposta',
    lead: 'Patrícia Lima',
    empresa: 'Clínica Vida Saudável',
    data: '2026-08-14',
    horaInicio: '10:00',
    horaFim: '10:30',
    tipo: 'followup',
    canal: 'telefone',
    status: 'agendado',
    responsavel: 'João Vendedor',
    observacoes: 'Verificar se recebeu a proposta PRP-0139 e tirar dúvidas.',
  },
  {
    id: 'comp-3',
    titulo: 'Reunião de negociação',
    lead: 'Juliana Costa',
    empresa: 'Agência Criativa',
    data: '2026-08-15',
    horaInicio: '09:30',
    horaFim: '10:30',
    tipo: 'reuniao',
    canal: 'presencial',
    status: 'agendado',
    responsavel: 'Marina Sales',
    observacoes: 'Negociar desconto de 10% no plano Enterprise. Trazer contrato.',
  },
  {
    id: 'comp-4',
    titulo: 'Ligação de qualificação',
    lead: 'Ana Oliveira',
    empresa: 'Construtora Nova Era',
    data: '2026-08-15',
    horaInicio: '11:00',
    horaFim: '11:20',
    tipo: 'ligacao',
    canal: 'telefone',
    status: 'agendado',
    responsavel: 'Paula SDR',
    observacoes: 'Qualificar a necessidade técnica e a aplicação industrial informada.',
  },
  {
    id: 'comp-5',
    titulo: 'Envio de proposta',
    lead: 'Larissa Melo',
    empresa: 'Energia Solar Brasil',
    data: '2026-08-16',
    horaInicio: '13:00',
    horaFim: '13:30',
    tipo: 'proposta',
    canal: 'video',
    status: 'agendado',
    responsavel: 'João Vendedor',
    observacoes: 'Apresentar proposta PRP-0135 e demonstrar ROI do projeto.',
  },
  {
    id: 'comp-6',
    titulo: 'Onboarding novo cliente',
    lead: 'Ricardo Nunes',
    empresa: 'AgroPlanta',
    data: '2026-08-17',
    horaInicio: '10:00',
    horaFim: '11:30',
    tipo: 'reuniao',
    canal: 'video',
    status: 'agendado',
    responsavel: 'Paula SDR',
    observacoes: 'Primeira reunião de alinhamento. Coletar acessos e materiais.',
  },
  {
    id: 'comp-7',
    titulo: 'Follow-up WhatsApp',
    lead: 'Marcos Vinícius',
    empresa: 'Restaurante Sabor & Arte',
    data: '2026-08-14',
    horaInicio: '16:00',
    horaFim: '16:15',
    tipo: 'followup',
    canal: 'whatsapp',
    status: 'agendado',
    responsavel: 'Ana (IA)',
    observacoes: 'Enviar material de pequenos negócios e responder dúvidas.',
  },
  {
    id: 'comp-8',
    titulo: 'Reunião de apresentação',
    lead: 'Fernando Gomes',
    empresa: 'Alpha Automação',
    data: '2026-08-21',
    horaInicio: '15:00',
    horaFim: '16:00',
    tipo: 'reuniao',
    canal: 'video',
    status: 'agendado',
    responsavel: 'Ana (IA)',
    observacoes: 'Reunião agendada automaticamente pela Ana. Lead não compareceu.',
    leadId: 'ld-8',
    origem: 'ana',
  },
  {
    id: 'comp-9',
    titulo: 'Reunião de apresentação',
    lead: 'Ana Oliveira',
    empresa: 'Construtora Nova Era',
    data: dataHoraRelativa(0.66).data,
    horaInicio: dataHoraRelativa(0.66).horaInicio,
    horaFim: dataHoraRelativa(0.66).horaFim,
    tipo: 'reuniao',
    canal: 'video',
    status: 'agendado',
    responsavel: 'Ana (IA)',
    observacoes: 'Reunião agendada automaticamente pela Ana. Lembrete de 1h deve disparar.',
    leadId: 'ld-2',
    origem: 'ana',
  },
  {
    id: 'comp-10',
    titulo: 'Reunião de apresentação',
    lead: 'Carlos Mendes',
    empresa: 'Tech Solutions Ltda',
    data: dataHoraRelativa(20).data,
    horaInicio: dataHoraRelativa(20).horaInicio,
    horaFim: dataHoraRelativa(20).horaFim,
    tipo: 'reuniao',
    canal: 'video',
    status: 'agendado',
    responsavel: 'Ana (IA)',
    observacoes: 'Reunião agendada automaticamente pela Ana. Lembrete de 24h deve disparar.',
    leadId: 'ld-1',
    origem: 'ana',
  },
];
