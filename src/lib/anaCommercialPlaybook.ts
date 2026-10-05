export const DEFAULT_QUALIFICATION_QUESTIONS = [
  'Qual aplicação ou problema a peça precisa resolver?',
  'Você possui desenho, amostra ou medidas da peça?',
  'Qual material, condição de uso (temperatura, abrasão ou contato) e quantidade aproximada?',
  'É reposição de uma peça existente ou um novo desenvolvimento?',
  'Qual o prazo necessário para a solução?',
];

export const DEFAULT_HANDOFF_TRIGGERS = [
  'Urgência operacional',
  'Solicitação de especificação técnica fora da base aprovada',
  'Necessidade de análise de desenho, amostra ou viabilidade',
  'Pedido de desconto ou negociação',
  'Reclamação ou insatisfação',
  'Pedido explícito para falar com uma pessoa',
];

export function splitPlaybookLines(value: string, fallback: string[] = []): string[] {
  const lines = value
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
  return lines.length ? lines : fallback;
}

export function joinPlaybookLines(items: string[]): string {
  return items.filter(Boolean).join('\n');
}
