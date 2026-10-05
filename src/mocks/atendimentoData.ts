export interface Mensagem {
  id: string;
  autor: 'cliente' | 'ana' | 'vendedor' | 'sistema';
  nome: string;
  texto: string;
  hora: string;
  notaInterna?: boolean;
  statusEnvio?: 'aguardando' | 'aceita' | 'entregue' | 'lida' | 'falhou' | 'reconciliacao';
  criadoEm?: string;
  enviadoEm?: string | null;
  entregueEm?: string | null;
  lidoEm?: string | null;
  providerMessageId?: string | null;
  correlationId?: string | null;
  tentativas?: number;
  erroTecnico?: string | null;
  historicoStatus?: { label: string; at?: string }[];
  // Horários clicáveis oferecidos pela Ana durante o agendamento na conversa.
  opcoesHorario?: { data: string; horaInicio: string; horaFim: string; indice: number }[];
}

export interface Conversa {
  id: string;
  protocolo: string;
  contato: string;
  empresa: string;
  canal: 'whatsapp' | 'email' | 'instagram';
  status: 'ativo' | 'aguardando' | 'resolvido' | 'transferido';
  sla: string;
  fila: string;
  ultimaMensagem: string;
  hora: string;
  naoLidas: number;
  mensagens: Mensagem[];
  leadId?: string;
  whatsappAccountId?: string | null;
  whatsappAccountLabel?: string | null;
  whatsappPhoneSuffix?: string | null;
  whatsappProvider?: 'zapi' | 'meta_cloud' | 'evolution_go' | 'wa_akg' | null;
}

export const respostasRapidas = [
  'Olá! Sou a Ana, assistente virtual. Como posso ajudar?',
  'Perfeito! Já vou registrar sua solicitação.',
  'Posso te passar um orçamento personalizado. Qual o melhor horário para falarmos?',
  'Vou transferir você para um atendente humano, um momento.',
];

export const conversas: Conversa[] = [
  {
    id: 'cv-1',
    protocolo: '#TCK-2026-0841',
    contato: 'Carlos Mendes',
    empresa: 'Tech Solutions Ltda',
    canal: 'whatsapp',
    status: 'ativo',
    sla: '1h 20min',
    fila: 'Qualificação',
    ultimaMensagem: 'Tenho interesse em perfis de EPDM e gaxetas nitrílicas. Pode me passar um orçamento?',
    hora: '10:42',
    naoLidas: 2,
    mensagens: [
      { id: 'msg-1', autor: 'sistema', nome: 'Sistema', texto: 'Lead aprovado e matriculado na cadência de boas-vindas.', hora: '09:05', notaInterna: true },
      { id: 'msg-2', autor: 'ana', nome: 'Ana', texto: 'Olá Carlos! Sou a Ana, assistente virtual da Wayflex. Vi que a Tech Solutions pode se beneficiar com nossas soluções em borracha, silicone e poliuretano. Posso te mostrar como podemos ajudar?', hora: '09:06' },
      { id: 'msg-3', autor: 'cliente', nome: 'Carlos Mendes', texto: 'Oi Ana! Sim, estamos buscando fornecedor de perfis de borracha e gaxetas industriais.', hora: '09:40' },
      { id: 'msg-4', autor: 'ana', nome: 'Ana', texto: 'Que ótimo! A Wayflex é especialista exatamente nisso. Posso te enviar nosso catálogo de soluções e depois marcamos uma conversa técnica?', hora: '09:42' },
      { id: 'msg-5', autor: 'cliente', nome: 'Carlos Mendes', texto: 'Pode sim! E já adianto que queremos começar este mês.', hora: '10:15' },
      { id: 'msg-6', autor: 'cliente', nome: 'Carlos Mendes', texto: 'Tenho interesse em perfis de EPDM e gaxetas nitrílicas. Pode me passar um orçamento?', hora: '10:42' },
    ],
  },
  {
    id: 'cv-2',
    protocolo: '#TCK-2026-0840',
    contato: 'Roberto Alves',
    empresa: 'Farmácia Bem Estar',
    canal: 'email',
    status: 'aguardando',
    sla: '3h 05min',
    fila: 'Propostas',
    ultimaMensagem: 'Proposta enviada. Aguardando resposta do cliente.',
    hora: '09:15',
    naoLidas: 0,
    mensagens: [
      { id: 'msg-1', autor: 'ana', nome: 'Ana', texto: 'Olá Roberto! Segue a proposta que combinamos. Qualquer dúvida estou à disposição.', hora: '08:50' },
      { id: 'msg-2', autor: 'sistema', nome: 'Sistema', texto: 'Proposta #PRP-0140 enviada por e-mail com sucesso.', hora: '08:51', notaInterna: true },
    ],
  },
  {
    id: 'cv-3',
    protocolo: '#TCK-2026-0839',
    contato: 'Juliana Costa',
    empresa: 'Agência Criativa',
    canal: 'whatsapp',
    status: 'transferido',
    sla: '0h 45min',
    fila: 'Negociação',
    ultimaMensagem: 'Conversa transferida para Marina Sales.',
    hora: '08:50',
    naoLidas: 1,
    mensagens: [
      { id: 'msg-1', autor: 'ana', nome: 'Ana', texto: 'Olá Juliana! Vi que pediu desconto no plano Enterprise. Vou te transferir para uma pessoa do nosso time comercial, ok?', hora: '08:45' },
      { id: 'msg-2', autor: 'cliente', nome: 'Juliana Costa', texto: 'Perfeito, obrigada!', hora: '08:48' },
      { id: 'msg-3', autor: 'sistema', nome: 'Sistema', texto: 'Handoff aceito por Marina Sales. Conversa atribuída.', hora: '08:50', notaInterna: true },
    ],
  },
  {
    id: 'cv-4',
    protocolo: '#TCK-2026-0838',
    contato: 'Marcos Vinícius',
    empresa: 'Restaurante Sabor & Arte',
    canal: 'instagram',
    status: 'resolvido',
    sla: '5h 10min',
    fila: 'Qualificação',
    ultimaMensagem: 'Dúvida esclarecida. Lead qualificado.',
    hora: '08:10',
    naoLidas: 0,
    mensagens: [
      { id: 'msg-1', autor: 'cliente', nome: 'Marcos Vinícius', texto: 'Vocês atendem restaurantes pequenos?', hora: '07:55' },
      { id: 'msg-2', autor: 'ana', nome: 'Ana', texto: 'Atendemos sim! Temos planos pensados para pequenos negócios como o seu.', hora: '08:05' },
    ],
  },
  {
    id: 'cv-5',
    protocolo: '#TCK-2026-0837',
    contato: 'Patrícia Lima',
    empresa: 'Clínica Vida Saudável',
    canal: 'whatsapp',
    status: 'ativo',
    sla: '0h 30min',
    fila: 'Agendamento',
    ultimaMensagem: 'Vou verificar a agenda e já retorno com horários.',
    hora: '11:05',
    naoLidas: 3,
    mensagens: [
      { id: 'msg-1', autor: 'cliente', nome: 'Patrícia Lima', texto: 'Gostaria de agendar uma reunião para conhecer melhor a proposta.', hora: '10:55' },
      { id: 'msg-2', autor: 'ana', nome: 'Ana', texto: 'Claro! Vou verificar a agenda e já retorno com horários disponíveis.', hora: '11:05' },
    ],
  },
];
