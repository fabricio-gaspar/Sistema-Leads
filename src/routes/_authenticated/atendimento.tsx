import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Sparkles, User, Phone, Mail, Loader2 } from "lucide-react";
import { Card } from "@/components/ui-kit";
import { listLeads, listLeadMessages, createLeadMessage } from "@/lib/crm.functions";
import type { Database } from "@/integrations/supabase/types";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type MsgRow = Database["public"]["Tables"]["lead_messages"]["Row"];

export const Route = createFileRoute("/_authenticated/atendimento")({ component: Atendimento });

function Atendimento() {
  const listFn = useServerFn(listLeads);
  const { data: leads = [], isLoading } = useQuery<LeadRow[]>({
    queryKey: ["leads"],
    queryFn: () => listFn(),
  });

  const activeLeads = useMemo(
    () => leads.filter((l) => l.stage !== "Fechado" && l.stage !== "Perdido"),
    [leads],
  );

  const [filter, setFilter] = useState<"todos" | "ia" | "humano" | "pendente">("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = activeLeads.filter((l) => {
    if (filter === "ia") return l.owner === "ia";
    if (filter === "humano") return l.owner === "human";
    if (filter === "pendente") return (l.stale_hours ?? 0) >= 24;
    return true;
  });
  const current = filtered.find((l) => l.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "340px 1fr" }}>
      <Card padded={false} className="overflow-hidden">
        <div className="border-b border-border-card p-3">
          <div className="flex h-9 items-center gap-2 rounded-md border border-border-card px-3">
            <Search className="h-3.5 w-3.5 text-text-ter" />
            <input placeholder="Buscar conversa..." className="flex-1 bg-transparent text-[13px] outline-none" />
          </div>
          <div className="mt-2 flex gap-1">
            {[
              ["todos", "Todos"],
              ["ia", "🤖 Ana"],
              ["humano", "👤 Humano"],
              ["pendente", "Pendentes"],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k as never)}
                className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium ${
                  filter === k ? "bg-primary text-primary-foreground" : "text-text-sec hover:bg-bg-general"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <ul className="max-h-[calc(100vh-220px)] overflow-y-auto">
          {isLoading && (
            <li className="flex justify-center p-6 text-text-sec">
              <Loader2 className="h-4 w-4 animate-spin" />
            </li>
          )}
          {!isLoading && filtered.length === 0 && (
            <li className="p-6 text-center text-[12px] text-text-sec">Nenhuma conversa ativa.</li>
          )}
          {filtered.map((l) => {
            const isAI = l.owner === "ia";
            const wait = waitMin(l.last_contact);
            return (
              <li key={l.id}>
                <button
                  onClick={() => setSelectedId(l.id)}
                  className={`w-full border-b border-border-card p-3 text-left hover:bg-bg-general ${
                    current?.id === l.id ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-text-title">{l.company}</div>
                      <div className="truncate text-[11.5px] text-text-sec">{l.contact ?? "—"}</div>
                    </div>
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${isAI ? "bg-ia-bg text-ia" : "bg-primary/10 text-primary"}`}>
                      {isAI ? "🤖" : "👤"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-text-ter">
                    <span>{l.stage} · score {l.score}</span>
                    {wait != null && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          wait > 60 ? "bg-hot-bg text-hot" : wait > 15 ? "bg-warm-bg text-warm" : "bg-cold-bg text-cold"
                        }`}
                        title="Tempo desde último contato"
                      >
                        {wait < 60 ? `${wait}min` : `${Math.floor(wait / 60)}h`}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {current ? <ConversationPane lead={current} /> : <Card>Selecione uma conversa</Card>}
    </div>
  );
}

function ConversationPane({ lead }: { lead: LeadRow }) {
  const qc = useQueryClient();
  const msgsFn = useServerFn(listLeadMessages);
  const sendFn = useServerFn(createLeadMessage);
  const [text, setText] = useState("");

  const { data: messages = [] } = useQuery<MsgRow[]>({
    queryKey: ["lead-messages", lead.id],
    queryFn: () => msgsFn({ data: { lead_id: lead.id } }),
  });

  const sendMut = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          lead_id: lead.id,
          sender: "human",
          sender_name: "Vendedor",
          type: "chat",
          text: text.trim(),
        },
      }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["lead-messages", lead.id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const isAI = lead.owner === "ia";
  const responsavel = isAI ? "Ana (IA)" : "Vendedor";

  return (
    <Card padded={false} className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-card p-4">
        <div>
          <div className="text-[15px] font-semibold text-text-title">{lead.company}</div>
          <div className="text-[12px] text-text-sec">{lead.contact ?? "—"} · {lead.title ?? ""}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isAI ? "bg-ia-bg text-ia" : "bg-primary/10 text-primary"}`}>
            {isAI ? <Sparkles className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {responsavel}
          </span>
          <a href={lead.phone ? `tel:${lead.phone}` : undefined} className="rounded-md border border-border-card p-2 hover:bg-bg-general" title="Ligar">
            <Phone className="h-3.5 w-3.5 text-text-sec" />
          </a>
          <a href={lead.email ? `mailto:${lead.email}` : undefined} className="rounded-md border border-border-card p-2 hover:bg-bg-general" title="E-mail">
            <Mail className="h-3.5 w-3.5 text-text-sec" />
          </a>
          <Link to="/leads/$id" params={{ id: lead.id }} className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover">
            Abrir lead
          </Link>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-bg-general p-6">
        {messages.length === 0 && (
          <div className="rounded-md bg-bg-card p-4 text-center text-[12px] text-text-sec">
            Nenhuma mensagem ainda.
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender !== "client";
          const isMsgAI = m.sender === "ia";
          const time = new Date(m.sent_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-[13px] shadow-sm ${
                mine
                  ? isMsgAI
                    ? "bg-ia text-white rounded-br-sm"
                    : "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-bg-card text-text-title rounded-bl-sm border border-border-card"
              }`}>
                {mine && (
                  <div className="mb-0.5 text-[10px] opacity-80">
                    {isMsgAI ? "🤖 " : "👤 "}{m.sender_name}
                  </div>
                )}
                {m.text}
                <div className={`mt-0.5 text-right text-[10px] ${mine ? "opacity-70" : "text-text-ter"}`}>{time}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border-card p-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() && !sendMut.isPending) sendMut.mutate();
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite uma mensagem..."
            className="flex-1 h-10 rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || sendMut.isPending}
            className="rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
          </button>
        </form>
      </div>
    </Card>
  );
}

function waitMin(lastContact: string | null | undefined): number | null {
  if (!lastContact) return null;
  const t = new Date(lastContact).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 60000);
}
