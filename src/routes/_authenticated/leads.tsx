import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState, type DragEvent } from "react";
import { Flame, Thermometer, Snowflake, Bot, User as UserIcon, Clock, AlertTriangle, Plus, Filter, Download } from "lucide-react";
import { STAGES, type Stage, type Lead, formatBRL } from "@/lib/leads-data";
import { useLeads, leadsStore } from "@/hooks/use-leads-store";
import { exportLeadsCSV } from "@/lib/exports";

export const Route = createFileRoute("/_authenticated/leads")({ component: LeadsPage });

function LeadsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // se estiver em /leads/:id, delega para a rota filha
  if (pathname !== "/leads") return <Outlet />;
  return <Kanban />;
}

function Kanban() {
  const leads = useLeads();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);

  const byStage = (s: Stage) => leads.filter((l) => l.stage === s);
  const total = leads.length;
  const valorTotal = leads.reduce((acc, l) => acc + l.valor, 0);
  const parados = leads.filter((l) => l.paradoHa >= 2).length;

  const onDrop = (stage: Stage) => {
    if (dragId) leadsStore.moveStage(dragId, stage);
    setDragId(null);
    setOverStage(null);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem-3rem)] flex-col">
      {/* Barra de resumo */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-6 rounded-lg border border-border-card bg-bg-card px-4 py-2.5">
          <Stat label="Leads" value={total.toString()} />
          <Stat label="Pipeline" value={formatBRL(valorTotal)} />
          <Stat label="Parados 2+ dias" value={parados.toString()} accent={parados > 0 ? "error" : undefined} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => exportLeadsCSV(leads)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border-card bg-bg-card px-3 text-[13px] text-text-body hover:bg-bg-general"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
          <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border-card bg-bg-card px-3 text-[13px] text-text-body hover:bg-bg-general">
            <Filter className="h-4 w-4" /> Filtros
          </button>
          <button className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover">
            <Plus className="h-4 w-4" /> Novo lead
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex h-full min-w-max gap-3 pb-2">
          {STAGES.map((s) => {
            const items = byStage(s.id);
            const stageValor = items.reduce((a, l) => a + l.valor, 0);
            const isOver = overStage === s.id;
            return (
              <div
                key={s.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStage(s.id);
                }}
                onDragLeave={() => setOverStage((v) => (v === s.id ? null : v))}
                onDrop={() => onDrop(s.id)}
                className={`flex w-[280px] flex-col rounded-lg border ${
                  isOver ? "border-primary bg-primary-light" : "border-border-card bg-bg-general"
                }`}
              >
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${stageDotColor(s.id)}`} />
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-text-title">
                      {s.label}
                    </span>
                    <span className="rounded-full bg-bg-card px-1.5 text-[11px] text-text-sec">
                      {items.length}
                    </span>
                  </div>
                  <span className="text-[11px] text-text-ter">{formatBRL(stageValor)}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-2">
                  {items.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onDragStart={() => setDragId(lead.id)}
                      dragging={dragId === lead.id}
                    />
                  ))}
                  {items.length === 0 && (
                    <div className="mt-2 rounded-md border border-dashed border-border-card px-3 py-6 text-center text-[12px] text-text-ter">
                      Arraste um lead para cá
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "error" }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-text-ter">{label}</span>
      <span className={`text-[15px] font-semibold ${accent === "error" ? "text-error" : "text-text-title"}`}>
        {value}
      </span>
    </div>
  );
}

function stageDotColor(s: Stage) {
  switch (s) {
    case "novo": return "bg-text-ter";
    case "contatado": return "bg-cold";
    case "qualificado": return "bg-warm";
    case "proposta": return "bg-ia";
    case "negociacao": return "bg-hot";
    case "fechado": return "bg-success";
  }
}

function LeadCard({
  lead,
  onDragStart,
  dragging,
}: {
  lead: Lead;
  onDragStart: (e: DragEvent) => void;
  dragging: boolean;
}) {
  const isAI = lead.responsavel === "Ana (IA)";
  const parado = lead.paradoHa >= 2;
  return (
    <Link
      to="/leads/$id"
      params={{ id: lead.id }}
      draggable
      onDragStart={onDragStart}
      className={`mb-2 block cursor-grab rounded-md border bg-bg-card p-3 shadow-sm transition-all hover:border-primary/40 hover:shadow ${
        dragging ? "opacity-40" : ""
      } ${parado ? "border-error/40" : "border-border-card"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-text-title">{lead.empresa}</div>
          <div className="truncate text-[11px] text-text-sec">
            {lead.contato} · {lead.cargo}
          </div>
        </div>
        <TempBadge t={lead.temperatura} score={lead.score} />
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-text-title">{formatBRL(lead.valor)}</span>
        <span className="text-[11px] text-text-ter">{lead.segmento}</span>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-border-card pt-2">
        <div className={`inline-flex items-center gap-1 text-[11px] ${isAI ? "text-ia" : "text-text-sec"}`}>
          {isAI ? <Bot className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
          <span className="truncate">{lead.responsavel}</span>
        </div>
        <div className="inline-flex items-center gap-1 text-[11px] text-text-ter">
          <Clock className="h-3 w-3" />
          {lead.ultimaInteracao}
        </div>
      </div>

      {parado && (
        <div className="mt-2 inline-flex items-center gap-1 rounded bg-error-bg px-1.5 py-0.5 text-[10px] font-medium text-error">
          <AlertTriangle className="h-3 w-3" /> Parado há {lead.paradoHa}d
        </div>
      )}
    </Link>
  );
}

export function TempBadge({ t, score }: { t: "hot" | "warm" | "cold"; score?: number }) {
  const map = {
    hot: { Icon: Flame, cls: "bg-hot-bg text-hot", label: "Hot" },
    warm: { Icon: Thermometer, cls: "bg-warm-bg text-warm", label: "Warm" },
    cold: { Icon: Snowflake, cls: "bg-cold-bg text-cold", label: "Cold" },
  } as const;
  const { Icon, cls, label } = map[t];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {score ?? label}
    </span>
  );
}
