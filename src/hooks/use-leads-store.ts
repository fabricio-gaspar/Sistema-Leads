import { useSyncExternalStore } from "react";
import { LEADS, type Lead, type Stage, type ChatMessage } from "@/lib/leads-data";

let state: Lead[] = LEADS.map((l) => ({ ...l, chat: [...l.chat], timeline: [...l.timeline] }));
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const leadsStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get() {
    return state;
  },
  moveStage(id: string, stage: Stage) {
    state = state.map((l) => (l.id === id ? { ...l, stage } : l));
    emit();
  },
  addMessage(id: string, msg: ChatMessage) {
    state = state.map((l) =>
      l.id === id ? { ...l, chat: [...l.chat, msg], ultimaInteracao: "agora" } : l,
    );
    emit();
  },
};

export function useLeads(): Lead[] {
  return useSyncExternalStore(leadsStore.subscribe, leadsStore.get, leadsStore.get);
}

export function useLead(id: string): Lead | undefined {
  const leads = useLeads();
  return leads.find((l) => l.id === id);
}
