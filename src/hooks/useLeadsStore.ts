import { createContextStore } from '@/lib/contextStore';
import { normalizarLead } from '@/mocks/leadsData';
import type { Lead } from '@/mocks/leadsData';
import { loadOperationalLeads, persistOperationalLeads } from '@/lib/crm/leadsRepository';
import { persistentLeadId } from '@/lib/crm/leadMapper';

const store = createContextStore<Lead[]>({
  initial: () => [],
  load: async () => loadOperationalLeads(),
  save: (previous, next) => persistOperationalLeads(previous, next),
  normalize: (leads) => leads.map((lead) => normalizarLead({ ...lead, id: persistentLeadId(lead.id) })),
});

export const refreshLeadsStore = store.refresh;

export function useLeadsStore(): [Lead[], React.Dispatch<React.SetStateAction<Lead[]>>] {
  const leads = store.useData();

  const update = store.bindUpdate();
  const setLeads: React.Dispatch<React.SetStateAction<Lead[]>> = (updater) => {
    void update((previous) => typeof updater === 'function' ? updater(previous) : updater);
  };

  return [leads, setLeads];
}

export function useLeadsLoadStatus(): 'loading' | 'ready' | 'error' {
  return store.useStatus();
}

// Acesso imperativo (para orquestradores/handlers sem hook).
export function getLeadsSnapshot(): Lead[] {
  return store.get();
}

// Used when a new relational entity (for example, a lead list) needs to
// reference leads created in the same user action. It preserves the
// synchronous UI contract while allowing the caller to respect foreign keys.
export const waitForLeadsPersistence = store.wait;
