export const dashboardStats = {
  totalLeads: 1247,
  leadsAbordados: 856,
  leadsQualificados: 423,
  leadsConvertidos: 187,
  taxaResposta: 68.6,
  taxaFechamento: 44.2,
  faturamento: 284750.50,
  ticketMedio: 1522.73,
};

export const leadsRecentes = [
  { id: '1', nome: 'Carlos Mendes', empresa: 'Tech Solutions Ltda', segmento: 'Tecnologia', cidade: 'São Paulo', estado: 'SP', status: 'Em Qualificação', data: '2026-06-14' },
  { id: '2', nome: 'Ana Oliveira', empresa: 'Construtora Nova Era', segmento: 'Construção Civil', cidade: 'Belo Horizonte', estado: 'MG', status: 'Novo', data: '2026-06-14' },
  { id: '3', nome: 'Roberto Alves', empresa: 'Farmácia Bem Estar', segmento: 'Saúde', cidade: 'Curitiba', estado: 'PR', status: 'Em Contato', data: '2026-06-13' },
  { id: '4', nome: 'Juliana Costa', empresa: 'Agência Criativa', segmento: 'Marketing', cidade: 'Rio de Janeiro', estado: 'RJ', status: 'Fechado — Ganho', data: '2026-06-13' },
  { id: '5', nome: 'Marcos Vinícius', empresa: 'Restaurante Sabor & Arte', segmento: 'Alimentação', cidade: 'Florianópolis', estado: 'SC', status: 'Em Qualificação', data: '2026-06-12' },
];

export const vendasRecentes = [
  { id: '1', lead: 'Juliana Costa', valor: 3500.00, metodo: 'PIX', status: 'Pago', data: '2026-06-13' },
  { id: '2', lead: 'Eduardo Santos', valor: 7200.00, metodo: 'Boleto', status: 'Pendente', data: '2026-06-12' },
  { id: '3', lead: 'Patrícia Lima', valor: 1800.00, metodo: 'Cartão', status: 'Pago', data: '2026-06-11' },
  { id: '4', lead: 'Fernando Gomes', valor: 4500.00, metodo: 'PIX', status: 'Pago', data: '2026-06-10' },
];

export const graficoLeads = [
  { mes: 'Jan', encontrados: 180, abordados: 145, convertidos: 32 },
  { mes: 'Fev', encontrados: 210, abordados: 178, convertidos: 41 },
  { mes: 'Mar', encontrados: 195, abordados: 160, convertidos: 38 },
  { mes: 'Abr', encontrados: 240, abordados: 205, convertidos: 52 },
  { mes: 'Mai', encontrados: 260, abordados: 220, convertidos: 48 },
  { mes: 'Jun', encontrados: 247, abordados: 210, convertidos: 44 },
];