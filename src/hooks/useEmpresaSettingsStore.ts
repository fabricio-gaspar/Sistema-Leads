import { useEffect, useSyncExternalStore } from 'react';
import { diferenciais } from '@/mocks/businessData';
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
    nome: '',
    nomeComercial: '',
    cnpj: '',
    site: '',
    email: '',
    telefone: '',
    endereco: '',
    fusoHorario: 'America/Sao_Paulo',
    idioma: 'pt-BR',
    assinaturaComercial: '',
  },
  ramo: '',
  regiao: '',
  publico: '',
  diferenciais,
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

function updateState(updater: (previous: EmpresaSettings) => EmpresaSettings): void {
  state = updater(state);
  notify();
  writeQueue = writeQueue
    .then(() => persistOperationalCompanySettings(state))
    .catch((error) => {
      console.error('[organization-settings] falha ao salvar fonte operacional', error);
      void hydrate();
    });
}

export function useEmpresaSettingsStore() {
  const settings = useSyncExternalStore(subscribe, () => state, () => state);
  useEffect(() => { void hydrate(); }, []);

  const salvar = (mudanca: Partial<EmpresaSettings>) => {
    updateState((prev) => ({ ...prev, ...mudanca }));
  };

  const salvarOrganizacao = (org: Organizacao) => {
    updateState((prev) => ({ ...prev, organizacao: org }));
  };

  return { settings, salvar, salvarOrganizacao };
}

// Acesso imperativo ao snapshot da empresa (para o motor de automação).
export function getEmpresaSettingsSnapshot(): EmpresaSettings {
  return state;
}
