import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { integracoes as integrationDescriptors } from '@/mocks/businessData';
import type { Integracao } from '@/mocks/businessData';
import { supabase } from '@/lib/supabase';
import { integrationDisplayStatus, integrationStatusDetail, type IntegrationDisplayStatus } from '@/lib/crm/operationalStatusPresentation';

export type OperationalIntegration = Omit<Integracao, 'status'> & {
  status: IntegrationDisplayStatus;
  remoteKey: 'whatsapp' | 'ai' | 'apify' | 'google_places';
  operationalCategory: 'prospecting' | 'communication' | 'intelligence' | 'scheduling' | 'system';
  connected: boolean;
  enabled: boolean;
  paused: boolean;
  lastError: string | null;
  lastTestedAt: string | null;
  anaProviderConfiguration: AnaProviderConfiguration | null;
};

export type AnaProviderConfiguration = {
  provider: 'openai' | 'claude';
  model: string;
  openaiModel: string | null;
  claudeModel: string | null;
  openaiConfigured: boolean;
  claudeConfigured: boolean;
  selectedModelValidated: false;
};

const supportedKeys = ['whatsapp', 'ai', 'apify', 'google_places'] as const;
type SupportedKey = typeof supportedKeys[number];

const descriptorByKey: Record<SupportedKey, Integracao> = {
  whatsapp: integrationDescriptors.find((item) => item.id === 'int-1')!,
  ai: integrationDescriptors.find((item) => item.id === 'int-6')!,
  apify: integrationDescriptors.find((item) => item.id === 'int-7')!,
  google_places: integrationDescriptors.find((item) => item.id === 'int-8')!,
};

let state: OperationalIntegration[] = [];
let hydratedUser: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function pendingDescriptor(key: SupportedKey): OperationalIntegration {
  const descriptor = descriptorByKey[key];
  return {
    ...descriptor,
    status: 'not_configured',
    ultimoTeste: 'Nunca testada',
    remoteKey: key,
    operationalCategory: key === 'whatsapp' ? 'communication' : key === 'ai' ? 'intelligence' : 'prospecting',
    connected: false,
    enabled: false,
    paused: false,
    lastError: null,
    lastTestedAt: null,
    anaProviderConfiguration: null,
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function allowedModel(provider: 'openai' | 'claude', value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const model = value.trim();
  const models = provider === 'openai'
    ? ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini']
    : ['claude-sonnet-5', 'claude-haiku-4-5', 'claude-opus-5'];
  return models.includes(model) ? model : null;
}

function publicBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

function anaProviderConfiguration(value: unknown): AnaProviderConfiguration | null {
  const configuration = asObject(value);
  const provider = configuration.ana_provider;
  if (provider !== 'openai' && provider !== 'claude') return null;
  const model = allowedModel(provider, configuration.ana_model);
  if (!model) return null;
  return {
    provider,
    model,
    openaiModel: allowedModel('openai', configuration.ana_openai_model),
    claudeModel: allowedModel('claude', configuration.ana_claude_model),
    openaiConfigured: publicBoolean(configuration.ana_openai_configured),
    claudeConfigured: publicBoolean(configuration.ana_claude_configured),
    // A configuração pública não é prova de chamada ao modelo. O backend só
    // pode mudar esse estado depois de uma validação explícita do modelo.
    selectedModelValidated: false,
  };
}

export { integrationDisplayStatus };

async function hydrateFromBackend(force = false): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId || (!force && hydratedUser === userId)) return;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', userId)
    .maybeSingle();
  const organizationId = profile?.active_organization_id as string | null | undefined;
  if (profileError || !organizationId) return;

  const { data, error } = await supabase
    .from('integrations')
    // Nunca hidratar o JSON inteiro no navegador: este recorte transporta
    // somente o estado público da Ana, sem a referência do cofre ou chaves.
    .select('key,category,connected,enabled,paused,status_detail,last_error,last_tested_at,ana_provider:configuration->>provedor_principal,ana_model:configuration->>modelo_principal,ana_openai_model:configuration->>openai_model,ana_claude_model:configuration->>claude_model,ana_openai_configured:configuration->>openai_configurado,ana_claude_configured:configuration->>claude_configurado')
    .eq('organization_id', organizationId)
    .in('key', [...supportedKeys]);
  if (error) {
    console.error('[integracoes] falha ao carregar conexões operacionais', error);
    return;
  }

  const byKey = new Map((data ?? []).map((row) => [row.key as SupportedKey, row]));
  state = supportedKeys.map((key) => {
    const descriptor = descriptorByKey[key];
    const remote = byKey.get(key);
    if (!remote) return pendingDescriptor(key);
    const statusInput = {
      key,
      connected: Boolean(remote.connected),
      enabled: Boolean(remote.enabled),
      paused: Boolean(remote.paused),
      lastError: remote.last_error ?? null,
      lastTestedAt: remote.last_tested_at ?? null,
    };
    return {
      ...descriptor,
      remoteKey: key,
      operationalCategory: (remote.category === 'prospecting' || remote.category === 'communication' || remote.category === 'intelligence' || remote.category === 'scheduling' || remote.category === 'system')
        ? remote.category
        : (key === 'whatsapp' ? 'communication' : key === 'ai' ? 'intelligence' : 'prospecting'),
      status: integrationDisplayStatus(statusInput),
      ultimoTeste: remote.last_tested_at ? new Date(remote.last_tested_at).toLocaleString('pt-BR') : 'Nunca testada',
      descricao: integrationStatusDetail(statusInput, remote.status_detail || descriptor.descricao),
      connected: Boolean(remote.connected),
      enabled: Boolean(remote.enabled),
      paused: Boolean(remote.paused),
      lastError: remote.last_error ?? null,
      lastTestedAt: remote.last_tested_at ?? null,
      anaProviderConfiguration: key === 'ai' ? anaProviderConfiguration(remote) : null,
    };
  });
  hydratedUser = userId;
  notify();
}

export interface IntegracoesStore {
  integracoes: OperationalIntegration[];
  recarregar: () => Promise<void>;
}

export function useIntegracoesStore(): IntegracoesStore {
  const raw = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => state,
    () => state,
  );

  useEffect(() => {
    void hydrateFromBackend();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id !== hydratedUser) {
        hydratedUser = null;
        void hydrateFromBackend(true);
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const integracoes = useMemo(() => raw, [raw]);
  return { integracoes, recarregar: () => hydrateFromBackend(true) };
}
