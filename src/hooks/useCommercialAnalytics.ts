import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { loadOperationalLeads } from '@/lib/crm/leadsRepository';
import { loadOperationalProposals } from '@/lib/crm/proposalsRepository';
import { readAllPages } from '@/lib/crm/paginatedRead';
import { analyticsWindow, type ContactEvent, type StageEvent } from '@/domain/commercialAnalytics';
import type { Lead } from '@/mocks/leadsData';
import type { Proposta } from '@/mocks/propostasData';

interface Snapshot { organizationId: string; leads: Lead[]; proposals: Proposta[]; contacts: ContactEvent[]; stages: StageEvent[]; updatedAt: string; historyError: boolean; contactError: boolean; }
export function useCommercialAnalytics() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'polling' | 'offline'>('connecting');
  const mounted = useRef(true); const busy = useRef(false);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true; setLoading(true);
    try {
      const session = await resolveOrganizationSession();
      if (mounted.current) {
        setOrganizationId(session.organizationId);
        setSnapshot((previous) => previous?.organizationId === session.organizationId ? previous : null);
      }
      const since = `${[analyticsWindow('90').start, analyticsWindow('year').start].sort()[0]}T00:00:00-03:00`;
      const [leads, proposals, stages, contacts] = await Promise.all([
        loadOperationalLeads(session.organizationId), loadOperationalProposals(session.organizationId),
        readAllPages<StageEvent>((from, to) => supabase.from('lead_stage_history').select('id,lead_id,from_stage,to_stage,created_at').eq('organization_id', session.organizationId).gte('created_at', since).order('created_at').order('id').range(from, to)).then((rows) => ({ rows, error: false })).catch(() => ({ rows: [] as StageEvent[], error: true })),
        readAllPages<ContactEvent>((from, to) => supabase.from('lead_messages').select('id,lead_id,sender,type,created_at,sent_at').eq('organization_id', session.organizationId).or(`created_at.gte.${since},sent_at.gte.${since}`).in('type', ['sent', 'received']).order('id').range(from, to)).then((rows) => ({ rows, error: false })).catch(() => ({ rows: [] as ContactEvent[], error: true })),
      ]);
      const current = await resolveOrganizationSession();
      if (current.organizationId !== session.organizationId) { if (mounted.current) { setSnapshot(null); setOrganizationId(current.organizationId); setError(true); } return; }
      if (mounted.current) { setSnapshot({ organizationId: session.organizationId, leads, proposals, stages: stages.rows, contacts: contacts.rows, updatedAt: new Date().toISOString(), historyError: stages.error, contactError: contacts.error }); setError(false); }
    } catch { if (mounted.current) setError(true); }
    finally { busy.current = false; if (mounted.current) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true; let disposed = false; let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void refresh();
    void resolveOrganizationSession().then(({ organizationId }) => {
      if (disposed) return;
      channel = supabase.channel(`commercial-analytics:${organizationId}:${crypto.randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_messages', filter: `organization_id=eq.${organizationId}` }, () => {
          clearTimeout(timer); timer = setTimeout(() => void refresh(), 400);
        }).subscribe((status) => { if (!disposed) setConnection(!navigator.onLine ? 'offline' : status === 'SUBSCRIBED' ? 'live' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'polling' : 'connecting'); });
    }).catch(() => { if (!disposed) setConnection('polling'); });
    const interval = setInterval(() => { if (!document.hidden && navigator.onLine) void refresh(); }, 60_000);
    const onFocus = () => { if (!document.hidden && navigator.onLine) void refresh(); };
    const onOffline = () => setConnection('offline');
    const onOnline = () => { setConnection('polling'); void refresh(); };
    window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('offline', onOffline); window.addEventListener('online', onOnline);
    return () => { mounted.current = false; disposed = true; clearInterval(interval); clearTimeout(timer); if (channel) void supabase.removeChannel(channel); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline); };
  }, [refresh, organizationId]);
  return { snapshot, loading, error, connection, refresh };
}
