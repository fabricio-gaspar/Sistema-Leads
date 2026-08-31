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
  if (connectionStatus === 'error') return 'erro';
  if (enabled && connectionStatus === 'connected') return 'ativo';
  if (!enabled && connectionStatus === 'connected') return 'inativo';
  return 'pendente';
}

async function hidratarDoBackend(force = false): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId || (!force && hydratedUser === userId)) return;

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

  // As fontes conhecidas vêm sempre do backend. Nunca mantemos um estado
  // "ativo" só no navegador, pois isso faria a Busca de Leads exibir uma
  // API que não está realmente pronta para executar.
  const fontesConhecidas = fontesLeads.map((base) => {
    const remota = porChave.get(base.sourceKey);
    return remota ?? {
      ...base,
      status: 'pendente',
      connectionStatus: 'not_configured',
      mode: 'sandbox',
      ultimaSincronizacao: '—',
      leadsImportados: 0,
      erros: 0,
    };
  });
  const personalizadas = state.filter((fonte) => !fonte.sourceKey && !fontesLeads.some((base) => base.id === fonte.id));
  state = [...fontesConhecidas, ...personalizadas];
  persistirLocal();
  hydratedUser = userId;
  notify();
}

export interface FontesStore {
  fontes: FonteLead[];
  atualizar: (id: string, mudanca: Partial<FonteLead>) => void;
  definirAtivacao: (id: string, enabled: boolean) => Promise<void>;
  recarregar: () => Promise<void>;
  adicionar: (fonte: FonteLead) => void;
  excluir: (id: string) => void;
}

export function fontesAtivas(fontes: FonteLead[]): FonteLead[] {
  return fontes.filter((fonte) => fonte.status === 'ativo' && fonte.connectionStatus === 'connected');
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
      if (session?.user?.id !== hydratedUser) {
        hydratedUser = null;
        void hidratarDoBackend(true);
      }
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
        .then(({ error }) => {
          if (error) console.error('[fontes] falha ao salvar configuração', error);
          else void hidratarDoBackend(true);
        });
    }
  };

  const definirAtivacao = async (id: string, enabled: boolean) => {
    const fonte = state.find((item) => item.id === id);
    if (!fonte?.remoteId) throw new Error('source_not_configured');
    if (enabled && fonte.connectionStatus !== 'connected') throw new Error('source_not_validated');

    const { error } = await supabase
      .from('lead_source_configs')
      .update({ enabled })
      .eq('id', fonte.remoteId);
    if (error) throw error;
    await hidratarDoBackend(true);
  };

  const recarregar = async () => { await hidratarDoBackend(true); };

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

  return { fontes, atualizar, definirAtivacao, recarregar, adicionar, excluir };
}
