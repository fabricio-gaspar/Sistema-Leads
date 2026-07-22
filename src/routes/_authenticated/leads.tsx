import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Flame, Thermometer, Snowflake, Bot, User as UserIcon, Plus, Download, Loader2, Trash2, Archive } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/leads-data";
import { downloadCSV } from "@/lib/exports";
import { createLead, listLeads, moveLeadStage, deleteLead } from "@/lib/crm.functions";
import type { Database } from "@/integrations/supabase/types";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type Stage = Database["public"]["Enums"]["lead_stage"];

export const Route = createFileRoute("/_authenticated/leads")({ component: LeadsPage });

const STAGES: Stage[] = ["Prospecção", "Qualificado", "Proposta", "Negociação", "Pedido", "Fechado", "Perdido"];

function LeadsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/leads") return <Outlet />;
  return <Kanban />;
}

function Kanban() {
  const qc = useQueryClient();
  const listFn = useServerFn(listLeads);
  const moveFn = useServerFn(moveLeadStage);
  const createFn = useServerFn(createLead);
  const delFn = useServerFn(deleteLead);

  const { data: leads = [], isLoading, error } = useQuery({
    queryKey: ["leads"],
    queryFn: () => listFn(),
  });

  const moveMut = useMutation({
    mutationFn: (v: { id: string; stage: Stage }) => moveFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const archiveMut = useMutation({
    mutationFn: (id: string) => moveFn({ data: { id, stage: "Perdido" as Stage } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead arquivado como Perdido"); },
  });

  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);
  const [showNew, setShowNew] = useState(false);

  const byStage = (s: Stage) => leads.filter((l) => l.stage === s);
  const total = leads.length;
  const valorTotal = leads.reduce((a, l) => a + Number(l.value || 0), 0);
  const parados = leads.filter((l) => (l.stale_hours ?? 0) >= 48).length;

  const onDrop = (stage: Stage) => {
    if (dragId) {
      const cur = leads.find((l) => l.id === dragId);
      if (cur && cur.stage !== stage) moveMut.mutate({ id: dragId, stage });
    }
    setDragId(null);
    setOverStage(null);
  };

  const exportCsv = () =>
    downloadCSV(
      `leads-${new Date().toISOString().slice(0, 10)}.csv`,
      leads.map((l) => ({
        ID: l.id,
        Empresa: l.company,
        Contato: l.contact ?? "",
        Cargo: l.title ?? "",
        Telefone: l.phone ?? "",
        Email: l.email ?? "",
        UF: l.uf ?? "",
        Segmento: l.segment ?? "",
        Valor: Number(l.value || 0),
        Score: l.score,
        Temperatura: l.temp,
        Estagio: l.stage,
        Origem: l.origin ?? "",
      })),
    );

  if (error) {
    return (
      <div className="rounded-md border border-error/40 bg-error-bg p-4 text-[13px] text-error">
        Erro ao carregar leads: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem-3rem)] flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-6 rounded-lg border border-border-card bg-bg-card px-4 py-2.5">
          <Stat label="Leads" value={total.toString()} />
          <Stat label="Pipeline" value={formatBRL(valorTotal)} />
          <Stat label="Parados 48h+" value={parados.toString()} accent={parados > 0 ? "error" : undefined} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={leads.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border-card bg-bg-card px-3 text-[13px] text-text-body hover:bg-bg-general disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" /> Novo lead
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-text-sec">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando leads…
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="flex h-full min-w-max gap-3 pb-2">
            {STAGES.map((s) => {
              const items = byStage(s);
              const stageValor = items.reduce((a, l) => a + Number(l.value || 0), 0);
              const isOver = overStage === s;
              return (
                <div
                  key={s}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverStage(s);
                  }}
                  onDragLeave={() => setOverStage((v) => (v === s ? null : v))}
                  onDrop={() => onDrop(s)}
                  className={`flex w-[280px] flex-col rounded-lg border ${
                    isOver ? "border-primary bg-primary-light" : "border-border-card bg-bg-general"
                  }`}
                >
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-text-title">{s}</span>
                      <span className="rounded-full bg-bg-card px-1.5 text-[11px] text-text-sec">{items.length}</span>
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
                        onArchive={() => {
                          if (confirm(`Arquivar ${lead.company} como Perdido?`)) archiveMut.mutate(lead.id);
                        }}
                        onDelete={() => {
                          if (confirm(`Excluir permanentemente ${lead.company}?`)) delMut.mutate(lead.id);
                        }}
                      />
                    ))}
                    {items.length === 0 && (
                      <div className="mt-2 rounded-md border border-dashed border-border-card px-3 py-6 text-center text-[12px] text-text-ter">
                        Sem leads nesta etapa
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showNew && (
        <NewLeadModal
          onClose={() => setShowNew(false)}
          onCreate={async (payload) => {
            await createFn({ data: payload });
            qc.invalidateQueries({ queryKey: ["leads"] });
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "error" }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-text-ter">{label}</span>
      <span className={`text-[15px] font-semibold ${accent === "error" ? "text-error" : "text-text-title"}`}>{value}</span>
    </div>
  );
}

function LeadCard({
  lead,
  onDragStart,
  dragging,
  onArchive,
  onDelete,
}: {
  lead: LeadRow;
  onDragStart: (e: DragEvent) => void;
  dragging: boolean;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const isAI = lead.owner === "ia";
  return (
    <div
      className={`mb-2 rounded-md border border-border-card bg-bg-card shadow-sm transition-all hover:border-primary/40 hover:shadow ${
        dragging ? "opacity-40" : ""
      }`}
      draggable
      onDragStart={onDragStart}
    >
      <Link
        to="/leads/$id"
        params={{ id: lead.id }}
        className="block cursor-grab p-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-text-title">{lead.company}</div>
            <div className="truncate text-[11px] text-text-sec">
              {lead.contact ?? "—"}
              {lead.title ? ` · ${lead.title}` : ""}
            </div>
          </div>
          <TempBadge t={lead.temp} score={lead.score} />
        </div>

        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-text-title">{formatBRL(Number(lead.value || 0))}</span>
          <span className="text-[11px] text-text-ter">{lead.segment ?? ""}</span>
        </div>

        <ChannelBadges lead={lead} />

        <div className="mt-2 flex items-center justify-between border-t border-border-card pt-2">
          <div className={`inline-flex items-center gap-1 text-[11px] ${isAI ? "text-ia" : "text-text-sec"}`}>
            {isAI ? <Bot className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
            <span className="truncate">{isAI ? "Ana (IA)" : "Humano"}</span>
          </div>
          {(lead as any).ai_paused && (
            <span className="rounded-full bg-warm-bg px-1.5 py-0.5 text-[10px] font-medium text-warm">IA pausada</span>
          )}
        </div>
      </Link>
      <div className="flex items-center justify-end gap-1 border-t border-border-card px-2 py-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onArchive(); }}
          title="Arquivar como Perdido"
          className="rounded p-1 text-text-ter hover:bg-warm-bg hover:text-warm"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(); }}
          title="Excluir"
          className="rounded p-1 text-text-ter hover:bg-error-bg hover:text-error"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ChannelBadges({ lead }: { lead: LeadRow }) {
  const ch = ((lead as any).contact_channels ?? {}) as Record<string, { available?: boolean; last_status?: string | null }>;
  const items = [
    { key: "whatsapp", label: "WA" },
    { key: "email", label: "@" },
    { key: "phone", label: "Tel" },
  ];
  const has = items.some((i) => ch[i.key]?.available);
  if (!has) return null;
  return (
    <div className="mt-2 flex items-center gap-1">
      {items.map((i) => {
        const s = ch[i.key];
        if (!s?.available) return null;
        const st = s.last_status;
        const cls =
          st === "replied"
            ? "bg-success-bg text-success"
            : st === "sent" || st === "delivered" || st === "read"
              ? "bg-primary/10 text-primary"
              : st === "failed" || st === "skipped"
                ? "bg-hot-bg text-hot"
                : "bg-bg-general text-text-sec";
        return (
          <span key={i.key} className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
            {i.label}
          </span>
        );
      })}
    </div>
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

function NewLeadModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (v: {
    company: string;
    contact?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    segment?: string;
    city?: string;
    value?: number;
    temp?: "hot" | "warm" | "cold";
    stage?: Stage;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    company: "",
    contact: "",
    phone: "",
    whatsapp: "",
    email: "",
    segment: "",
    city: "",
    value: "",
    temp: "warm" as "hot" | "warm" | "cold",
    stage: "Prospecção" as Stage,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await onCreate({
        company: form.company.trim(),
        contact: form.contact || undefined,
        phone: form.phone || undefined,
        whatsapp: form.whatsapp || undefined,
        email: form.email || undefined,
        segment: form.segment || undefined,
        city: form.city || undefined,
        value: form.value ? Number(form.value) : undefined,
        temp: form.temp,
        stage: form.stage,
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        onSubmit={submit}
        className="w-[520px] rounded-lg bg-bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-[15px] font-semibold text-text-title">Novo lead</h3>
        <div className="space-y-3">
          <Field label="Empresa *">
            <input
              required
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contato">
              <input
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
              />
            </Field>
            <Field label="Telefone">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="WhatsApp">
              <input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
              />
            </Field>
            <Field label="Cidade">
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
              />
            </Field>
            <Field label="Segmento">
              <input
                value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value })}
                className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Valor (R$)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
              />
            </Field>
            <Field label="Temperatura">
              <select
                value={form.temp}
                onChange={(e) => setForm({ ...form, temp: e.target.value as "hot" | "warm" | "cold" })}
                className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px] outline-none focus:border-primary"
              >
                <option value="hot">Quente</option>
                <option value="warm">Morno</option>
                <option value="cold">Frio</option>
              </select>
            </Field>
            <Field label="Etapa">
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })}
                className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px] outline-none focus:border-primary"
              >
                {STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        {err && <div className="mt-3 rounded bg-error-bg px-3 py-2 text-[12px] text-error">{err}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border-card px-3 py-2 text-[12px] text-text-body hover:bg-bg-general"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Criar lead
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] uppercase text-text-ter">{label}</div>
      {children}
    </label>
  );
}
