import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNotifications, markAllNotificationsRead } from "@/lib/crm.functions";

export type NotificationKind = "ana" | "lead" | "orcamento" | "pedido" | "sistema";

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  desc: string;
  at: string;
  read: boolean;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}

export function useNotifications(): Notification[] {
  const listFn = useServerFn(listNotifications);
  const { data = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });
  return data.map((n) => ({
    id: n.id,
    kind: (["ana", "lead", "orcamento", "pedido", "sistema"].includes(n.kind)
      ? n.kind
      : "sistema") as NotificationKind,
    title: n.title,
    desc: n.description ?? "",
    at: timeAgo(n.created_at),
    read: n.read,
  }));
}

export function useNotificationsActions() {
  const qc = useQueryClient();
  const markAllFn = useServerFn(markAllNotificationsRead);
  return {
    markAllRead: async () => {
      await markAllFn();
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["sidebar-counts"] });
    },
  };
}
