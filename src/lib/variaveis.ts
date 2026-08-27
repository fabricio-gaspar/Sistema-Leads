// Resolução de variáveis {variavel} usada em templates, respostas rápidas,
// propostas e e-mails. Centraliza a substituição por valores reais vindos de
// três fontes: dados do lead, dados da empresa e variáveis personalizadas.
import type { Organizacao } from '@/hooks/useEmpresaSettingsStore';
import type { VariavelGlobal } from '@/hooks/useVariaveisGlobaisStore';

// Variáveis fixas da empresa, mapeadas dos dados de organização preenchidos
// uma única vez. Disponíveis em todo template/proposta/e-mail.
export const VARIAVEIS_EMPRESA: { chave: string; rotulo: string; campo: keyof Organizacao }[] = [
  { chave: 'empresa_nome', rotulo: 'Nome da empresa', campo: 'nome' },
  { chave: 'empresa_nome_comercial', rotulo: 'Nome comercial', campo: 'nomeComercial' },
  { chave: 'empresa_cnpj', rotulo: 'CNPJ', campo: 'cnpj' },
  { chave: 'empresa_site', rotulo: 'Site', campo: 'site' },
  { chave: 'empresa_email', rotulo: 'E-mail', campo: 'email' },
  { chave: 'empresa_telefone', rotulo: 'Telefone', campo: 'telefone' },
  { chave: 'empresa_endereco', rotulo: 'Endereço', campo: 'endereco' },
  { chave: 'assinatura', rotulo: 'Assinatura', campo: 'assinaturaComercial' },
];

export interface ContextoLead {
  nome?: string;
  empresa?: string;
  oferta?: string;
  link?: string;
  segmento?: string;
}

export interface OpcoesValores {
  lead?: ContextoLead | null;
  organizacao?: Organizacao | null;
  customVars?: VariavelGlobal[];
}

// Monta o mapa chave -> valor usado na substituição de variáveis.
export function montarValoresVariaveis(opts: OpcoesValores): Record<string, string> {
  const valores: Record<string, string> = {};

  if (opts.lead) {
    const l = opts.lead;
    if (l.nome) valores.nome = l.nome;
    if (l.empresa) valores.empresa = l.empresa;
    if (l.oferta) valores.oferta = l.oferta;
    if (l.link) valores.link = l.link;
    if (l.segmento) valores.segmento = l.segmento;
  }

  if (opts.organizacao) {
    for (const v of VARIAVEIS_EMPRESA) {
      const valor = opts.organizacao[v.campo];
      if (typeof valor === 'string' && valor) valores[v.chave] = valor;
    }
  }

  if (opts.customVars) {
    for (const v of opts.customVars) {
      if (v.chave && v.valor) valores[v.chave] = v.valor;
    }
  }

  return valores;
}

// Substitui {variavel} pelo valor correspondente. Variáveis sem valor
// permanecem como estão (ex.: {link_agendamento} ainda não definido).
export function resolverVariaveis(texto: string, valores: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (trecho, chave: string) =>
    valores[chave] !== undefined ? valores[chave] : trecho
  );
}