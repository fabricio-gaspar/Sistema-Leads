import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
  CalendarDays,
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
  listContactPoints,
  upsertContactPoint,
  deleteContactPoint,
  listConsentEvents,
} from "@/lib/crm.functions";
import {
  listOutreach,
  pauseAi,
  assumeManually,
  setOptOut,
  startOutreach,
} from "@/lib/outreach.functions";
import { getLeadEnrollment } from "@/lib/outreach-sequences.functions";

import { TempBadge } from "./leads";
import type { Database } from "@/integrations/supabase/types";
import {
  acceptHandoff,
  getLeadAutomation,
  scheduleAppointment,
  getAppointmentIcs,
} from "@/lib/sales-automation.functions";
import { approveLeadForOutreach } from "@/lib/commercial.functions";
import { listCallActivities, logCallActivity } from "@/lib/commercial.functions";


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
  const approveOutreachFn = useServerFn(approveLeadForOutreach);
  const listCallsFn = useServerFn(listCallActivities);
  const logCallFn = useServerFn(logCallActivity);

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
  const callsQ = useQuery({
    queryKey: ["lead-calls", id],
    queryFn: () => listCallsFn({ data: { lead_id: id } }),
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
    mutationFn: () => startOutreachFn({ data: { lead_id: id, restart: true } }),
    onSuccess: (result) => {
      if (!result.ok) {
        const messages: Record<string, string> = {
          opt_out: "O contato está em opt-out.",
          paused: "Retome a IA antes de reiniciar a cadência.",
          contact_suppressed: "O contato está na lista de supressão.",
          no_active_sequence: "Não há uma cadência ativa.",
          no_channel_available: "O lead não possui canal disponível.",
        };
        toast.error(messages[result.reason ?? ""] ?? "Não foi possível reiniciar a cadência.");
        return;
      }
      toast.success("Cadência reiniciada");
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["lead-outreach", id] });
      qc.invalidateQueries({ queryKey: ["lead-messages", id] });
      qc.invalidateQueries({ queryKey: ["lead-enrollment", id] });
      qc.invalidateQueries({ queryKey: ["lead-automation", id] });
    },
  });
  const approvalMut = useMutation({
    mutationFn: (approved: boolean) => approveOutreachFn({ data: { lead_id: id, approved } }),
    onSuccess: (result) => {
      toast.success(result.approved_at ? "Contato aprovado para a cadência." : "Aprovação de contato removida.");
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["lead-enrollment", id] });
    },
    onError: (error: Error) => toast.error("Aprovação restrita ao administrador", { description: error.message }),
  });
  const callMut = useMutation({
    mutationFn: (value: { outcome: "planned" | "connected" | "voicemail" | "no_answer" | "wrong_number" | "follow_up" | "qualified" | "lost"; notes: string }) => logCallFn({ data: { lead_id: id, outcome: value.outcome, notes: value.notes || null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-calls", id] });
      toast.success("Atividade de ligação registrada.");
    },
    onError: (error: Error) => toast.error("Não foi possível registrar a ligação", { description: error.message }),
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
          <OutreachApprovalCard lead={lead} onChange={(approved) => approvalMut.mutate(approved)} busy={approvalMut.isPending} />
          <AutomationCard leadId={id} lead={lead} />
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
          <NotesCard leadId={id} />
          <CallActivityCard lead={lead} activities={callsQ.data ?? []} onLog={(value) => callMut.mutate(value)} busy={callMut.isPending} />
          <ContactPointsCard leadId={id} lead={lead} />
          <ConsentEventsCard leadId={id} lead={lead} />
          <StageHistoryCard leadId={id} />
        </div>


      </div>
    </div>
  );
}

function AutomationCard({ leadId, lead }: { leadId: string; lead: any }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getLeadAutomation);
  const acceptFn = useServerFn(acceptHandoff);
  const scheduleFn = useServerFn(scheduleAppointment);
  const icsFn = useServerFn(getAppointmentIcs);
  const [showSchedule, setShowSchedule] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [title, setTitle] = useState("Reunião comercial");
  const { data, isLoading, error } = useQuery({
    queryKey: ["lead-automation", leadId],
    queryFn: () => getFn({ data: { lead_id: leadId } }),
  });
  const acceptMut = useMutation({
    mutationFn: (handoffId: string) => acceptFn({ data: { handoff_id: handoffId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-automation", leadId] });
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
    },
  });
  const scheduleMut = useMutation({
    mutationFn: () => scheduleFn({ data: {
      lead_id: leadId,
      title,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: null,
      notes: null,
    } }),
    onSuccess: () => {
      setShowSchedule(false);
      setStartsAt("");
      qc.invalidateQueries({ queryKey: ["lead-automation", leadId] });
      qc.invalidateQueries({ queryKey: ["lead-tasks", leadId] });
    },
  });
  const downloadIcs = async (appointmentId: string) => {
    try {
      const file = await icsFn({ data: { appointment_id: appointmentId } });
      const url = URL.createObjectURL(new Blob([file.content], { type: "text/calendar;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = file.filename; link.click(); URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Não foi possível gerar o convite", { description: (error as Error).message });
    }
  };

  const enrollment = data?.enrollment as any;
  const qualification = data?.qualification as any;
  const handoff = data?.handoff as any;
  const appointments = (data?.appointments ?? []) as any[];
  const sequenceSteps = enrollment?.outreach_sequences?.outreach_sequence_steps;
  const steps = Array.isArray(sequenceSteps)
    ? sequenceSteps.filter((step: any) => step.active).sort((a: any, b: any) => a.order_index - b.order_index)
    : [];
  const currentStep = steps.find((step: any) => step.order_index === enrollment?.current_step_index);

  return (
    <Card title="Automação comercial">
      {isLoading && <div className="text-[11px] text-text-ter">Carregando automação…</div>}
      {error && <div className="text-[11px] text-error">{(error as Error).message}</div>}
      {!isLoading && !error && (
        <div className="space-y-3 text-[11.5px]">
          <div className="rounded-md bg-bg-general p-2.5">
            <div className="font-semibold text-text-title">Cadência</div>
            <div className="mt-1 text-text-sec">
              {enrollment ? `${enrollment.outreach_sequences?.name ?? "Cadência"} · ${enrollment.status}` : "Ainda não iniciada"}
            </div>
            {currentStep && <div className="mt-1 text-text-ter">Passo {currentStep.order_index + 1}: {currentStep.channel} · máximo {currentStep.max_attempts} tentativa(s)</div>}
            {enrollment?.next_run_at && <div className="mt-1 text-text-ter">Próxima ação: {new Date(enrollment.next_run_at).toLocaleString("pt-BR")}</div>}
            {enrollment?.last_error && <div className="mt-1 text-error">{enrollment.last_error}</div>}
          </div>

          <div>
            <div className="font-semibold text-text-title">Score explicável: {lead.score ?? "—"}/100</div>
            <div className="mt-1 text-text-sec">{lead.score_explanation || "Detalhamento será registrado na próxima conversão/prospecção."}</div>
            {lead.score_verified_at && <div className="mt-1 text-text-ter">Verificado em {new Date(lead.score_verified_at).toLocaleString("pt-BR")}</div>}
          </div>

          <div>
            <div className="font-semibold text-text-title">Qualificação da Ana</div>
            {qualification ? (
              <div className="mt-1 space-y-1 text-text-sec">
                <div>Intenção: {qualification.intent || "não informada"}</div>
                <div>Serviço: {qualification.service_interest || "não informado"}</div>
                <div>Prontidão: {qualification.readiness_score ?? "—"}/100</div>
                {qualification.summary && <div className="line-clamp-4">{qualification.summary}</div>}
              </div>
            ) : <div className="mt-1 text-text-ter">Aguardando interação suficiente para qualificar.</div>}
          </div>

          {handoff && (
            <div className={`rounded-md border p-2.5 ${handoff.status === "pending" ? "border-warm bg-warm-bg" : "border-border-card"}`}>
              <div className="font-semibold text-text-title">Handoff: {handoff.status}</div>
              <div className="mt-1 text-text-sec">{handoff.reason}</div>
              {handoff.due_at && <div className="mt-1 text-text-ter">SLA: {new Date(handoff.due_at).toLocaleString("pt-BR")}</div>}
              {handoff.status === "pending" && (
                <button onClick={() => acceptMut.mutate(handoff.id)} disabled={acceptMut.isPending}
                  className="mt-2 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground disabled:opacity-50">
                  {acceptMut.isPending ? "Assumindo…" : "Aceitar atendimento"}
                </button>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-text-title">Reuniões</div>
              <button onClick={() => setShowSchedule((value) => !value)} className="inline-flex items-center gap-1 text-primary">
                <CalendarDays className="h-3 w-3" /> Agendar
              </button>
            </div>
            {showSchedule && (
              <div className="mt-2 space-y-2 rounded-md border border-border-card p-2">
                <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200}
                  className="h-8 w-full rounded border border-border-card bg-bg-card px-2" />
                <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)}
                  className="h-8 w-full rounded border border-border-card bg-bg-card px-2" />
                <button onClick={() => startsAt && scheduleMut.mutate()} disabled={!startsAt || scheduleMut.isPending}
                  className="rounded bg-primary px-2.5 py-1 text-primary-foreground disabled:opacity-50">
                  {scheduleMut.isPending ? "Salvando…" : "Confirmar"}
                </button>
              </div>
            )}
            {appointments.length === 0 ? <div className="mt-1 text-text-ter">Nenhuma reunião agendada.</div> : (
              <div className="mt-1 space-y-1">{appointments.slice(0, 3).map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between gap-2 text-text-sec"><span>{new Date(appointment.starts_at).toLocaleString("pt-BR")} · {appointment.title}</span><button onClick={() => downloadIcs(appointment.id)} className="text-[10.5px] text-primary">.ics</button></div>
              ))}</div>
            )}
          </div>
          {(acceptMut.error || scheduleMut.error) && <div className="text-error">{(acceptMut.error || scheduleMut.error)?.message}</div>}
        </div>
      )}
    </Card>
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

function OutreachApprovalCard({ lead, onChange, busy }: { lead: any; onChange: (approved: boolean) => void; busy: boolean }) {
  const approved = lead.contact_status === "approved";
  return (
    <Card title="Aprovação de contato">
      <div className={`rounded-md p-2 text-[11.5px] ${approved ? "bg-success-bg text-success" : "bg-warm-bg text-warm"}`}>
        {approved ? "Aprovado para abordagem automática." : "Aguardando aprovação administrativa para iniciar a abordagem."}
      </div>
      <div className="mt-2 text-[11px] text-text-sec">
        Status do dado: {lead.contact_status ?? "unverified"}{lead.contact_approved_at ? ` · ${new Date(lead.contact_approved_at).toLocaleDateString("pt-BR")}` : ""}
      </div>
      <button disabled={busy} onClick={() => onChange(!approved)} className="mt-3 h-7 rounded-md border border-border-card bg-bg-card px-2 text-[11px] text-text-body hover:bg-bg-general disabled:opacity-50">
        {busy ? "Salvando…" : approved ? "Revogar aprovação" : "Aprovar contato"}
      </button>
    </Card>
  );
}

function CallActivityCard({
  lead,
  activities,
  onLog,
  busy,
}: {
  lead: any;
  activities: any[];
  onLog: (value: { outcome: "planned" | "connected" | "voicemail" | "no_answer" | "wrong_number" | "follow_up" | "qualified" | "lost"; notes: string }) => void;
  busy: boolean;
}) {
  const [outcome, setOutcome] = useState<"planned" | "connected" | "voicemail" | "no_answer" | "wrong_number" | "follow_up" | "qualified" | "lost">("planned");
  const [notes, setNotes] = useState("");
  const labels: Record<string, string> = { planned: "Planejada", connected: "Atendeu", voicemail: "Caixa postal", no_answer: "Não atendeu", wrong_number: "Número inválido", follow_up: "Retornar", qualified: "Qualificado", lost: "Perdido" };
  return (
    <Card title="Ligaçōes e retornos">
      {(lead.phone || lead.whatsapp) && <a href={`tel:${lead.phone || lead.whatsapp}`} className="mb-2 inline-flex text-[11px] text-primary hover:underline">Ligar para {lead.phone || lead.whatsapp}</a>}
      <div className="space-y-2 rounded-md border border-border-card bg-bg-general p-2">
        <select value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)} className="h-8 w-full rounded border border-border-card bg-bg-card px-2 text-[11px]">
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} placeholder="Resumo da ligação" className="h-8 w-full rounded border border-border-card bg-bg-card px-2 text-[11px]" />
        <button onClick={() => { onLog({ outcome, notes }); setNotes(""); }} disabled={busy} className="h-7 rounded bg-primary px-2 text-[11px] text-white disabled:opacity-50">{busy ? "Salvando…" : "Registrar ligação"}</button>
      </div>
      <ul className="mt-3 space-y-1.5">{activities.slice(0, 5).map((activity) => <li key={activity.id} className="rounded bg-bg-general px-2 py-1.5 text-[11px]"><div className="flex justify-between gap-2"><span className="font-medium">{labels[activity.outcome] ?? activity.outcome}</span><span className="text-text-ter">{new Date(activity.created_at).toLocaleDateString("pt-BR")}</span></div>{activity.notes && <div className="mt-0.5 text-text-sec">{activity.notes}</div>}</li>)}{activities.length === 0 && <li className="text-[11px] text-text-ter">Nenhuma ligação registrada.</li>}</ul>
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
  const enrollFn = useServerFn(getLeadEnrollment);
  const { data: enrollment } = useQuery({
    queryKey: ["lead-enrollment", lead.id],
    queryFn: () => enrollFn({ data: { lead_id: lead.id } }),
    refetchInterval: 30000,
  });
  const lastFailed = outreach.find((o) => o.status === "failed");
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
          <span className="text-text-ter">Cadência</span>
          <span className="font-medium">
            {enrollment?.enrollment
              ? `${enrollment.enrollment.status} · passo ${enrollment.enrollment.current_step_index + 1}`
              : "—"}
          </span>

        </div>
        {enrollment?.enrollment?.pause_reason && (
          <div className="flex justify-between">
            <span className="text-text-ter">Motivo pausa</span>
            <span className="font-medium text-warm">{enrollment.enrollment.pause_reason}</span>
          </div>
        )}
        {lastFailed?.error && (
          <div className="flex justify-between">
            <span className="text-text-ter">Último erro</span>
            <span className="font-medium text-error truncate max-w-[60%]" title={lastFailed.error}>
              {lastFailed.error}
            </span>
          </div>
        )}
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
          disabled={busy || lead.opt_out || lead.ai_paused}
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

function NotesCard({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listLeadNotes);
  const createFn = useServerFn(createLeadNote);
  const deleteFn = useServerFn(deleteLeadNote);
  const [body, setBody] = useState("");
  const q = useQuery({ queryKey: ["lead-notes", leadId], queryFn: () => listFn({ data: { lead_id: leadId } }) });
  const createMut = useMutation({
    mutationFn: (b: string) => createFn({ data: { lead_id: leadId, body: b } }),
    onSuccess: () => { setBody(""); qc.invalidateQueries({ queryKey: ["lead-notes", leadId] }); },
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-notes", leadId] }),
  });
  const notes = (q.data ?? []) as Array<{ id: string; body: string; created_at: string }>;
  return (
    <Card title="Notas internas">
      <form
        onSubmit={(e) => { e.preventDefault(); if (body.trim()) createMut.mutate(body.trim()); }}
        className="mb-3 space-y-2"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Nota visível apenas para a equipe interna…"
          rows={3}
          className="w-full rounded-md border border-border-card bg-bg-general px-2 py-1.5 text-[12px] text-text-body outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={createMut.isPending || !body.trim()}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> Adicionar nota
        </button>
      </form>
      {notes.length === 0 ? (
        <div className="text-[12px] text-text-ter">Nenhuma nota interna.</div>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border border-border-card bg-bg-general p-2 text-[11px]">
              <div className="whitespace-pre-wrap text-text-body">{n.body}</div>
              <div className="mt-1 flex items-center justify-between text-text-ter">
                <span>{new Date(n.created_at).toLocaleString("pt-BR")}</span>
                <button
                  onClick={() => delMut.mutate(n.id)}
                  className="inline-flex items-center gap-1 rounded px-1 text-hot hover:bg-hot-bg"
                  title="Excluir nota"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StageHistoryCard({ leadId }: { leadId: string }) {
  const listFn = useServerFn(listStageHistory);
  const listAssignFn = useServerFn(listAssignmentHistory);
  const stageQ = useQuery({ queryKey: ["lead-stage-history", leadId], queryFn: () => listFn({ data: { lead_id: leadId } }) });
  const assignQ = useQuery({ queryKey: ["lead-assign-history", leadId], queryFn: () => listAssignFn({ data: { lead_id: leadId } }) });
  const stages = (stageQ.data ?? []) as Array<{ id: string; from_stage: string | null; to_stage: string; source: string; created_at: string }>;
  const assigns = (assignQ.data ?? []) as Array<{ id: string; from_user: string | null; to_user: string | null; source: string; created_at: string }>;
  const empty = stages.length === 0 && assigns.length === 0;
  return (
    <Card title="Auditoria">
      {empty && <div className="text-[12px] text-text-ter">Sem eventos ainda.</div>}
      {stages.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] font-semibold uppercase text-text-ter">Etapas</div>
          <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {stages.map((s) => (
              <li key={s.id} className="rounded-md border border-border-card bg-bg-general px-2 py-1 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-body">
                    {s.from_stage ? `${s.from_stage} → ${s.to_stage}` : `criado em ${s.to_stage}`}
                  </span>
                  <span className="text-text-ter">{s.source}</span>
                </div>
                <div className="text-text-ter">{new Date(s.created_at).toLocaleString("pt-BR")}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {assigns.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase text-text-ter">Atribuições</div>
          <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {assigns.map((a) => (
              <li key={a.id} className="rounded-md border border-border-card bg-bg-general px-2 py-1 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-body">
                    {a.from_user ? `${a.from_user.slice(0, 8)}… → ${a.to_user?.slice(0, 8) ?? "—"}…` : `atribuído a ${a.to_user?.slice(0, 8) ?? "—"}…`}
                  </span>
                  <span className="text-text-ter">{a.source}</span>
                </div>
                <div className="text-text-ter">{new Date(a.created_at).toLocaleString("pt-BR")}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}


// ============= Múltiplos contatos =============

type ContactPointRow = {
  id: string;
  kind: "whatsapp" | "phone" | "email" | "site";
  value: string;
  verified: boolean;
  preferred: boolean;
  sandbox: boolean;
  status: string | null;
  source: string | null;
  created_at: string;
};

function ContactPointsCard({ leadId, lead }: { leadId: string; lead: any }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listContactPoints);
  const upsertFn = useServerFn(upsertContactPoint);
  const delFn = useServerFn(deleteContactPoint);

  const q = useQuery({
    queryKey: ["contact-points", leadId],
    queryFn: () => listFn({ data: { lead_id: leadId } }),
  });

  const [kind, setKind] = useState<"whatsapp" | "phone" | "email">("whatsapp");
  const [value, setValue] = useState("");
  const [sandbox, setSandbox] = useState(false);

  const addMut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: { lead_id: leadId, kind, value: value.trim(), sandbox, preferred: false },
      }),
    onSuccess: () => {
      setValue("");
      setSandbox(false);
      qc.invalidateQueries({ queryKey: ["contact-points", leadId] });
    },
  });
  const setPrefMut = useMutation({
    mutationFn: (row: ContactPointRow) =>
      upsertFn({
        data: {
          id: row.id,
          lead_id: leadId,
          kind: row.kind,
          value: row.value,
          preferred: true,
          verified: row.verified,
          sandbox: row.sandbox,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-points", leadId] }),
  });
  const toggleSandboxMut = useMutation({
    mutationFn: (row: ContactPointRow) =>
      upsertFn({
        data: {
          id: row.id,
          lead_id: leadId,
          kind: row.kind,
          value: row.value,
          preferred: row.preferred,
          verified: row.verified,
          sandbox: !row.sandbox,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-points", leadId] }),
  });
  const toggleVerifiedMut = useMutation({
    mutationFn: (row: ContactPointRow) =>
      upsertFn({
        data: {
          id: row.id,
          lead_id: leadId,
          kind: row.kind,
          value: row.value,
          preferred: row.preferred,
          verified: !row.verified,
          sandbox: row.sandbox,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-points", leadId] }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-points", leadId] }),
  });

  const rows = (q.data ?? []) as ContactPointRow[];
  const iconFor: Record<string, React.ComponentType<{ className?: string }>> = {
    whatsapp: MessageCircle,
    phone: Phone,
    email: Mail,
    site: Building2,
  };
  const legacyHint =
    rows.length === 0 && (lead.whatsapp || lead.phone || lead.email)
      ? "Os campos legados (WhatsApp/telefone/e-mail) do lead ainda são usados até você adicionar um contato aqui."
      : null;

  return (
    <Card title="Contatos do lead">
      {legacyHint && (
        <div className="mb-2 rounded-md bg-warm-bg px-2 py-1 text-[11px] text-warm">{legacyHint}</div>
      )}
      <ul className="mb-3 space-y-1.5">
        {rows.length === 0 ? (
          <li className="text-[12px] text-text-ter">Nenhum contato cadastrado.</li>
        ) : (
          rows.map((r) => {
            const Icon = iconFor[r.kind] ?? MessageCircle;
            return (
              <li
                key={r.id}
                className="rounded-md border border-border-card bg-bg-general p-2 text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-text-ter" />
                  <span className="flex-1 truncate text-text-body">{r.value}</span>
                  {r.preferred && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      preferencial
                    </span>
                  )}
                  {r.sandbox && (
                    <span className="rounded-full bg-ia-bg px-1.5 py-0.5 text-[10px] font-medium text-ia">
                      teste
                    </span>
                  )}
                  {r.verified && (
                    <span className="rounded-full bg-success-bg px-1.5 py-0.5 text-[10px] font-medium text-success">
                      válido
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-text-ter">
                  <span>{r.kind}</span>
                  {r.source && <span>· origem: {r.source}</span>}
                  {!r.preferred && (
                    <button
                      onClick={() => setPrefMut.mutate(r)}
                      className="ml-auto text-primary hover:underline"
                    >
                      tornar preferencial
                    </button>
                  )}
                  <button
                    onClick={() => toggleVerifiedMut.mutate(r)}
                    className="text-text-sec hover:underline"
                  >
                    {r.verified ? "marcar inválido" : "marcar válido"}
                  </button>
                  <button
                    onClick={() => toggleSandboxMut.mutate(r)}
                    className="text-ia hover:underline"
                  >
                    {r.sandbox ? "tirar teste" : "marcar teste"}
                  </button>
                  <button
                    onClick={() => delMut.mutate(r.id)}
                    className="text-hot hover:underline"
                    title="Remover"
                  >
                    <Trash2 className="inline h-3 w-3" />
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>
      <div className="space-y-1.5 border-t border-border-card pt-2">
        <div className="flex gap-1">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as any)}
            className="h-7 rounded-md border border-border-card bg-bg-card px-1 text-[11px]"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Telefone</option>
            <option value="email">E-mail</option>
          </select>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={kind === "email" ? "email@empresa.com" : "(11) 99999-9999"}
            className="h-7 flex-1 rounded-md border border-border-card bg-bg-card px-2 text-[11px] outline-none focus:border-primary"
          />
          <button
            disabled={!value.trim() || addMut.isPending}
            onClick={() => addMut.mutate()}
            className="inline-flex h-7 items-center rounded-md bg-primary px-2 text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-text-ter">
          <input
            type="checkbox"
            checked={sandbox}
            onChange={(e) => setSandbox(e.target.checked)}
          />
          contato de teste (sandbox)
        </label>
      </div>
    </Card>
  );
}

// ============= Consentimento (LGPD) =============

type ConsentRow = {
  id: string;
  event: string;
  channel: string | null;
  source: string | null;
  text: string | null;
  actor_id: string | null;
  created_at: string;
};

function ConsentEventsCard({ leadId, lead }: { leadId: string; lead: any }) {
  const listFn = useServerFn(listConsentEvents);
  const q = useQuery({
    queryKey: ["consent-events", leadId],
    queryFn: () => listFn({ data: { lead_id: leadId } }),
  });
  const rows = (q.data ?? []) as ConsentRow[];
  const currentStatus: "opt_out" | "opt_in" | "desconhecido" = lead.opt_out
    ? "opt_out"
    : rows.some((r) => r.event === "opt_in" || r.event === "resubscribe")
      ? "opt_in"
      : "desconhecido";
  const statusTone =
    currentStatus === "opt_out"
      ? "bg-hot-bg text-hot"
      : currentStatus === "opt_in"
        ? "bg-success-bg text-success"
        : "bg-bg-general text-text-sec";

  return (
    <Card title="Consentimento (LGPD)">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] text-text-ter">Status atual</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone}`}
        >
          <ShieldOff className="h-2.5 w-2.5" />
          {currentStatus === "opt_out"
            ? "opt-out"
            : currentStatus === "opt_in"
              ? "opt-in"
              : "desconhecido"}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="text-[12px] text-text-ter">Sem eventos registrados.</div>
      ) : (
        <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-md border border-border-card bg-bg-general p-2 text-[11px]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium capitalize text-text-body">{r.event}</span>
                <span className="text-text-ter">{r.channel ?? "—"}</span>
              </div>
              {r.text && <div className="mt-0.5 text-text-sec">{r.text}</div>}
              <div className="mt-0.5 flex items-center justify-between text-text-ter">
                <span>{r.source ?? "sistema"}</span>
                <span>{new Date(r.created_at).toLocaleString("pt-BR")}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
