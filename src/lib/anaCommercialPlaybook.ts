export const DEFAULT_QUALIFICATION_QUESTIONS = [
  'Qual necessidade você quer resolver?',
  'Qual o prazo ou urgência?',
  'Qual escopo, quantidade ou contexto técnico?',
];

export const DEFAULT_HANDOFF_TRIGGERS = [
  'Urgência operacional',
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
