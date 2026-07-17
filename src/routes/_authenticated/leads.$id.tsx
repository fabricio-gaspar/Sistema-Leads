import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Bot,
  User as UserIcon,
  Send,
  Phone,
  Mail,
  MessageCircle,
  Building2,
  Sparkles,
  UserCheck,
  Clock,
  Plus,
  Trash2,
  Loader2,
  Pause,
  Play,
  ShieldOff,
  Radio,
  CheckCheck,
  AlertTriangle,
} from "lucide-react";
import { formatBRL } from "@/lib/leads-data";
import {
  chatWithAna,
  createLeadMessage,
  deleteLeadTask,
  getLead,
  listLeadMessages,
  listLeadTasks,
  moveLeadStage,
  upsertLeadTask,
} from "@/lib/crm.functions";
import {
  listOutreach,
  pauseAi,
  assumeManually,
  setOptOut,
  startOutreach,
} from "@/lib/outreach.functions";
import { TempBadge } from "./leads";
import type { Database } from "@/integrations/supabase/types";


type Stage = Database["public"]["Enums"]["lead_stage"];
const STAGES: Stage[] = ["Prospecção", "Qualificado", "Proposta", "Negociação", "Pedido", "Fechado", "Perdido"];

export const Route = createFileRoute("/_authenticated/leads/$id")({
  component: LeadDetail,
  notFoundComponent: () => (
    <div className="rounded-lg border border-border-card bg-bg-card p-8 text-center">
      <p className="text-text-sec">Lead não encontrado.</p>
      <Link to="/leads" className="mt-3 inline-block text-primary hover:underline">
        Voltar para o Kanban
      </Link>
    </div>
  ),
});

function LeadDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const getLeadFn = useServerFn(getLead);
  const listMsgsFn = useServerFn(listLeadMessages);
  const createMsgFn = useServerFn(createLeadMessage);
  const listTasksFn = useServerFn(listLeadTasks);
  const upsertTaskFn = useServerFn(upsertLeadTask);
  const deleteTaskFn = useServerFn(deleteLeadTask);
  const moveFn = useServerFn(moveLeadStage);
  const anaFn = useServerFn(chatWithAna);
  const listOutreachFn = useServerFn(listOutreach);
  const pauseAiFn = useServerFn(pauseAi);
  const assumeFn = useServerFn(assumeManually);
  const optOutFn = useServerFn(setOptOut);
  const startOutreachFn = useServerFn(startOutreach);

  const leadQ = useQuery({ queryKey: ["lead", id], queryFn: () => getLeadFn({ data: { id } }) });
  const msgsQ = useQuery({
    queryKey: ["lead-messages", id],
    queryFn: () => listMsgsFn({ data: { lead_id: id } }),
    enabled: !!leadQ.data,
  });
  const tasksQ = useQuery({
    queryKey: ["lead-tasks", id],
    queryFn: () => listTasksFn({ data: { lead_id: id } }),
    enabled: !!leadQ.data,
  });
  const outreachQ = useQuery({
    queryKey: ["lead-outreach", id],
    queryFn: () => listOutreachFn({ data: { lead_id: id } }),
    enabled: !!leadQ.data,
  });


  const [mode, setMode] = useState<"ia" | "humano">("humano");
  const [text, setText] = useState("");
  const [taskText, setTaskText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgsQ.data?.length]);

  const sendMut = useMutation({
    mutationFn: async (v: { text: string }) => {
      if (mode === "ia") {
        return anaFn({ data: { lead_id: id, user_text: v.text, as_client: false } });
      }
      return createMsgFn({
        data: {
          lead_id: id,
          sender: "human",
          sender_name: "Vendedor",
          type: "human",
          text: v.text,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-messages", id] });
      qc.invalidateQueries({ queryKey: ["lead", id] });
      setText("");
    },
  });

  const stageMut = useMutation({
    mutationFn: (v: { stage: Stage }) => moveFn({ data: { id, stage: v.stage } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const addTaskMut = useMutation({
    mutationFn: (v: { text: string }) => upsertTaskFn({ data: { lead_id: id, text: v.text } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-tasks", id] });
      setTaskText("");
    },
  });

  const toggleTaskMut = useMutation({
    mutationFn: (v: { id: string; text: string; completed: boolean }) =>
      upsertTaskFn({ data: { id: v.id, lead_id: id, text: v.text, completed: v.completed } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-tasks", id] }),
  });

  const delTaskMut = useMutation({
    mutationFn: (v: { id: string }) => deleteTaskFn({ data: { id: v.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-tasks", id] }),
  });

  const pauseMut = useMutation({
    mutationFn: (v: { paused: boolean }) => pauseAiFn({ data: { lead_id: id, paused: v.paused } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead", id] }),
  });
  const assumeMut = useMutation({
    mutationFn: () => assumeFn({ data: { lead_id: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead", id] }),
  });
  const optOutMut = useMutation({
    mutationFn: (v: { opt_out: boolean }) => optOutFn({ data: { lead_id: id, opt_out: v.opt_out } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead", id] }),
  });
  const restartMut = useMutation({
    mutationFn: () => startOutreachFn({ data: { lead_id: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["lead-outreach", id] });
      qc.invalidateQueries({ queryKey: ["lead-messages", id] });
    },
  });


  if (leadQ.isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-text-sec">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando lead…
      </div>
    );
  }
  if (leadQ.error) {
    return <div className="rounded-md bg-error-bg p-4 text-error">{(leadQ.error as Error).message}</div>;
  }
  const lead = leadQ.data;
  if (!lead) throw notFound();

  const send = () => {
    if (!text.trim()) return;
    sendMut.mutate({ text: text.trim() });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/leads"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-card bg-bg-card text-text-sec hover:bg-bg-general"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold text-text-title">{lead.company}</h2>
            <TempBadge t={lead.temp} score={lead.score} />
          </div>
          <div className="text-[12px] text-text-sec">
            {lead.contact ?? "—"}
            {lead.title ? ` · ${lead.title}` : ""}
          </div>
        </div>

        <div className="ml-auto flex items-center rounded-md border border-border-card bg-bg-card p-0.5">
          <button
            onClick={() => setMode("ia")}
            className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-[12px] font-medium transition-colors ${
              mode === "ia" ? "bg-ia-bg text-ia" : "text-text-sec hover:text-text-title"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" /> Ana no comando
          </button>
          <button
            onClick={() => setMode("humano")}
            className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-[12px] font-medium transition-colors ${
              mode === "humano" ? "bg-primary text-primary-foreground" : "text-text-sec hover:text-text-title"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" /> Assumir manualmente
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr_320px]">
        <div className="space-y-4">
          <Card title="Contato">
            <InfoRow icon={Building2} text={`${lead.segment ?? "—"} · ${lead.uf ?? "—"}`} />
            <InfoRow icon={Phone} text={lead.phone ?? "—"} />
            <InfoRow icon={MessageCircle} text={lead.whatsapp ? `WhatsApp: ${lead.whatsapp}` : "WhatsApp: —"} />
            <InfoRow icon={Mail} text={lead.email ?? "—"} />
            <InfoRow icon={Clock} text={`Origem: ${lead.origin ?? "—"}`} />
          </Card>


          <Card title="Negócio">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] uppercase text-text-ter">Valor</span>
              <span className="text-[15px] font-semibold text-text-title">{formatBRL(Number(lead.value || 0))}</span>
            </div>
            <div className="mt-2">
              <span className="text-[11px] uppercase text-text-ter">Estágio</span>
              <select
                value={lead.stage}
                onChange={(e) => stageMut.mutate({ stage: e.target.value as Stage })}
                className="mt-1 w-full rounded-md border border-border-card bg-bg-card px-2 py-1.5 text-[13px]"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2">
              <span className="text-[11px] uppercase text-text-ter">Score</span>
              <div className="mt-1 text-[13px] text-text-body">{lead.score}/100</div>
            </div>
          </Card>

          <Card title="Tarefas">
            <div className="mb-2 flex gap-2">
              <input
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                placeholder="Nova tarefa…"
                className="h-8 flex-1 rounded-md border border-border-card bg-bg-card px-2 text-[12px] outline-none focus:border-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && taskText.trim()) addTaskMut.mutate({ text: taskText.trim() });
                }}
              />
              <button
                onClick={() => taskText.trim() && addTaskMut.mutate({ text: taskText.trim() })}
                className="inline-flex h-8 items-center rounded-md bg-primary px-2 text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <ul className="space-y-1.5">
              {tasksQ.data?.length === 0 && <li className="text-[12px] text-text-ter">Sem tarefas.</li>}
              {tasksQ.data?.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={(e) =>
                      toggleTaskMut.mutate({ id: t.id, text: t.text, completed: e.target.checked })
                    }
                  />
                  <span className={`flex-1 ${t.completed ? "line-through text-text-ter" : "text-text-body"}`}>
                    {t.text}
                  </span>
                  <button
                    onClick={() => delTaskMut.mutate({ id: t.id })}
                    className="text-text-ter hover:text-error"
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="flex h-[70vh] flex-col overflow-hidden rounded-lg border border-border-card bg-bg-card">
          <div className="flex items-center justify-between border-b border-border-card px-4 py-2.5">
            <div className="text-[13px] font-semibold text-text-title">WhatsApp · {lead.whatsapp ?? lead.phone ?? "—"}</div>
            <div
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                mode === "ia" ? "bg-ia-bg text-ia" : "bg-primary-light text-primary"
              }`}
            >
              {mode === "ia" ? <Bot className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
              {mode === "ia" ? "Ana respondendo" : "Vendedor no controle"}
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-bg-general p-4">
            {msgsQ.isLoading && (
              <div className="mt-10 text-center text-[12px] text-text-ter">Carregando conversa…</div>
            )}
            {msgsQ.data?.length === 0 && (
              <div className="mt-10 text-center text-[12px] text-text-ter">
                Nenhuma conversa ainda — envie a primeira mensagem.
              </div>
            )}
            {msgsQ.data?.map((m) => {
              const mine = m.sender !== "client";
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-[13px] shadow-sm ${
                      m.sender === "client"
                        ? "bg-bg-card text-text-body"
                        : m.sender === "ia"
                          ? "bg-ia text-white"
                          : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {mine && (
                      <div className="mb-0.5 flex items-center gap-1 text-[10px] opacity-80">
                        {m.sender === "ia" ? <Bot className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                        {m.sender_name}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    <div className={`mt-1 text-right text-[10px] ${mine ? "opacity-70" : "text-text-ter"}`}>
                      {new Date(m.sent_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border-card p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder={mode === "ia" ? "Instrua a Ana (ex.: responder objeção de preço)…" : "Digite sua mensagem…"}
                className="flex-1 resize-none rounded-md border border-border-card bg-bg-card px-3 py-2 text-[13px] outline-none focus:border-primary"
              />
              <button
                onClick={send}
                disabled={sendMut.isPending}
                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
              >
                {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Card title="Meta">
            <InfoRow icon={Clock} text={`Última: ${lead.last_contact ? new Date(lead.last_contact).toLocaleString("pt-BR") : "—"}`} />
            <InfoRow icon={Clock} text={`Parado há: ${lead.stale_hours ?? 0}h`} />
            <InfoRow icon={UserIcon} text={`Owner: ${lead.owner}`} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border-card bg-bg-card p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-ter">{title}</div>
      {children}
    </div>
  );
}

function InfoRow({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 text-[12px] text-text-body last:mb-0">
      <Icon className="h-3.5 w-3.5 text-text-ter" />
      <span className="truncate">{text}</span>
    </div>
  );
}
