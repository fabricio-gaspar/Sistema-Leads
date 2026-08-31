import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { fontesLeads } from '@/mocks/fontesData';

export type FonteLead = Omit<(typeof fontesLeads[number]), 'sourceKey'> & {
  sourceKey?: string;
  remoteId?: string;
  connectionStatus?: string;
  mode?: string;
};

const STORAGE_KEY = 'leadai_fontes_v1';
let state: FonteLead[] = carregarLocal();
let hydratedUser: string | null = null;
const listeners = new Set<() => void>();

function carregarLocal(): FonteLead[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as FonteLead[];
  } catch {
    // Cache local corrompido não impede a inicialização segura.
  }
  return fontesLeads.map((fonte) => ({ ...fonte }));
}

function persistirLocal(): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* fallback local indisponível */ }
}

function notify(): void { listeners.forEach((listener) => listener()); }

function nomeDaFonte(sourceKey: string, fallback: string): string {
  return fontesLeads.find((fonte) => fonte.sourceKey === sourceKey)?.nome ?? fallback;
}

function statusDaFonte(enabled: boolean, connectionStatus: string | null): string {
  if (enabled && connectionStatus === 'connected') return 'ativo';
  if (connectionStatus === 'error') return 'erro';
  return 'pendente';
}

async function hidratarDoBackend(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId || hydratedUser === userId) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', userId)
    .maybeSingle();
  const organizationId = profile?.active_organization_id as string | null | undefined;
  if (!organizationId) return;

  const { data, error } = await supabase
    .from('lead_source_configs')
    .select('id,source_key,label,enabled,mode,connection_status,last_success_at,last_error_at,last_error')
    .eq('organization_id', organizationId)
    .order('source_key');
  if (error) {
    console.error('[fontes] falha ao carregar configurações reais', error);
    return;
  }
  if (!data || data.length === 0) return;

  const porChave = new Map<string, FonteLead>();
  for (const row of data) {
    if (porChave.has(row.source_key)) continue;
    const base = fontesLeads.find((fonte) => fonte.sourceKey === row.source_key);
    porChave.set(row.source_key, {
      ...(base ?? {
        id: `source-${row.source_key}`,
        sourceKey: row.source_key,
        nome: row.label,
        tipo: 'API',
        status: 'pendente',
        endpoint: '—',
        ultimaSincronizacao: '—',
        leadsImportados: 0,
        erros: 0,
        mapeamento: '—',
        tagsPadrao: [],
      }),
      sourceKey: row.source_key,
      remoteId: row.id,
      nome: nomeDaFonte(row.source_key, row.label),
      status: statusDaFonte(Boolean(row.enabled), row.connection_status),
      connectionStatus: row.connection_status ?? 'not_configured',
      mode: row.mode ?? 'sandbox',
      ultimaSincronizacao: row.last_success_at ? new Date(row.last_success_at).toLocaleString('pt-BR') : (base?.ultimaSincronizacao ?? '—'),
    });
  }

  const personalizadas = state.filter((fonte) => !fonte.sourceKey && !fontesLeads.some((base) => base.id === fonte.id));
  state = [...Array.from(porChave.values()), ...personalizadas];
  persistirLocal();
  hydratedUser = userId;
  notify();
}

export interface FontesStore {
  fontes: FonteLead[];
  atualizar: (id: string, mudanca: Partial<FonteLead>) => void;
  adicionar: (fonte: FonteLead) => void;
  excluir: (id: string) => void;
}

export function fontesAtivas(fontes: FonteLead[]): FonteLead[] {
  return fontes.filter((fonte) => fonte.status === 'ativo');
}

export function normalizarMetricasPorFonte(fontes: FonteLead[]): FonteLead[] {
  const metricasPadrao = new Map(fontesLeads.map((fonte) => [fonte.id, fonte]));
  const repeticoes = new Map<string, number>();
  fontes.forEach((fonte) => {
    const chave = `${fonte.ultimaSincronizacao}|${fonte.leadsImportados}|${fonte.erros}`;
    repeticoes.set(chave, (repeticoes.get(chave) ?? 0) + 1);
  });

  return fontes.map((fonte) => {
    const chave = `${fonte.ultimaSincronizacao}|${fonte.leadsImportados}|${fonte.erros}`;
    const padrao = metricasPadrao.get(fonte.id);
    if (!padrao || (repeticoes.get(chave) ?? 0) < 2 || fonte.remoteId) return fonte;
    return { ...fonte, ultimaSincronizacao: padrao.ultimaSincronizacao, leadsImportados: padrao.leadsImportados, erros: padrao.erros, mapeamento: padrao.mapeamento };
  });
}

export function useFontesStore(): FontesStore {
  const fontes = normalizarMetricasPorFonte(useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => state,
    () => state,
  ));

  useEffect(() => {
    void hidratarDoBackend();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id !== hydratedUser) void hidratarDoBackend();
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const atualizar = (id: string, mudanca: Partial<FonteLead>) => {
    const atual = state.find((fonte) => fonte.id === id);
    state = state.map((fonte) => (fonte.id === id ? { ...fonte, ...mudanca } : fonte));
    persistirLocal();
    notify();
    if (!atual?.remoteId) return;
    const payload: Record<string, unknown> = {};
    if (typeof mudanca.status === 'string') payload.enabled = mudanca.status === 'ativo';
    if (typeof mudanca.mode === 'string') payload.mode = mudanca.mode;
    if (Object.keys(payload).length > 0) {
      void supabase.from('lead_source_configs').update(payload).eq('id', atual.remoteId)
        .then(({ error }) => { if (error) console.error('[fontes] falha ao salvar configuração', error); });
    }
  };

  const adicionar = (fonte: FonteLead) => {
    state = [...state, fonte];
    persistirLocal();
    notify();
  };

  const excluir = (id: string) => {
    const atual = state.find((fonte) => fonte.id === id);
    state = state.filter((fonte) => fonte.id !== id);
    persistirLocal();
    notify();
    if (atual?.remoteId) void supabase.from('lead_source_configs').delete().eq('id', atual.remoteId);
  };

  return { fontes, atualizar, adicionar, excluir };
}
