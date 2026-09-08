import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';

type RemoteMode = 'loading' | 'demo' | 'real' | 'unavailable';

// Display only: changing localStorage must never claim that production was enabled.
// An audited server-side mode transition is a separate pending release gate.
export default function ModoExecucaoToggle() {
  const { user } = useAuth();
  const [mode, setMode] = useState<RemoteMode>('loading');
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setMode('loading');
    if (!user) return;
    try {
      const session = await resolveOrganizationSession();
      const { data, error } = await supabase.from('company_settings').select('sandbox_mode')
        .eq('organization_id', session.organizationId).maybeSingle();
      if (error || typeof data?.sandbox_mode !== 'boolean') throw new Error('mode_unavailable');
      if (generation.current === current) setMode(data.sandbox_mode ? 'demo' : 'real');
    } catch {
      if (generation.current === current) setMode('unavailable');
    }
  }, [user]);

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(onFocus, 60_000);
    const channel = user ? supabase.channel(`operational-mode-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, onFocus)
      .subscribe() : null;
    return () => {
      generation.current += 1;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh, user]);

  const labels: Record<RemoteMode, string> = { loading: 'Verificando modo', demo: 'Modo demo', real: 'Modo real', unavailable: 'Modo indisponível' };
  return (
    <button type="button" onClick={() => { void refresh(); }} disabled={mode === 'loading'}
      className="wf-mode-toggle inline-flex min-h-9 items-center gap-2 rounded-full border border-background-200 bg-background-50 px-3 text-xs font-semibold text-foreground-600 disabled:cursor-wait"
      title={mode === 'unavailable' ? 'Não foi possível consultar o modo da empresa. Clique para tentar novamente.' : 'Modo salvo na empresa. Clique para atualizar; o estado das integrações é verificado separadamente.'}
      aria-label={`${labels[mode]}. Atualizar consulta`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${mode === 'real' ? 'bg-primary-500' : mode === 'unavailable' ? 'bg-accent-500' : 'bg-foreground-400'}`} />
      <span aria-live="polite">{labels[mode]}</span>
    </button>
  );
}
