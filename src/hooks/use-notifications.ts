import { useSyncExternalStore } from "react";

export type Notification = {
  id: string;
  kind: "ana" | "lead" | "orcamento" | "pedido" | "sistema";
  title: string;
  desc: string;
  at: string;
  read: boolean;
};

let state: Notification[] = [
  {
    id: "n1",
    kind: "ana",
    title: "Ana qualificou 2 novos leads",
    desc: "Metalúrgica São Jorge e Grupo Ferronorte foram movidos para o pipeline.",
    at: "há 5 min",
    read: false,
  },
  {
    id: "n2",
    kind: "orcamento",
    title: "Proposta ORC-882 visualizada",
    desc: "Indústria Vitalux abriu a proposta há 3 minutos.",
    at: "há 12 min",
    read: false,
  },
  {
    id: "n3",
    kind: "lead",
    title: "Lead parado há 5 dias",
    desc: "Móveis Aurora sem interação — Ana sugere follow-up.",
    at: "há 1h",
    read: false,
  },
  {
    id: "n4",
    kind: "pedido",
    title: "Pedido PED-441 em produção",
    desc: "BioPharma Latam — previsão de entrega em 12 dias.",
    at: "ontem",
    read: true,
  },
];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const notificationsStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get() {
    return state;
  },
  markAllRead() {
    state = state.map((n) => ({ ...n, read: true }));
    emit();
  },
  push(n: Omit<Notification, "id" | "at" | "read">) {
    state = [
      { ...n, id: `n-${Date.now()}`, at: "agora", read: false },
      ...state,
    ];
    emit();
  },
};

export function useNotifications() {
  return useSyncExternalStore(
    notificationsStore.subscribe,
    notificationsStore.get,
    notificationsStore.get,
  );
}
