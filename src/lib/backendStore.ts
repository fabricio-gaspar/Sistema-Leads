import { supabase } from '@/lib/supabase';
import { sessionContext } from '@/lib/sessionContext';
import { createContextStore } from '@/lib/contextStore';

export interface BackendStore<T> {
  get: () => T;
  set: (updater: (prev: T) => T) => void;
  useStore: () => T;
  bindSet: () => (updater: (prev: T) => T) => void;
  refresh: () => Promise<void>;
}

export function createBackendStore<T>(moduleKey: string, legacyKey: string, inicial: T): BackendStore<T> {
  // Legacy cache has no owner/org provenance. Never read it or seed it remotely.
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(legacyKey); } catch { /* Optional cleanup only. */ }
  const initial = () => structuredClone(Array.isArray(inicial) ? [] as T : inicial);
  const store = createContextStore<T>({
    initial,
    load: async (context) => {
      const { data, error } = await supabase.from('organization_module_data').select('data')
        .eq('organization_id', context.organizationId).eq('module_key', moduleKey).maybeSingle();
      sessionContext.assertCurrent(context);
      if (error) throw error;
      return data?.data == null ? initial() : (Array.isArray(inicial) ? data.data as T : { ...inicial, ...data.data });
    },
    save: async (_previous, next, context) => {
      sessionContext.assertCurrent(context);
      const { error } = await supabase.from('organization_module_data').upsert({
        organization_id: context.organizationId, module_key: moduleKey, data: next,
        updated_by: context.userId, updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,module_key' });
      sessionContext.assertCurrent(context);
      if (error) throw error;
      return next;
    },
  });
  const bindSet = () => { const update = store.bindUpdate(); return (updater: (prev: T) => T) => { void update(updater); }; };
  return { get: store.get, set: (updater) => { void store.update(updater); }, bindSet, useStore: store.useData, refresh: store.refresh };
}
