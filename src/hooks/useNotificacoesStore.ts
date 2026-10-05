import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBackendStore } from '@/lib/backendStore';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { supabase } from '@/lib/supabase';
import type { Notificacao } from '@/lib/tipos';

const STORAGE_KEY = 'leadai_notificacoes_v1';
const store = createBackendStore<Notificacao[]>('notificacoes', STORAGE_KEY, []);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type NotificationRow = { id: string; title: string; description: string; kind: string; read: boolean; link?: string | null; lead_id?: string | null; priority?: Notificacao['prioridade']; action_required?: boolean; recommended_action?: string | null; status?: Notificacao['status']; created_at: string };
const mapRow = (row: NotificationRow): Notificacao => ({ id: row.id, titulo: row.title, descricao: row.description, tipo: row.kind, lida: row.read, data: row.created_at, link: row.link || undefined, leadId: row.lead_id || undefined, prioridade: row.priority, acaoNecessaria: row.action_required, acaoRecomendada: row.recommended_action || undefined, status: row.status });

export function useNotificacoesStore(): {
  notificacoes: Notificacao[];
  criar: (dados: Omit<Notificacao, 'id' | 'lida' | 'data'>) => Notificacao;
  marcarLida: (id: string) => void;
  marcarTodasLidas: () => void;
  naoLidas: number;
  loading: boolean;
  error: boolean;
} {
  const locais = store.useStore();
  const [remotas, setRemotas] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { organizationId } = await resolveOrganizationSession();
      const { data, error } = await supabase.from('notifications').select('id,title,description,kind,read,link,lead_id,priority,action_required,recommended_action,status,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      setRemotas(((data || []) as NotificationRow[]).map(mapRow));
      setError(false);
    } catch {
      setError(true);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void refresh();
    void resolveOrganizationSession().then(({ organizationId }) => {
      if (disposed) return;
      channel = supabase.channel(`commercial-notifications:${organizationId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `organization_id=eq.${organizationId}` }, () => { void refresh(); }).subscribe();
    }).catch(() => undefined);
    return () => { disposed = true; if (channel) void supabase.removeChannel(channel); };
  }, [refresh]);

  const criar = (dados: Omit<Notificacao, 'id' | 'lida' | 'data'>): Notificacao => {
    const nova: Notificacao = {
      ...dados,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      lida: false,
      data: new Date().toISOString(),
    };
    store.set((prev) => [nova, ...prev]);
    return nova;
  };

  const marcarLida = (id: string) => {
    if (UUID.test(id)) {
      setRemotas((prev) => prev.map((n) => n.id === id ? { ...n, lida: true, status: n.status === 'open' ? 'acknowledged' : n.status } : n));
      const now = new Date().toISOString();
      void supabase.from('notifications').update({ read: true, read_at: now }).eq('id', id);
      void supabase.from('notifications').update({ status: 'acknowledged', acknowledged_at: now }).eq('id', id).eq('status', 'open');
    } else store.set((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
  };

  const marcarTodasLidas = () => {
    setRemotas((prev) => prev.map((n) => ({ ...n, lida: true, status: n.status === 'open' ? 'acknowledged' : n.status })));
    store.set((prev) => prev.map((n) => ({ ...n, lida: true })));
    void resolveOrganizationSession().then(async ({ organizationId }) => {
      const now = new Date().toISOString();
      await supabase.from('notifications').update({ read: true, read_at: now }).eq('organization_id', organizationId).eq('read', false);
      await supabase.from('notifications').update({ status: 'acknowledged', acknowledged_at: now }).eq('organization_id', organizationId).eq('status', 'open');
    });
  };

  const notificacoes = useMemo(() => [...remotas, ...locais].sort((a, b) => Date.parse(b.data) - Date.parse(a.data)), [remotas, locais]);

  return {
    notificacoes,
    criar,
    marcarLida,
    marcarTodasLidas,
    naoLidas: notificacoes.filter((n) => !n.lida).length,
    loading,
    error,
  };
}

export function getNotificacoesSnapshot(): Notificacao[] {
  return store.get();
}
