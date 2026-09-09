import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { integracoes as integrationDescriptors } from '@/mocks/businessData';
import type { Integracao } from '@/mocks/businessData';
import { supabase } from '@/lib/supabase';

export type OperationalIntegration = Integracao & {
  remoteKey: 'whatsapp' | 'ai' | 'apify' | 'google_places';
  operationalCategory: 'prospecting' | 'communication' | 'intelligence' | 'scheduling' | 'system';
  connected: boolean;
  enabled: boolean;
  paused: boolean;
  lastError: string | null;
  lastTestedAt: string | null;
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
    status: 'pendente',
    ultimoTeste: 'Nunca testada',
    remoteKey: key,
    operationalCategory: key === 'whatsapp' ? 'communication' : key === 'ai' ? 'intelligence' : 'prospecting',
    connected: false,
    enabled: false,
    paused: false,
    lastError: null,
    lastTestedAt: null,
  };
}

function statusFromRemote(remote: { connected: boolean; enabled: boolean; paused: boolean; last_error: string | null }) {
  if (remote.last_error || remote.paused) return 'erro' as const;
  if (remote.connected && remote.enabled) return 'conectado' as const;
  return 'pendente' as const;
}

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
    .select('key,category,connected,enabled,paused,status_detail,last_error,last_tested_at')
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
    return {
      ...descriptor,
      remoteKey: key,
      operationalCategory: (remote.category === 'prospecting' || remote.category === 'communication' || remote.category === 'intelligence' || remote.category === 'scheduling' || remote.category === 'system')
        ? remote.category
        : (key === 'whatsapp' ? 'communication' : key === 'ai' ? 'intelligence' : 'prospecting'),
      status: statusFromRemote(remote),
      ultimoTeste: remote.last_tested_at ? new Date(remote.last_tested_at).toLocaleString('pt-BR') : 'Nunca testada',
      descricao: remote.status_detail || descriptor.descricao,
      connected: Boolean(remote.connected),
      enabled: Boolean(remote.enabled),
      paused: Boolean(remote.paused),
      lastError: remote.last_error ?? null,
      lastTestedAt: remote.last_tested_at ?? null,
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
