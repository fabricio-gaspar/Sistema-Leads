// "Cérebro" local da Ana — sem chamadas externas.
// Gera respostas baseadas em templates e em palavras-chave da mensagem do lead.

type Ctx = { empresa: string; contato: string; segmento: string };

const OPENERS = [
  "Perfeito, {contato}! ",
  "Ótimo, {contato} — anotado. ",
  "Show, {contato}. ",
  "Combinado, {contato}. ",
];

const CLOSERS = [
  " Posso te enviar um resumo por e-mail também?",
  " Consigo te retornar ainda hoje com os próximos passos.",
  " Faz sentido agendarmos 15 min para alinhar detalhes?",
  " Quer que eu já reserve um horário essa semana?",
];

const RULES: { match: RegExp; reply: (c: Ctx) => string }[] = [
  {
    match: /pre[cç]o|valor|quanto custa|or[cç]amento/i,
    reply: (c) =>
      `Vou preparar uma proposta específica para ${c.empresa} com base no volume mencionado. Normalmente enviamos em até 4h úteis — te aviso assim que sair.`,
  },
  {
    match: /prazo|entrega|quando/i,
    reply: () =>
      "Nosso lead time padrão é de 12 a 18 dias úteis; para pedidos urgentes conseguimos priorizar em ~7 dias. Qual data você teria como ideal?",
  },
  {
    match: /pagamento|boleto|pix|cart[aã]o|parcel/i,
    reply: () =>
      "Trabalhamos com Pix, boleto 30/60/90 e cartão em até 12x. Para o primeiro pedido a maioria opta por 30/60/90 com aprovação de crédito.",
  },
  {
    match: /amostra|demonstra[cç][aã]o|demo|teste/i,
    reply: (c) =>
      `Consigo enviar uma amostra técnica para ${c.empresa} sem custo. Me passa o CEP de entrega que despacho ainda essa semana.`,
  },
  {
    match: /concorr[eê]nc|comparar|diferen[cç]a/i,
    reply: (c) =>
      `Boa pergunta. Comparado ao mercado, nosso diferencial no segmento de ${c.segmento} é o lead time reduzido e o SLA de atendimento pós-venda. Posso te mandar 2 cases parecidos?`,
  },
  {
    match: /agenda|reuni[aã]o|call|conversa|falar/i,
    reply: () =>
      "Perfeito. Tenho disponibilidade amanhã 10h ou 15h, ou quinta 9h. Qual encaixa melhor?",
  },
  {
    match: /obrigad|valeu|show|beleza|ok/i,
    reply: (c) => `Eu que agradeço, ${c.contato}! Qualquer dúvida é só chamar por aqui.`,
  },
  {
    match: /n[aã]o.*(interess|agora|momento)/i,
    reply: (c) =>
      `Sem problemas, ${c.contato}. Posso te retornar em 30 dias para reavaliar? Deixo o contato salvo por aqui.`,
  },
];

export function anaReply(userMsg: string, ctx: Ctx): string {
  const rule = RULES.find((r) => r.match.test(userMsg));
  const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)].replace(
    "{contato}",
    ctx.contato.split(" ")[0],
  );
  if (rule) {
    return opener + rule.reply(ctx);
  }
  // fallback
  const closer = CLOSERS[Math.floor(Math.random() * CLOSERS.length)];
  return `${opener}Anotei aqui. Deixa eu confirmar rapidinho com o time e volto com uma resposta objetiva.${closer}`;
}

const LEAD_QUESTIONS = [
  "E o prazo de entrega, como fica?",
  "Vocês parcelam no boleto?",
  "Tem como enviar uma amostra?",
  "Quanto ficaria pra 5.000 peças/mês?",
  "Consigo agendar uma call essa semana?",
  "O que difere vocês da concorrência?",
];

export function simulateLeadMessage(): string {
  return LEAD_QUESTIONS[Math.floor(Math.random() * LEAD_QUESTIONS.length)];
}
