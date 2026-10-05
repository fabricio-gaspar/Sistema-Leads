import { createContextStore } from '@/lib/contextStore';
import { regrasComerciais } from '@/mocks/comercialData';
import type { RegraHandoff } from '@/mocks/anaComercial';
import { loadOperationalCompanySettings, persistOperationalCompanySettings } from '@/lib/crm/organizationSettingsRepository';

export interface Organizacao {
  nome: string;
  nomeComercial: string;
  cnpj: string;
  site: string;
  email: string;
  telefone: string;
  endereco: string;
  fusoHorario: string;
  idioma: string;
  assinaturaComercial: string;
  whatsapp?: string;
  social_media?: { linkedin: string; instagram: string; facebook: string };
}

export interface EmpresaSettings {
  organizacao: Organizacao;
  ramo: string;
  regiao: string;
  publico: string;
  diferenciais: string[];
  saudacao: string;
  corBalao: string;
  assinatura: string;
  horario: string;
  limiteMensagens: number;
  handoff: RegraHandoff[];
  consentimento: string;
  regras: typeof regrasComerciais;
}

export const EMPTY_EMPRESA_SETTINGS: EmpresaSettings = {
  organizacao: {
    nome: '', nomeComercial: '', cnpj: '', site: '', email: '', telefone: '', endereco: '',
    fusoHorario: 'America/Sao_Paulo', idioma: 'pt-BR', assinaturaComercial: '',
  },
  ramo: '', regiao: '', publico: '', diferenciais: [], saudacao: '', corBalao: '', assinatura: '',
  horario: '', limiteMensagens: 0, handoff: [], consentimento: '',
  regras: {
    descontoMaximoPadrao: 0, descontoExigeAprovacaoAcima: 0, cargoMinimoAprovacao: '',
    anaPodeAplicarDesconto: false, anaDescontoMaximo: 0, validadePropostaDias: 0,
    condicoesPagamentoPadrao: '', prazoEntregaPadraoDias: 0, gerarPdf: false,
    transferirNegociacaoHumano: true, motivoPerdaObrigatorio: true,
  },
};

const store = createContextStore<EmpresaSettings>({
  initial: () => structuredClone(EMPTY_EMPRESA_SETTINGS),
  load: () => loadOperationalCompanySettings(EMPTY_EMPRESA_SETTINGS),
  save: async (_previous, next) => { await persistOperationalCompanySettings(next); return next; },
  optimistic: false,
});

export function useEmpresaSettingsStore() {
  const settings = store.useData();
  const updateState = store.bindUpdate();

  const salvar = (mudanca: Partial<EmpresaSettings>): Promise<void> => {
    return updateState((prev) => ({ ...prev, ...mudanca }));
  };

  const salvarOrganizacao = (org: Organizacao): Promise<void> => {
    return updateState((prev) => ({ ...prev, organizacao: org }));
  };

  return { settings, salvar, salvarOrganizacao };
}

// Acesso imperativo ao snapshot da empresa (para o motor de automação).
export function getEmpresaSettingsSnapshot(): EmpresaSettings {
  return store.get();
}
