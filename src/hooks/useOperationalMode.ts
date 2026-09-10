import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export type OperationalMode = 'loading' | 'preparing' | 'real' | 'unavailable';

export function useOperationalMode() {
  const { user } = useAuth();
  const [mode, setMode] = useState<OperationalMode>('loading');

  const refresh = useCallback(async () => {
    if (!user) { setMode('unavailable'); return; }
    setMode('loading');
    try {
      const { data: profile, error: profileError } = await supabase.from('profiles').select('active_organization_id').eq('id', user.id).maybeSingle();
      if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
      const { data: company, error: companyError } = await supabase.from('company_settings').select('sandbox_mode').eq('organization_id', profile.active_organization_id).maybeSingle();
      if (companyError || typeof company?.sandbox_mode !== 'boolean') throw new Error('operational_mode_unavailable');
      setMode(company.sandbox_mode ? 'preparing' : 'real');
    } catch { setMode('unavailable'); }
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { mode, refresh, loading: mode === 'loading' };
}
