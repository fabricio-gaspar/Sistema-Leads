// Fontes de dados e utilitários do "Agente de Prompt" (gerador de prompt de busca de leads).

export interface CampoL {
  id: string;
  label: string;
}

// Campos que o usuário pode pedir na busca de leads. Os ids refletem os
// atributos reais do modelo de Lead para facilitar a importação futura.
export const camposDisponiveis: CampoL[] = [
  { id: 'nome', label: 'Nome do contato' },
  { id: 'cargo', label: 'Cargo' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'email', label: 'E-mail' },
  { id: 'telefone', label: 'Telefone' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'site', label: 'Site' },
  { id: 'segmento', label: 'Segmento' },
  { id: 'cidade', label: 'Cidade / Estado' },
  { id: 'porte', label: 'Porte' },
  { id: 'cnpj', label: 'CNPJ' },
  { id: 'linkedin', label: 'LinkedIn' },
];

// Monta um prompt de busca estruturado e acionável a partir dos campos
// selecionados e dos critérios informados. Funciona sem IA (fallback local).
// `contextoEmpresa` (opcional) injeta o que a empresa representa para o prompt
// já sair com o tom/público corretos, sem redigir do zero.
export function montarPrompt(
  campos: string[],
  criterios: string,
  contextoEmpresa?: string,
): string {
  const labels = campos
    .map((c) => camposDisponiveis.find((x) => x.id === c)?.label)
    .filter((l): l is string => Boolean(l));

  const lista = labels.map((l) => `- ${l}`).join('\n');

  const blocoContexto = contextoEmpresa
    ? `CONTEXTO DA SUA EMPRESA (use este tom e público nas respostas):
${contextoEmpresa}

`
    : '';

  return `Você é um agente especialista em prospecção de leads B2B. Gere uma lista de leads com base nos critérios abaixo.

${blocoContexto}CRITÉRIOS DE BUSCA:
${criterios}

CAMPOS A RETORNAR (para cada lead, retorne somente estes campos):
${lista}

REGRAS OBRIGATÓRIAS:
1. Retorne a lista em formato JSON estruturado.
2. Remova duplicados (por e-mail ou nome da empresa).
3. Priorize contatos com e-mail e telefone válidos.
4. Indique a fonte/confiabilidade de cada dado quando possível.
5. Se um campo não for encontrado, deixe-o vazio em vez de inventar.`;
}