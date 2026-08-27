export const canaisComunicacao = [
  { id: 'c-1', nome: 'WhatsApp Business', tipo: 'WhatsApp', remetente: '+55 11 99999-8888', status: 'CONECTADO', webhookUrl: '/api/webhooks/whatsapp/inbound', webhookSecret: 'whs_***', horarioPermitido: '08:00-20:00', limiteDiario: 1000, permiteAna: true, templatesAprovados: 12 },
  { id: 'c-2', nome: 'E-mail Corporativo', tipo: 'E-mail', remetente: 'contato@wayflex.ind.br', status: 'CONECTADO', webhookUrl: '/api/webhooks/email/inbound', webhookSecret: 'whs_***', horarioPermitido: '00:00-23:59', limiteDiario: 5000, permiteAna: true, templatesAprovados: 8 },
];

export const eventosWebhook = [
  { id: 'e-1', canal: 'WhatsApp Business', evento: 'message_received', status: 'sucesso', hora: '2026-08-19 09:15:22' },
  { id: 'e-2', canal: 'WhatsApp Business', evento: 'message_delivered', status: 'sucesso', hora: '2026-08-19 09:15:25' },
  { id: 'e-3', canal: 'E-mail Corporativo', evento: 'email_opened', status: 'sucesso', hora: '2026-08-19 08:42:10' },
  { id: 'e-4', canal: 'WhatsApp Business', evento: 'message_failed', status: 'falha', hora: '2026-08-19 07:30:00' },
  { id: 'e-5', canal: 'E-mail Corporativo', evento: 'bounce', status: 'falha', hora: '2026-08-18 16:20:00' },
];