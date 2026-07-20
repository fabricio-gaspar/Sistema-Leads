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
  createLeadNote,
  deleteLeadNote,
  deleteLeadTask,
  getLead,
  listAssignmentHistory,
  listLeadMessages,
  listLeadNotes,
  listLeadTasks,
  listStageHistory,
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
          <ContactChannelsCard lead={lead} />
          <WarmingStrategyCard
            lead={lead}
            outreach={outreachQ.data ?? []}
            onPause={(paused) => pauseMut.mutate({ paused })}
            onAssume={() => assumeMut.mutate()}
            onOptOut={(v) => optOutMut.mutate({ opt_out: v })}
            onRestart={() => restartMut.mutate()}
            busy={pauseMut.isPending || assumeMut.isPending || optOutMut.isPending || restartMut.isPending}
          />
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

type ChannelKey = "whatsapp" | "email" | "phone";
type ChannelStatus = { available: boolean; last_status?: string | null; last_attempt_at?: string | null };

const CHANNEL_META: Record<ChannelKey, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  email: { label: "E-mail", icon: Mail },
  phone: { label: "Telefone", icon: Phone },
};

function statusLabel(s?: string | null) {
  switch (s) {
    case "pending": return "aguardando";
    case "sent": return "enviada";
    case "delivered": return "entregue";
    case "read": return "lida";
    case "replied": return "respondeu";
    case "failed": return "falhou";
    case "skipped": return "pulou";
    default: return "disponível";
  }
}

function statusTone(s?: string | null) {
  if (s === "replied") return "bg-success-bg text-success";
  if (s === "delivered" || s === "read" || s === "sent") return "bg-primary/10 text-primary";
  if (s === "failed" || s === "skipped") return "bg-hot-bg text-hot";
  if (s === "pending") return "bg-warm-bg text-warm";
  return "bg-bg-general text-text-sec";
}

function ContactChannelsCard({ lead }: { lead: any }) {
  const channels = (lead.contact_channels ?? {}) as Record<ChannelKey, ChannelStatus>;
  const recommended: ChannelKey =
    (["whatsapp", "email", "phone"] as ChannelKey[]).find((c) => channels[c]?.available && channels[c]?.last_status !== "failed") ?? "whatsapp";
  return (
    <Card title="Canais de contato">
      <div className="space-y-2">
        {(["whatsapp", "email", "phone"] as ChannelKey[]).map((c) => {
          const Icon = CHANNEL_META[c].icon;
          const s = channels[c];
          return (
            <div key={c} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px] text-text-body">
                <Icon className="h-3.5 w-3.5 text-text-ter" />
                <span className={s?.available ? "" : "text-text-ter line-through"}>{CHANNEL_META[c].label}</span>
                {c === recommended && s?.available && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ia-bg px-1.5 py-0.5 text-[10px] font-medium text-ia">
                    <Radio className="h-2.5 w-2.5" /> recomendado
                  </span>
                )}
              </div>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone(s?.last_status ?? (s?.available ? null : "skipped"))}`}>
                {s?.available ? statusLabel(s.last_status) : "indisponível"}
              </span>
            </div>
          );
        })}
      </div>
      {lead.opt_out && (
        <div className="mt-3 flex items-center gap-1 rounded-md bg-hot-bg px-2 py-1 text-[11px] text-hot">
          <ShieldOff className="h-3 w-3" /> Lead pediu para não receber contato (LGPD)
        </div>
      )}
    </Card>
  );
}

function WarmingStrategyCard({
  lead,
  outreach,
  onPause,
  onAssume,
  onOptOut,
  onRestart,
  busy,
}: {
  lead: any;
  outreach: any[];
  onPause: (paused: boolean) => void;
  onAssume: () => void;
  onOptOut: (v: boolean) => void;
  onRestart: () => void;
  busy: boolean;
}) {
  const active = (lead.active_channel as ChannelKey | null) ?? null;
  const next = lead.next_action_at ? new Date(lead.next_action_at) : null;
  return (
    <Card title="Estratégia de aquecimento">
      <div className="space-y-1.5 text-[12px] text-text-body">
        <div className="flex justify-between">
          <span className="text-text-ter">Canal atual</span>
          <span className="font-medium">{active ? CHANNEL_META[active].label : "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-ter">Próxima ação</span>
          <span className="font-medium">{next ? next.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-ter">IA</span>
          <span className={`font-medium ${lead.ai_paused ? "text-warm" : "text-success"}`}>
            {lead.ai_paused ? "pausada" : "ativa"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={() => onPause(!lead.ai_paused)}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border-card bg-bg-card px-2 text-[11px] hover:bg-bg-general disabled:opacity-50"
        >
          {lead.ai_paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {lead.ai_paused ? "Retomar IA" : "Pausar IA"}
        </button>
        <button
          disabled={busy}
          onClick={onAssume}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[11px] text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          <UserCheck className="h-3 w-3" /> Assumir
        </button>
        <button
          disabled={busy || lead.opt_out}
          onClick={onRestart}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border-card bg-bg-card px-2 text-[11px] hover:bg-bg-general disabled:opacity-50"
          title="Refazer primeiro contato"
        >
          <Sparkles className="h-3 w-3" /> Reiniciar cadência
        </button>
        <button
          disabled={busy}
          onClick={() => onOptOut(!lead.opt_out)}
          className={`inline-flex h-7 items-center gap-1 rounded-md border border-border-card px-2 text-[11px] hover:bg-bg-general disabled:opacity-50 ${lead.opt_out ? "bg-hot-bg text-hot" : "bg-bg-card"}`}
        >
          <ShieldOff className="h-3 w-3" />
          {lead.opt_out ? "Reativar contato" : "Não contatar"}
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-ter">Histórico</div>
        {outreach.length === 0 && (
          <div className="text-[12px] text-text-ter">Nenhuma tentativa ainda.</div>
        )}
        <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {outreach.map((o) => {
            const Icon = CHANNEL_META[(o.channel as ChannelKey) ?? "whatsapp"]?.icon ?? Bot;
            const failed = o.status === "failed" || o.status === "skipped";
            return (
              <li key={o.id} className="rounded-md border border-border-card bg-bg-general p-2 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-medium text-text-body">
                    <Icon className="h-3 w-3" />
                    {CHANNEL_META[(o.channel as ChannelKey) ?? "whatsapp"]?.label ?? o.channel}
                    <span className="text-text-ter">· tent. {o.attempt}</span>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusTone(o.status)}`}>
                    {failed ? <AlertTriangle className="h-2.5 w-2.5" /> : <CheckCheck className="h-2.5 w-2.5" />}
                    {statusLabel(o.status)}
                  </span>
                </div>
                {o.content && (
                  <div className="mt-1 line-clamp-2 text-text-sec">{o.content}</div>
                )}
                {o.error && (
                  <div className="mt-1 text-hot">Erro: {o.error}</div>
                )}
                <div className="mt-1 text-text-ter">
                  {new Date(o.created_at).toLocaleString("pt-BR")}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
