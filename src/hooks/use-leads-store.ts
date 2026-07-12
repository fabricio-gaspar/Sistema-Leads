import { useSyncExternalStore } from "react";
import { LEADS, type Lead, type Stage, type ChatMessage } from "@/lib/leads-data";
import { anaReply } from "@/lib/ana-brain";
import { notificationsStore } from "@/hooks/use-notifications";

let state: Lead[] = LEADS.map((l) => ({ ...l, chat: [...l.chat], timeline: [...l.timeline] }));
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function nowLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
  // Simula uma nova mensagem do LEAD chegando; se o modo for Ana, ela responde sozinha depois de 1.2s.
  receiveLeadMessage(id: string, text: string, anaResponds: boolean) {
    const lead = state.find((l) => l.id === id);
    if (!lead) return;
    this.addMessage(id, {
      id: `m-${Date.now()}`,
      from: "lead",
      at: nowLabel(),
      text,
    });
    if (anaResponds) {
      setTimeout(() => {
        const reply = anaReply(text, {
          empresa: lead.empresa,
          contato: lead.contato,
          segmento: lead.segmento,
        });
        this.addMessage(id, {
          id: `m-${Date.now() + 1}`,
          from: "ana",
          at: nowLabel(),
          text: reply,
        });
        notificationsStore.push({
          kind: "ana",
          title: `Ana respondeu ${lead.empresa}`,
          desc: reply.slice(0, 80) + (reply.length > 80 ? "…" : ""),
        });
      }, 1200);
    }
  },
};

export function useLeads(): Lead[] {
  return useSyncExternalStore(leadsStore.subscribe, leadsStore.get, leadsStore.get);
}

export function useLead(id: string): Lead | undefined {
  const leads = useLeads();
  return leads.find((l) => l.id === id);
}
