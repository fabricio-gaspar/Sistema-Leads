import { integracoes as integracoesMock } from '@/mocks/businessData';
import type { Integracao } from '@/mocks/businessData';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'leadai_integracoes_v1';
type StoredIntegration = Integracao & { remoteKey?: string };
let state: StoredIntegration[] = carregarLocal();
let hydratedUser: string | null = null;
const listeners = new Set<() => void>();

function carregarLocal(): StoredIntegration[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoredIntegration[];
  } catch { /* fallback para presets */ }
  return integracoesMock.map((integration) => ({ ...integration }));
}

function persistir(): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* sem cache local */ }
}

function notify(): void { listeners.forEach((listener) => listener()); }

const keyById: Record<string, string> = {
  'int-1': 'whatsapp', 'int-2': 'email', 'int-3': 'instagram', 'int-4': 'voip', 'int-5': 'google_calendar', 'int-6': 'ai', 'int-7': 'apify', 'int-8': 'google_places',
};

async function hidratarDoBackend(force = false): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId || (!force && hydratedUser === userId)) return;
  const { data: profile } = await supabase.from('profiles').select('active_organization_id').eq('id', userId).maybeSingle();
  const organizationId = profile?.active_organization_id as string | null | undefined;
  if (!organizationId) return;
  const { data, error } = await supabase.from('integrations')
    .select('key,provider,connected,enabled,paused,status_detail,last_tested_at')
    .eq('organization_id', organizationId);
  if (error) {
    console.error('[integracoes] falha ao carregar conexões reais', error);
    return;
  }
  const byKey = new Map((data ?? []).map((row) => [row.key, row]));
  state = integracoesMock.map((mock) => {
    const remote = byKey.get(keyById[mock.id]);
    if (!remote) return mock;
    return {
      ...mock,
      status: remote.connected && remote.enabled ? 'conectado' : remote.paused ? 'erro' : 'pendente',
      ultimoTeste: remote.last_tested_at ? new Date(remote.last_tested_at).toLocaleString('pt-BR') : mock.ultimoTeste,
      descricao: remote.status_detail || mock.descricao,
      remoteKey: remote.key,
    };
  });
  persistir();
  hydratedUser = userId;
  notify();
}

export interface IntegracoesStore {
  integracoes: Integracao[];
  atualizar: (id: string, mudanca: Partial<Integracao>) => void;
  conectar: (id: string) => void;
  desconectar: (id: string) => void;
  salvarCredenciais: (id: string, credenciais: Record<string, string>) => void;
  recarregar: () => Promise<void>;
}

export function useIntegracoesStore(): IntegracoesStore {
  const raw = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => state,
    () => state,
  );

  useEffect(() => {
    void hidratarDoBackend();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id !== hydratedUser) {
        hydratedUser = null;
        void hidratarDoBackend(true);
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const integracoes = useMemo(() => {
    const byId = new Map(raw.map((integration) => [integration.id, integration]));
    return integracoesMock.map((mock) => ({ ...mock, ...byId.get(mock.id), campos: mock.campos, nome: mock.nome, icone: mock.icone, categoria: mock.categoria }));
  }, [raw]);

  const atualizar = (id: string, mudanca: Partial<Integracao>) => {
    state = state.map((integration) => integration.id === id ? { ...integration, ...mudanca } : integration);
    persistir();
    notify();
  };

  const conectar = (id: string) => atualizar(id, { status: 'conectado', ultimoTeste: 'agora' });

  const desconectar = (id: string) => atualizar(id, { status: 'pendente' });

  const salvarCredenciais = (id: string, credenciais: Record<string, string>) => {
    // Não persistir tokens/chaves no browser, localStorage ou JSON compartilhado.
    // A próxima fase grava segredos somente no cofre de secrets do backend, por
    // OAuth ou um endpoint administrativo autenticado.
    void credenciais;
    atualizar(id, { credenciais: undefined, status: 'pendente', ultimoTeste: 'Aguardando validação segura' });
  };

  const recarregar = async () => { await hidratarDoBackend(true); };

  return { integracoes, atualizar, conectar, desconectar, salvarCredenciais, recarregar };
}
