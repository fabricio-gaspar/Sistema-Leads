import { useEffect, useSyncExternalStore } from 'react';
import { regrasComerciais } from '@/mocks/comercialData';
import { controleAna, regrasHandoffAna } from '@/mocks/anaComercial';
import type { RegraHandoff } from '@/mocks/anaComercial';
import { identidadeAna, assinaturaCta, complianceLgpd } from '@/mocks/empresaExtra';
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

const inicial: EmpresaSettings = {
  organizacao: {
    nome: 'WayFlex Indústria e Comércio',
    nomeComercial: 'Wayflex',
    cnpj: '',
    site: 'https://www.wayflex.ind.br',
    email: 'contato@wayflex.ind.br',
    telefone: '(11) 93288-4074',
    endereco: 'R. Luiz Fornaziero, 134 - Jardim do Paço, Sorocaba - SP, 18087-094',
    fusoHorario: 'America/Sao_Paulo',
    idioma: 'pt-BR',
    assinaturaComercial: 'Wayflex — Soluções industriais em borracha, silicone e poliuretano.',
  },
  ramo: 'Soluções industriais em borracha, silicone e poliuretano, com peças técnicas sob medida para vedação, reposição e projetos especiais.',
  regiao: 'Sorocaba/SP e atendimento comercial para indústrias.',
  publico: 'Indústrias que precisam de peças técnicas, vedações, reposição ou desenvolvimento sob medida; priorizar responsáveis por manutenção, engenharia, compras e produção.',
  diferenciais: [
    'Soluções industriais em borracha, silicone e poliuretano',
    'Desenvolvimento de peças conforme os requisitos fornecidos pelo cliente',
    'Análise técnica sujeita à validação da equipe WayFlex',
  ],
  saudacao: identidadeAna.saudacao,
  corBalao: identidadeAna.corBalao,
  assinatura: assinaturaCta.assinatura,
  horario: controleAna.horarioAtendimento,
  limiteMensagens: controleAna.limiteMensagensPorLeadDia,
  handoff: regrasHandoffAna,
  consentimento: complianceLgpd.consentimento,
  regras: regrasComerciais,
};

let state: EmpresaSettings = inicial;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let writeQueue = Promise.resolve();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = loadOperationalCompanySettings(inicial)
    .then((settings) => {
      state = settings;
      hydrated = true;
      notify();
    })
    .catch((error) => console.error('[organization-settings] falha ao carregar fonte operacional', error))
    .finally(() => { hydratePromise = null; });
  return hydratePromise;
}

function updateState(updater: (previous: EmpresaSettings) => EmpresaSettings): Promise<void> {
  const operation = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const next = updater(state);
      await persistOperationalCompanySettings(next);
      state = next;
      hydrated = true;
      notify();
    });
  writeQueue = operation.catch((error) => {
    console.error('[organization-settings] falha ao salvar fonte operacional', error);
  });
  return operation;
}

export function useEmpresaSettingsStore() {
  const settings = useSyncExternalStore(subscribe, () => state, () => state);
  useEffect(() => { void hydrate(); }, []);

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
  return state;
}
