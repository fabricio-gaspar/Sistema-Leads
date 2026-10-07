import { createBackendStore } from '@/lib/backendStore';

// Tipo de documento gerenciável (contrato, NDA, termo, checklist, recibo).
export type TipoDocumento = 'contrato' | 'nda' | 'termo' | 'checklist' | 'recibo' | 'outro';

export const TIPOS_DOCUMENTO: { valor: TipoDocumento; rotulo: string }[] = [
  { valor: 'contrato', rotulo: 'Contrato' },
  { valor: 'nda', rotulo: 'NDA' },
  { valor: 'termo', rotulo: 'Termo de serviço' },
  { valor: 'checklist', rotulo: 'Checklist' },
  { valor: 'recibo', rotulo: 'Recibo' },
  { valor: 'outro', rotulo: 'Outro' },
];

export function rotuloTipoDocumento(tipo: TipoDocumento): string {
  return TIPOS_DOCUMENTO.find((t) => t.valor === tipo)?.rotulo || tipo;
}

// Template de documento com variáveis {variavel} resolvidas no momento do uso.
export interface TemplateDocumento {
  id: string;
  nome: string;
  tipo: TipoDocumento;
  conteudo: string;
  variaveis: string[];
  ativo: boolean;
}

const inicial: TemplateDocumento[] = [
  {
    id: 'td-1',
    nome: 'Contrato de prestação de serviços',
    tipo: 'contrato',
    conteudo:
      'CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nPelo presente instrumento, de um lado {empresa_nome}, inscrita no CNPJ {empresa_cnpj}, com sede em {empresa_endereco}, doravante denominada CONTRATADA, e de outro lado {empresa}, representada por {nome}, doravante denominada CONTRATANTE, resolvem celebrar o presente contrato.\n\nCLÁUSULA 1ª — DO OBJETO\nPrestação dos serviços descritos na proposta comercial vinculada a este contrato.\n\nCLÁUSULA 2ª — DO PAGAMENTO\n{forma_pagamento}.\n\nCLÁUSULA 3ª — DO PRAZO\nVigência de 12 (doze) meses, renovável automaticamente.\n\nCLÁUSULA 4ª — DA GARANTIA\n{garantia}.\n\nE por estarem justas e contratadas, assinam o presente.\n\n{assinatura}',
    variaveis: ['nome', 'empresa', 'empresa_nome', 'empresa_cnpj', 'empresa_endereco', 'forma_pagamento', 'garantia', 'assinatura'],
    ativo: true,
  },
  {
    id: 'td-2',
    nome: 'NDA — Acordo de confidencialidade',
    tipo: 'nda',
    conteudo:
      'ACORDO DE CONFIDENCIALIDADE (NDA)\n\nAs partes {empresa_nome} e {empresa} comprometem-se a manter sigilo sobre todas as informações estratégicas, comerciais e técnicas compartilhadas durante a negociação e execução dos serviços.\n\nAs informações confidenciais não poderão ser divulgadas a terceiros sem autorização prévia por escrito, permanecendo esta obrigação vigente por 5 (cinco) anos após o encerramento da relação.\n\n{assinatura}',
    variaveis: ['empresa', 'empresa_nome', 'assinatura'],
    ativo: true,
  },
  {
    id: 'td-3',
    nome: 'Termo de serviço',
    tipo: 'termo',
    conteudo:
      'TERMO COMERCIAL\n\nA {empresa_nome} fornece soluções industriais conforme as especificações descritas na proposta revisada.\n\n1. Escopo: limitado aos itens e requisitos confirmados na proposta.\n2. Informações técnicas: dependem dos dados, desenhos e amostras fornecidos e validados.\n3. Confidencialidade: dados tratados conforme a LGPD e as políticas aprovadas da empresa.\n\nDúvidas: {empresa_email}.\n\n{assinatura}',
    variaveis: ['empresa_nome', 'empresa_email', 'assinatura'],
    ativo: true,
  },
  {
    id: 'td-4',
    nome: 'Checklist de onboarding',
    tipo: 'checklist',
    conteudo:
      'CHECKLIST DE ONBOARDING — {empresa}\n\n[ ] Reunião de kickoff agendada\n[ ] Acessos coletados (site, redes, anúncios)\n[ ] Briefing e materiais de marca recebidos\n[ ] Contrato assinado\n[ ] Escopo e cronograma confirmados\n[ ] Cronograma validado com o cliente\n\nResponsável: {assinatura}',
    variaveis: ['empresa', 'assinatura'],
    ativo: true,
  },
];

const STORAGE_KEY = 'leadai_templates_documento_v1';
const store = createBackendStore<TemplateDocumento[]>('templates_documento', STORAGE_KEY, inicial);

export function useTemplatesDocumentoStore() {
  const templates = store.useStore();
  const setStore = store.bindSet();

  const atualizar = (id: string, mudanca: Partial<TemplateDocumento>) => {
    setStore((prev) => prev.map((t) => (t.id === id ? { ...t, ...mudanca } : t)));
  };

  const adicionar = (t: TemplateDocumento) => {
    setStore((prev) => [...prev, t]);
  };

  const excluir = (id: string) => {
    setStore((prev) => prev.filter((t) => t.id !== id));
  };

  return { templates, atualizar, adicionar, excluir };
}
