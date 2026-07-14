import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Bot,
  User as UserIcon,
  Send,
  Phone,
  Mail,
  MapPin,
  Building2,
  Sparkles,
  UserCheck,
  FileText,
  Clock,
} from "lucide-react";
import { STAGES, formatBRL } from "@/lib/leads-data";
import { useLead, leadsStore } from "@/hooks/use-leads-store";
import { TempBadge } from "./leads";

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
  const lead = useLead(id);
  if (!lead) throw notFound();

  const [mode, setMode] = useState<"ia" | "humano">(
    lead.responsavel === "Ana (IA)" ? "ia" : "humano",
  );
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lead.chat.length]);

  const send = () => {
    if (!text.trim()) return;
    leadsStore.addMessage(lead.id, {
      id: `m-${Date.now()}`,
      from: mode === "ia" ? "ana" : "vendedor",
      at: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      text: text.trim(),
    });
    setText("");
  };

  const simulateIncoming = async () => {
    const { simulateLeadMessage } = await import("@/lib/ana-brain");
    leadsStore.receiveLeadMessage(lead.id, simulateLeadMessage(), mode === "ia");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/leads"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-card bg-bg-card text-text-sec hover:bg-bg-general"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold text-text-title">{lead.empresa}</h2>
            <TempBadge t={lead.temperatura} score={lead.score} />
          </div>
          <div className="text-[12px] text-text-sec">
            {lead.contato} · {lead.cargo} · #{lead.id}
          </div>
        </div>

        {/* Controle IA / Humano */}
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
        {/* Coluna esquerda: dados */}
        <div className="space-y-4">
          <Card title="Contato">
            <InfoRow icon={Building2} text={`${lead.segmento} · ${lead.cidade}`} />
            <InfoRow icon={Phone} text={lead.telefone} />
            <InfoRow icon={Mail} text={lead.email} />
            <InfoRow icon={MapPin} text={`Origem: ${lead.origem}`} />
          </Card>

          <Card title="Negócio">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] uppercase text-text-ter">Valor</span>
              <span className="text-[15px] font-semibold text-text-title">
                {formatBRL(lead.valor)}
              </span>
            </div>
            <div className="mt-2">
              <span className="text-[11px] uppercase text-text-ter">Estágio</span>
              <select
                value={lead.stage}
                onChange={(e) =>
                  leadsStore.moveStage(lead.id, e.target.value as typeof lead.stage)
                }
                className="mt-1 w-full rounded-md border border-border-card bg-bg-card px-2 py-1.5 text-[13px]"
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2">
              <span className="text-[11px] uppercase text-text-ter">Responsável</span>
              <div className="mt-1 flex items-center gap-1.5 text-[13px] text-text-body">
                {lead.responsavel === "Ana (IA)" ? (
                  <Bot className="h-3.5 w-3.5 text-ia" />
                ) : (
                  <UserIcon className="h-3.5 w-3.5" />
                )}
                {lead.responsavel}
              </div>
            </div>
          </Card>

          <Card title={`Score explicável · ${lead.score}`}>
            {lead.scoreBreakdown.map((b) => (
              <div key={b.label} className="mb-2 last:mb-0">
                <div className="flex justify-between text-[12px]">
                  <span className="text-text-body">{b.label}</span>
                  <span className="text-text-sec">
                    {b.nota}/{b.peso}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-bg-general">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(b.nota / b.peso) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* Meio: chat */}
        <div className="flex h-[70vh] flex-col overflow-hidden rounded-lg border border-border-card bg-bg-card">
          <div className="flex items-center justify-between border-b border-border-card px-4 py-2.5">
            <div className="text-[13px] font-semibold text-text-title">WhatsApp · {lead.telefone}</div>
            <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              mode === "ia" ? "bg-ia-bg text-ia" : "bg-primary-light text-primary"
            }`}>
              {mode === "ia" ? <Bot className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
              {mode === "ia" ? "Ana respondendo" : "Vendedor no controle"}
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-bg-general p-4">
            {lead.chat.length === 0 && (
              <div className="mt-10 text-center text-[12px] text-text-ter">
                Nenhuma conversa ainda — envie a primeira mensagem.
              </div>
            )}
            {lead.chat.map((m) => {
              const mine = m.from !== "lead";
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-[13px] shadow-sm ${
                      m.from === "lead"
                        ? "bg-bg-card text-text-body"
                        : m.from === "ana"
                          ? "bg-ia text-white"
                          : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {mine && (
                      <div className="mb-0.5 flex items-center gap-1 text-[10px] opacity-80">
                        {m.from === "ana" ? <Bot className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                        {m.from === "ana" ? "Ana" : "Vendedor"}
                      </div>
                    )}
                    <div>{m.text}</div>
                    <div className={`mt-1 text-right text-[10px] ${mine ? "opacity-70" : "text-text-ter"}`}>
                      {m.at}
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
                placeholder={
                  mode === "ia"
                    ? "Sugerir mensagem para a Ana enviar…"
                    : "Digite sua mensagem…"
                }
                className="flex-1 resize-none rounded-md border border-border-card bg-bg-card px-3 py-2 text-[13px] outline-none focus:border-primary"
              />
              <button
                onClick={send}
                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover"
              >
                <Send className="h-4 w-4" />
                Enviar
              </button>
            </div>
            <button
              onClick={simulateIncoming}
              className="mt-2 text-[11px] text-text-sec underline-offset-2 hover:text-ia hover:underline"
            >
              ⚡ Simular mensagem do lead {mode === "ia" ? "(Ana responderá automaticamente)" : ""}
            </button>
          </div>
        </div>

        {/* Direita: timeline */}
        <div className="space-y-4">
          <Card title="Timeline comercial">
            <ol className="space-y-3">
              {lead.timeline.length === 0 && (
                <li className="text-[12px] text-text-ter">Sem eventos ainda.</li>
              )}
              {lead.timeline.map((ev) => (
                <li key={ev.id} className="flex gap-2.5">
                  <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    ev.kind === "ana" ? "bg-ia-bg text-ia" :
                    ev.kind === "humano" ? "bg-primary-light text-primary" :
                    ev.kind === "proposta" ? "bg-warm-bg text-warm" :
                    "bg-bg-general text-text-sec"
                  }`}>
                    {ev.kind === "ana" ? <Bot className="h-3 w-3" /> :
                     ev.kind === "humano" ? <UserIcon className="h-3 w-3" /> :
                     ev.kind === "proposta" ? <FileText className="h-3 w-3" /> :
                     <Clock className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] text-text-body">{ev.text}</div>
                    <div className="text-[11px] text-text-ter">{ev.at}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border-card bg-bg-card p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-ter">
        {title}
      </div>
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
