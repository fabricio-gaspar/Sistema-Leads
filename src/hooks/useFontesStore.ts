import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { fontesLeads } from '@/mocks/fontesData';

export type FonteLead = Omit<(typeof fontesLeads[number]), 'sourceKey'> & {
  sourceKey?: string;
  remoteId?: string;
  connectionStatus?: string;
  mode?: string;
  lastError?: string | null;
};

let state: FonteLead[] = [];
let hydratedUser: string | null = null;
const listeners = new Set<() => void>();

function notify() { listeners.forEach((listener) => listener()); }

function statusDaFonte(enabled: boolean, connectionStatus: string | null, lastError: string | null): FonteLead['status'] {
  if (lastError || connectionStatus === 'error') return 'erro';
  if (enabled && connectionStatus === 'connected') return 'ativo';
  if (!enabled && connectionStatus === 'connected') return 'inativo';
  return 'pendente';
}

async function hydrateFromBackend(force = false): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId || (!force && hydratedUser === userId)) return;
  const { data: profile, error: profileError } = await supabase.from('profiles').select('active_organization_id').eq('id', userId).maybeSingle();
  const organizationId = profile?.active_organization_id as string | null | undefined;
  if (profileError || !organizationId) return;

  const { data, error } = await supabase
    .from('lead_source_configs')
    .select('id,source_key,label,enabled,mode,connection_status,last_success_at,last_error_at,last_error')
    .eq('organization_id', organizationId)
    .order('source_key');
  if (error) { console.error('[fontes] falha ao carregar configurações operacionais', error); return; }

  state = (data ?? []).map((row) => {
    const descriptor = fontesLeads.find((source) => source.sourceKey === row.source_key);
    return {
      id: descriptor?.id || `source-${row.source_key}`,
      sourceKey: row.source_key,
      remoteId: row.id,
      nome: row.label || descriptor?.nome || row.source_key,
      tipo: descriptor?.tipo || 'API',
      endpoint: descriptor?.endpoint || 'Configurado no provedor',
      mapeamento: descriptor?.mapeamento || 'Campos definidos pelo provedor',
      tagsPadrao: descriptor?.tagsPadrao || [],
      leadsImportados: 0,
      erros: 0,
      ultimaSincronizacao: row.last_success_at ? new Date(row.last_success_at).toLocaleString('pt-BR') : 'Nunca testada',
      status: statusDaFonte(Boolean(row.enabled), row.connection_status, row.last_error),
      connectionStatus: row.connection_status || 'not_configured',
      mode: row.mode || 'sandbox',
      lastError: row.last_error,
    };
  });
  hydratedUser = userId;
  notify();
}

export interface FontesStore {
  fontes: FonteLead[];
  definirAtivacao: (id: string, enabled: boolean) => Promise<void>;
  recarregar: () => Promise<void>;
}

export function fontesAtivas(fontes: FonteLead[]): FonteLead[] {
  return fontes.filter((fonte) => fonte.status === 'ativo' && fonte.connectionStatus === 'connected');
}

const PROSPECTING_API_KEYS = new Set(['apify', 'google_places']);

export function fontesApiProspeccao(fontes: FonteLead[]): FonteLead[] {
  return fontes.filter((fonte) => fonte.sourceKey && PROSPECTING_API_KEYS.has(fonte.sourceKey));
}

// Mantido como função pura para preservar o comportamento de normalização da busca manual e seus testes.
export function normalizarMetricasPorFonte(fontes: FonteLead[]): FonteLead[] {
  const metricasPadrao = new Map(fontesLeads.map((fonte) => [fonte.id, fonte]));
  const repeticoes = new Map<string, number>();
  fontes.forEach((fonte) => {
    const key = `${fonte.ultimaSincronizacao}|${fonte.leadsImportados}|${fonte.erros}`;
    repeticoes.set(key, (repeticoes.get(key) || 0) + 1);
  });
  return fontes.map((fonte) => {
    const key = `${fonte.ultimaSincronizacao}|${fonte.leadsImportados}|${fonte.erros}`;
    const padrão = metricasPadrao.get(fonte.id);
    if (!padrão || (repeticoes.get(key) || 0) < 2 || fonte.remoteId) return fonte;
    return { ...fonte, ultimaSincronizacao: padrão.ultimaSincronizacao, leadsImportados: padrão.leadsImportados, erros: padrão.erros, mapeamento: padrão.mapeamento };
  });
}

export function useFontesStore(): FontesStore {
  const fontes = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => state,
    () => state,
  );
  useEffect(() => {
    void hydrateFromBackend();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id !== hydratedUser) { hydratedUser = null; void hydrateFromBackend(true); }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const definirAtivacao = useCallback(async (id: string, enabled: boolean) => {
    const source = state.find((item) => item.id === id);
    if (!source?.remoteId) throw new Error('source_not_configured');
    if (enabled && source.connectionStatus !== 'connected') throw new Error('source_not_validated');
    const { error } = await supabase.from('lead_source_configs').update({ enabled }).eq('id', source.remoteId);
    if (error) throw error;
    await hydrateFromBackend(true);
  }, []);

  const recarregar = useCallback(() => hydrateFromBackend(true), []);

  return { fontes, definirAtivacao, recarregar };
}
