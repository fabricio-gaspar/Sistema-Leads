import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  Sparkles,
  User,
  Phone,
  Mail,
  Loader2,
  MessageCircle,
  Send,
  Clock3,
  CheckCircle2,
  Users,
  Filter,
} from "lucide-react";
import { Card } from "@/components/ui-kit";
import {
  assignLeadToSeller,
  listLeadMessages,
  listLeads,
  listTeam,
} from "@/lib/crm.functions";
import { listOutreach, sendManualWhatsapp } from "@/lib/outreach.functions";
import type { Database } from "@/integrations/supabase/types";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type MsgRow = Database["public"]["Tables"]["lead_messages"]["Row"];
type OutreachRow = Database["public"]["Tables"]["lead_outreach"]["Row"];
type TeamMember = {
  id: string;
  name: string | null;
  email: string | null;
  active: boolean | null;
  roles: string[];
};
type QueueFilter = "todos" | "ia" | "humano" | "pendente" | "encerrados";

export const Route = createFileRoute("/_authenticated/atendimento")({ component: Atendimento });

function Atendimento() {
  const { isAdmin } = Route.useRouteContext();
  const listFn = useServerFn(listLeads);
  const teamFn = useServerFn(listTeam);
  const { data: leads = [], isLoading } = useQuery<LeadRow[]>({
    queryKey: ["leads"],
    queryFn: () => listFn(),
    refetchInterval: 30_000,
  });
  const { data: team = [] } = useQuery<TeamMember[]>({
    queryKey: ["central-team"],
    queryFn: () => teamFn(),
    enabled: isAdmin,
  });

  const sellers = useMemo(
    () => team.filter((m) => m.active !== false && m.roles.includes("vendedor")),
    [team],
  );
  const sellerById = useMemo(
    () => new Map(team.map((member) => [member.id, member.name || member.email || "Vendedor"])),
    [team],
  );

  const [queueFilter, setQueueFilter] = useState<QueueFilter>("todos");
  const [sellerFilter, setSellerFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sellerScoped = useMemo(() => {
    if (!isAdmin || sellerFilter === "todos") return leads;
    if (sellerFilter === "sem-responsavel") return leads.filter((lead) => !responsibleId(lead));
    return leads.filter((lead) => responsibleId(lead) === sellerFilter);
  }, [isAdmin, leads, sellerFilter]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return sellerScoped.filter((lead) => {
      if (term && ![lead.company, lead.contact, lead.email, lead.phone]
        .some((value) => value?.toLocaleLowerCase("pt-BR").includes(term))) return false;
      if (queueFilter === "ia" && lead.owner !== "ia") return false;
      if (queueFilter === "humano" && lead.owner !== "human") return false;
      if (queueFilter === "pendente" && !isPending(lead)) return false;
      if (queueFilter === "encerrados" && !isClosed(lead)) return false;
      if (queueFilter !== "encerrados" && queueFilter !== "todos" && isClosed(lead)) return false;
      return true;
    });
  }, [queueFilter, search, sellerScoped]);

  const current = filtered.find((lead) => lead.id === selectedId) ?? filtered[0] ?? null;
  const contacted = sellerScoped.filter(hasContactAttempt).length;
  const replies = sellerScoped.filter(hasReply).length;
  const qualified = sellerScoped.filter((lead) =>
    ["Qualificado", "Proposta", "Negociação", "Pedido", "Fechado"].includes(lead.stage),
  ).length;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Leads na carteira" value={sellerScoped.length} icon={<Users className="h-4 w-4" />} />
          <Metric label="Contatos tentados" value={contacted} icon={<Send className="h-4 w-4" />} />
          <Metric label="Com resposta" value={replies} icon={<MessageCircle className="h-4 w-4" />} />
          <Metric label="Qualificados ou além" value={qualified} icon={<CheckCircle2 className="h-4 w-4" />} />
        </div>
      )}

      <div className="grid min-h-[680px] gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card padded={false} className="overflow-hidden">
          <div className="space-y-2 border-b border-border-card p-3">
            <div className="flex h-9 items-center gap-2 rounded-md border border-border-card px-3">
              <Search className="h-3.5 w-3.5 text-text-ter" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar lead ou contato..."
                className="flex-1 bg-transparent text-[13px] outline-none"
              />
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-text-ter" />
                <select
                  value={sellerFilter}
                  onChange={(event) => setSellerFilter(event.target.value)}
                  className="h-9 flex-1 rounded-md border border-border-card bg-bg-card px-2 text-[12px] text-text-title outline-none"
                >
                  <option value="todos">Todos os vendedores</option>
                  {sellers.map((seller) => (
                    <option key={seller.id} value={seller.id}>{seller.name || seller.email}</option>
                  ))}
                  <option value="sem-responsavel">Sem vendedor atribuído</option>
                </select>
              </div>
            )}

            <div className="flex flex-wrap gap-1">
              {([
                ["todos", "Todos"],
                ["ia", "Ana"],
                ["humano", "Humano"],
                ["pendente", "Pendentes"],
                ["encerrados", "Encerrados"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setQueueFilter(key)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                    queueFilter === key
                      ? "bg-primary text-primary-foreground"
                      : "text-text-sec hover:bg-bg-general"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ul className="max-h-[calc(100vh-270px)] min-h-[520px] overflow-y-auto">
            {isLoading && <li className="flex justify-center p-6"><Loader2 className="h-4 w-4 animate-spin" /></li>}
            {!isLoading && filtered.length === 0 && (
              <li className="p-6 text-center text-[12px] text-text-sec">Nenhum lead encontrado.</li>
            )}
            {filtered.map((lead) => (
              <LeadQueueItem
                key={lead.id}
                lead={lead}
                selected={current?.id === lead.id}
                responsible={responsibleLabel(lead, sellerById)}
                onSelect={() => setSelectedId(lead.id)}
              />
            ))}
          </ul>
        </Card>

        {current ? (
          <ConversationPane
            lead={current}
            isAdmin={isAdmin}
            sellers={sellers}
            responsible={responsibleLabel(current, sellerById)}
          />
        ) : (
          <Card className="flex min-h-[420px] items-center justify-center text-[13px] text-text-sec">
            Selecione um lead para consultar o histórico.
          </Card>
        )}
      </div>
    </div>
  );
}

function LeadQueueItem({
  lead,
  selected,
  responsible,
  onSelect,
}: {
  lead: LeadRow;
  selected: boolean;
  responsible: string;
  onSelect: () => void;
}) {
  const wait = waitMin(lead.last_contact);
  return (
    <li>
      <button
        onClick={onSelect}
        className={`w-full border-b border-border-card p-3 text-left hover:bg-bg-general ${selected ? "bg-primary/5" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-text-title">{lead.company}</div>
            <div className="truncate text-[11.5px] text-text-sec">{lead.contact || "Contato não informado"}</div>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${lead.owner === "ia" ? "bg-ia-bg text-ia" : "bg-primary/10 text-primary"}`}>
            {lead.owner === "ia" ? "IA" : "Humano"}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] text-text-ter">
          <span className="truncate">{lead.stage} · {responsible}</span>
          <span className="shrink-0">{wait == null ? "Sem contato" : wait < 60 ? `${wait}min` : `${Math.floor(wait / 60)}h`}</span>
        </div>
        <div className="mt-2 flex gap-1">
          {channelBadges(lead).map((channel) => (
            <span key={channel.label} className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${channel.className}`}>
              {channel.label}
            </span>
          ))}
        </div>
      </button>
    </li>
  );
}

function ConversationPane({
  lead,
  isAdmin,
  sellers,
  responsible,
}: {
  lead: LeadRow;
  isAdmin: boolean;
  sellers: TeamMember[];
  responsible: string;
}) {
  const qc = useQueryClient();
  const messagesFn = useServerFn(listLeadMessages);
  const outreachFn = useServerFn(listOutreach);
  const sendFn = useServerFn(sendManualWhatsapp);
  const assignFn = useServerFn(assignLeadToSeller);
  const [text, setText] = useState("");

  const { data: messages = [] } = useQuery<MsgRow[]>({
    queryKey: ["lead-messages", lead.id],
    queryFn: () => messagesFn({ data: { lead_id: lead.id } }),
    refetchInterval: 15_000,
  });
  const { data: attempts = [] } = useQuery<OutreachRow[]>({
    queryKey: ["lead-outreach", lead.id],
    queryFn: () => outreachFn({ data: { lead_id: lead.id } }),
    refetchInterval: 15_000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const result = await sendFn({ data: { lead_id: lead.id, text: text.trim() } });
      if (!result.ok) throw new Error(result.error || "Não foi possível enviar a mensagem.");
      return result;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["lead-messages", lead.id] });
      qc.invalidateQueries({ queryKey: ["lead-outreach", lead.id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
  const assignMutation = useMutation({
    mutationFn: (sellerId: string | null) => assignFn({ data: { lead_id: lead.id, seller_id: sellerId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });

  const canSend = !!(lead.whatsapp || lead.phone) && !lead.opt_out;
  const inferredSeller = sellers.some((seller) => seller.id === lead.owner_id) ? lead.owner_id : null;
  const selectedSeller = lead.assigned_to || (lead.owner === "human" ? inferredSeller : null) || "";

  return (
    <Card padded={false} className="flex min-h-[680px] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-card p-4">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-text-title">{lead.company}</div>
          <div className="text-[12px] text-text-sec">{lead.contact || "Contato não informado"} · {lead.stage}</div>
          <div className="mt-1 text-[11px] text-text-ter">Responsável: {responsible}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <select
              value={selectedSeller}
              disabled={assignMutation.isPending}
              onChange={(event) => assignMutation.mutate(event.target.value || null)}
              className="h-9 rounded-md border border-border-card bg-bg-card px-2 text-[11px] text-text-title"
              title="Direcionar lead para vendedor"
            >
              <option value="">Sem vendedor atribuído</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>{seller.name || seller.email}</option>
              ))}
            </select>
          )}
          {assignMutation.error && <span className="text-[10px] text-error">{assignMutation.error.message}</span>}
          {lead.phone && <a href={`tel:${lead.phone}`} className="rounded-md border border-border-card p-2" title="Ligar"><Phone className="h-3.5 w-3.5" /></a>}
          {lead.email && <a href={`mailto:${lead.email}`} className="rounded-md border border-border-card p-2" title="Enviar e-mail"><Mail className="h-3.5 w-3.5" /></a>}
          {isAdmin && <Link to="/leads/$id" params={{ id: lead.id }} className="rounded-md bg-primary px-3 py-2 text-[11px] font-medium text-primary-foreground">Abrir lead</Link>}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="flex min-h-[420px] flex-col border-r border-border-card">
          <div className="flex-1 space-y-3 overflow-y-auto bg-bg-general p-5">
            {messages.length === 0 && <EmptyHistory />}
            {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
          </div>
          <div className="border-t border-border-card p-3">
            {lead.opt_out && <div className="mb-2 text-[11px] text-error">Contato bloqueado por opt-out/LGPD.</div>}
            {!lead.opt_out && !canSend && <div className="mb-2 text-[11px] text-warm">Cadastre um WhatsApp ou telefone para enviar.</div>}
            {sendMutation.error && <div className="mb-2 text-[11px] text-error">{sendMutation.error.message}</div>}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (text.trim() && canSend && !sendMutation.isPending) sendMutation.mutate();
              }}
            >
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Mensagem via WhatsApp (Z-API)..."
                className="h-10 flex-1 rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none"
              />
              <button
                type="submit"
                disabled={!text.trim() || !canSend || sendMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
              >
                {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </button>
            </form>
          </div>
        </div>

        <aside className="overflow-y-auto bg-bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-text-title">
            <Clock3 className="h-4 w-4" /> Histórico de tentativas
          </div>
          {attempts.length === 0 && <div className="text-[11px] text-text-ter">Nenhuma tentativa registrada.</div>}
          <div className="space-y-3">
            {attempts.map((attempt) => (
              <div key={attempt.id} className="rounded-md border border-border-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase text-text-title">{channelName(attempt.channel)}</span>
                  <StatusBadge status={attempt.status} />
                </div>
                <div className="mt-1 text-[10px] text-text-ter">Tentativa {attempt.attempt} · {formatDate(attempt.created_at)}</div>
                {attempt.content && <div className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-text-sec">{attempt.content}</div>}
                {attempt.error && <div className="mt-2 text-[10px] text-error">{attempt.error}</div>}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Card>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <Card className="flex items-center justify-between">
      <div><div className="text-[22px] font-semibold text-text-title">{value}</div><div className="text-[11px] text-text-sec">{label}</div></div>
      <div className="rounded-full bg-primary/10 p-2.5 text-primary">{icon}</div>
    </Card>
  );
}

function MessageBubble({ message }: { message: MsgRow }) {
  const mine = message.sender !== "client";
  const isAI = message.sender === "ia";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[13px] shadow-sm ${mine ? isAI ? "rounded-br-sm bg-ia text-white" : "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border-card bg-bg-card text-text-title"}`}>
        {mine && <div className="mb-0.5 flex items-center gap-1 text-[10px] opacity-80">{isAI ? <Sparkles className="h-3 w-3" /> : <User className="h-3 w-3" />}{message.sender_name}</div>}
        <div className="whitespace-pre-wrap break-words">{message.text}</div>
        <div className={`mt-1 text-right text-[10px] ${mine ? "opacity-70" : "text-text-ter"}`}>{formatDate(message.sent_at)}</div>
      </div>
    </div>
  );
}

function EmptyHistory() {
  return <div className="rounded-md bg-bg-card p-6 text-center text-[12px] text-text-sec">Nenhuma conversa registrada ainda.</div>;
}

function StatusBadge({ status }: { status: OutreachRow["status"] }) {
  const success = ["sent", "delivered", "read", "replied"].includes(status);
  const failed = ["failed", "skipped"].includes(status);
  return <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${success ? "bg-success-bg text-success" : failed ? "bg-error-bg text-error" : "bg-warm-bg text-warm"}`}>{statusLabel(status)}</span>;
}

function responsibleId(lead: LeadRow) {
  return lead.assigned_to || (lead.owner === "human" ? lead.owner_id : null);
}

function responsibleLabel(lead: LeadRow, names: Map<string, string>) {
  if (lead.assigned_to) return names.get(lead.assigned_to) || "Vendedor atribuído";
  if (lead.owner === "ia") return "Ana (IA)";
  if (lead.owner_id) return names.get(lead.owner_id) || "Vendedor responsável";
  return "Sem responsável";
}

function isClosed(lead: LeadRow) {
  return lead.stage === "Fechado" || lead.stage === "Perdido";
}

function isPending(lead: LeadRow) {
  if (isClosed(lead)) return false;
  if ((lead.stale_hours || 0) >= 24) return true;
  return !!lead.next_action_at && new Date(lead.next_action_at).getTime() <= Date.now();
}

function channelState(lead: LeadRow, key: "whatsapp" | "email" | "phone") {
  const channels = lead.contact_channels;
  if (!channels || Array.isArray(channels) || typeof channels !== "object") return null;
  const value = (channels as Record<string, unknown>)[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function hasContactAttempt(lead: LeadRow) {
  return !!lead.last_contact || ["whatsapp", "email", "phone"].some((channel) => !!channelState(lead, channel as "whatsapp" | "email" | "phone")?.last_attempt_at);
}

function hasReply(lead: LeadRow) {
  return ["whatsapp", "email", "phone"].some((channel) => channelState(lead, channel as "whatsapp" | "email" | "phone")?.last_status === "replied");
}

function channelBadges(lead: LeadRow) {
  const definitions = [
    ["whatsapp", "WhatsApp"],
    ["email", "E-mail"],
    ["phone", "Telefone"],
  ] as const;
  return definitions.flatMap(([key, label]) => {
    const state = channelState(lead, key);
    const available = state?.available === true || (key === "whatsapp" ? !!(lead.whatsapp || lead.phone) : key === "email" ? !!lead.email : !!lead.phone);
    if (!available) return [];
    const status = typeof state?.last_status === "string" ? state.last_status : null;
    return [{ label, className: status === "replied" ? "bg-success-bg text-success" : status === "failed" ? "bg-error-bg text-error" : "bg-bg-general text-text-sec" }];
  });
}

function waitMin(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : Math.max(0, Math.floor((Date.now() - time) / 60_000));
}

function channelName(channel: OutreachRow["channel"]) {
  return channel === "whatsapp" ? "WhatsApp" : channel === "email" ? "E-mail" : "Telefone";
}

function statusLabel(status: OutreachRow["status"]) {
  const labels: Record<OutreachRow["status"], string> = {
    pending: "Pendente",
    sent: "Enviado",
    delivered: "Entregue",
    read: "Lido",
    replied: "Respondido",
    failed: "Falhou",
    skipped: "Ignorado",
  };
  return labels[status];
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
