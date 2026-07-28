import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui-kit";
import { CalendarClock, Play, Pause, Trash2, Plus, Loader2, AlertCircle } from "lucide-react";
import {
  listSchedules,
  upsertSchedule,
  toggleSchedule,
  deleteSchedule,
  listScheduleRuns,
  runScheduleNow,
} from "@/lib/prospecting-schedules.functions";
import { listSequences } from "@/lib/outreach-sequences.functions";

const DOW = ["D", "S", "T", "Q", "Q", "S", "S"];
type ScheduleRow = {
  id: string;
  name: string;
  description: string | null;
  filters: Record<string, unknown>;
  quantity: number;
  days_of_week: number[];
  time_of_day: string;
  timezone: string;
  auto_approve_min_score: number;
  sequence_id: string | null;
  assignment_strategy: "owner" | "round_robin" | "ia_only";
  daily_cap: number;
  monthly_cap: number;
  quiet_hours_start: string;
  quiet_hours_end: string;
  active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  consecutive_failures: number;
};

const DEFAULT_FORM = {
  name: "",
  description: "",
  keyword: "",
  cnae: "",
  uf: "",
  municipio: "",
  porte: "",
  radius_km: 20,
  quantity: 25,
  days_of_week: [1, 3] as number[],
  time_of_day: "09:00",
  timezone: "America/Sao_Paulo",
  auto_approve_min_score: 70,
  sequence_id: "" as string,
  assignment_strategy: "round_robin" as ScheduleRow["assignment_strategy"],
  daily_cap: 50,
  monthly_cap: 500,
  quiet_hours_start: "20:00",
  quiet_hours_end: "08:00",
  active: true,
};

export function SchedulesPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSchedules);
  const upsertFn = useServerFn(upsertSchedule);
  const toggleFn = useServerFn(toggleSchedule);
  const deleteFn = useServerFn(deleteSchedule);
  const runNowFn = useServerFn(runScheduleNow);
  const seqListFn = useServerFn(listSequences);

  const schedules = useQuery({ queryKey: ["prospecting-schedules"], queryFn: () => listFn() });
  const sequences = useQuery({ queryKey: ["outreach-sequences-list"], queryFn: () => seqListFn() });

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [flash, setFlash] = useState<string | null>(null);

  const upsertMut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: editing ?? undefined,
          name: form.name,
          description: form.description || null,
          filters: {
            source: "google_places",
            keyword: form.keyword || null,
            cnae: form.cnae || null,
            uf: (form.uf || null) as never,
            municipio: form.municipio || null,
            porte: form.porte || null,
            radius_km: form.radius_km,
          },
          quantity: form.quantity,
          days_of_week: form.days_of_week,
          time_of_day: form.time_of_day,
          timezone: form.timezone,
          auto_approve_min_score: form.auto_approve_min_score,
          sequence_id: form.sequence_id || null,
          assignment_strategy: form.assignment_strategy,
          daily_cap: form.daily_cap,
          monthly_cap: form.monthly_cap,
          quiet_hours_start: form.quiet_hours_start,
          quiet_hours_end: form.quiet_hours_end,
          active: form.active,
        },
      }),
    onSuccess: () => {
      setFlash("✔ Campanha salva");
      setEditing(null);
      setForm(DEFAULT_FORM);
      qc.invalidateQueries({ queryKey: ["prospecting-schedules"] });
      setTimeout(() => setFlash(null), 2500);
    },
    onError: (e: Error) => setFlash(`Erro: ${e.message}`),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospecting-schedules"] }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospecting-schedules"] }),
  });
  const runMut = useMutation({
    mutationFn: (id: string) => runNowFn({ data: { id } }),
    onSuccess: (r: unknown) => {
      const res = r as { imported: number; found: number };
      setFlash(`▶ Execução: ${res.imported} lead(s) criados de ${res.found} encontrados`);
      qc.invalidateQueries({ queryKey: ["prospecting-schedules"] });
      setTimeout(() => setFlash(null), 4000);
    },
    onError: (e: Error) => setFlash(`Erro na execução: ${e.message}`),
  });

  const editSchedule = (s: ScheduleRow) => {
    setEditing(s.id);
    const f = s.filters as Record<string, unknown>;
    setForm({
      name: s.name,
      description: s.description ?? "",
      keyword: (f.keyword as string) ?? "",
      cnae: (f.cnae as string) ?? "",
      uf: (f.uf as string) ?? "",
      municipio: (f.municipio as string) ?? "",
      porte: (f.porte as string) ?? "",
      radius_km: (f.radius_km as number) ?? 20,
      quantity: s.quantity,
      days_of_week: s.days_of_week,
      time_of_day: s.time_of_day,
      timezone: s.timezone,
      auto_approve_min_score: s.auto_approve_min_score,
      sequence_id: s.sequence_id ?? "",
      assignment_strategy: s.assignment_strategy,
      daily_cap: s.daily_cap,
      monthly_cap: s.monthly_cap,
      quiet_hours_start: s.quiet_hours_start,
      quiet_hours_end: s.quiet_hours_end,
      active: s.active,
    });
  };

  const list = (schedules.data ?? []) as ScheduleRow[];
  const isEditing = editing !== null || form.name.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ia-bg text-ia">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-text-title">Campanhas agendadas</div>
            <div className="text-[12px] text-text-sec">
              Prospecção automática recorrente. O sistema busca, pontua, aprova e coloca em cadência sozinho.
            </div>
          </div>
          {!isEditing && (
            <button
              onClick={() => setForm({ ...DEFAULT_FORM, name: "Nova campanha" })}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-white hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> Nova campanha
            </button>
          )}
        </div>
      </Card>

      {flash && <Card><div className="text-[13px]">{flash}</div></Card>}

      {isEditing && (
        <Card>
          <div className="mb-3 text-[13px] font-semibold text-text-title">
            {editing ? "Editar campanha" : "Nova campanha"}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nome">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]" />
            </Field>
            <Field label="Descrição">
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]" />
            </Field>
            <Field label="Palavra-chave (Google Places)">
              <input value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} placeholder="ex: restaurante" className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]" />
            </Field>
            <Field label="CNAE (opcional)">
              <input value={form.cnae} onChange={(e) => setForm({ ...form, cnae: e.target.value })} className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]" />
            </Field>
            <Field label="Cidade">
              <input value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} placeholder="ex: Curitiba" className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]" />
            </Field>
            <Field label="UF">
              <input value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase().slice(0, 2) })} className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]" />
            </Field>
            <Field label="Raio (km)">
              <input type="number" min={1} max={50} value={form.radius_km} onChange={(e) => setForm({ ...form, radius_km: Number(e.target.value) })} className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]" />
            </Field>
            <Field label="Quantidade por execução">
              <input type="number" min={1} max={100} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]" />
            </Field>
            <Field label="Dias da semana">
              <div className="flex gap-1">
                {DOW.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setForm({ ...form, days_of_week: form.days_of_week.includes(i) ? form.days_of_week.filter((x) => x !== i) : [...form.days_of_week, i].sort() })}
                    className={`h-9 w-9 rounded-md border text-[12px] ${form.days_of_week.includes(i) ? "border-primary bg-primary/10 text-primary" : "border-border-card"}`}
                  >{d}</button>
                ))}
              </div>
            </Field>
            <Field label="Horário">
              <input type="time" value={form.time_of_day} onChange={(e) => setForm({ ...form, time_of_day: e.target.value })} className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]" />
            </Field>
            <Field label="Score mínimo para aprovar automaticamente">
              <input type="number" min={0} max={100} value={form.auto_approve_min_score} onChange={(e) => setForm({ ...form, auto_approve_min_score: Number(e.target.value) })} className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]" />
            </Field>
            <Field label="Cadência">
              <select value={form.sequence_id} onChange={(e) => setForm({ ...form, sequence_id: e.target.value })} className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]">
                <option value="">— padrão do sistema —</option>
                {(sequences.data ?? []).map((s: { id: string; name: string }) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Atribuição">
              <select value={form.assignment_strategy} onChange={(e) => setForm({ ...form, assignment_strategy: e.target.value as never })} className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]">
                <option value="round_robin">Round-robin entre vendedores</option>
                <option value="owner">Sempre para mim (dono da campanha)</option>
                <option value="ia_only">Apenas IA (sem dono humano)</option>
              </select>
            </Field>
            <Field label="Cap diário">
              <input type="number" min={1} value={form.daily_cap} onChange={(e) => setForm({ ...form, daily_cap: Number(e.target.value) })} className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]" />
            </Field>
            <Field label="Cap mensal">
              <input type="number" min={1} value={form.monthly_cap} onChange={(e) => setForm({ ...form, monthly_cap: Number(e.target.value) })} className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]" />
            </Field>
            <Field label="Silêncio (início)">
              <input type="time" value={form.quiet_hours_start} onChange={(e) => setForm({ ...form, quiet_hours_start: e.target.value })} className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]" />
            </Field>
            <Field label="Silêncio (fim)">
              <input type="time" value={form.quiet_hours_end} onChange={(e) => setForm({ ...form, quiet_hours_end: e.target.value })} className="w-full rounded-md border border-border-card bg-bg-general px-3 py-2 text-[13px]" />
            </Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Ativa
          </label>
          <div className="mt-4 flex gap-2">
            <button
              disabled={upsertMut.isPending || !form.name || !form.keyword || form.days_of_week.length === 0}
              onClick={() => upsertMut.mutate()}
              className="rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {upsertMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </button>
            <button
              onClick={() => { setEditing(null); setForm(DEFAULT_FORM); }}
              className="rounded-md border border-border-card px-4 py-2 text-[13px]"
            >Cancelar</button>
          </div>
        </Card>
      )}

      {list.length === 0 && !schedules.isLoading && !isEditing && (
        <Card>
          <div className="text-center text-[13px] text-text-sec py-6">
            Nenhuma campanha ainda. Clique em <b>Nova campanha</b> para começar.
          </div>
        </Card>
      )}

      {list.map((s) => (
        <ScheduleRowCard
          key={s.id}
          schedule={s}
          onEdit={() => editSchedule(s)}
          onToggle={(active) => toggleMut.mutate({ id: s.id, active })}
          onDelete={() => { if (confirm(`Excluir "${s.name}"?`)) delMut.mutate(s.id); }}
          onRunNow={() => runMut.mutate(s.id)}
          runningId={runMut.isPending ? runMut.variables : null}
        />
      ))}
    </div>
  );
}

function ScheduleRowCard({
  schedule, onEdit, onToggle, onDelete, onRunNow, runningId,
}: {
  schedule: ScheduleRow;
  onEdit: () => void;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
  onRunNow: () => void;
  runningId: string | null;
}) {
  const [showRuns, setShowRuns] = useState(false);
  const runsFn = useServerFn(listScheduleRuns);
  const runs = useQuery({
    queryKey: ["schedule-runs", schedule.id],
    queryFn: () => runsFn({ data: { schedule_id: schedule.id } }),
    enabled: showRuns,
  });
  const filters = schedule.filters as Record<string, unknown>;
  const summary = useMemo(() => {
    const parts: string[] = [];
    if (filters.keyword) parts.push(`"${filters.keyword}"`);
    if (filters.municipio) parts.push(`${filters.municipio}/${filters.uf ?? ""}`);
    else if (filters.uf) parts.push(String(filters.uf));
    if (filters.radius_km) parts.push(`raio ${filters.radius_km}km`);
    return parts.join(" · ") || "sem filtros";
  }, [filters]);
  const daysLabel = schedule.days_of_week.map((d) => DOW[d]).join(" ");

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[14px] font-semibold text-text-title">{schedule.name}</div>
            {!schedule.active && <span className="rounded bg-text-ter/10 px-2 py-0.5 text-[11px] text-text-sec">pausada</span>}
            {schedule.consecutive_failures > 0 && (
              <span className="flex items-center gap-1 rounded bg-warm/10 px-2 py-0.5 text-[11px] text-warm">
                <AlertCircle className="h-3 w-3" /> {schedule.consecutive_failures} falha(s)
              </span>
            )}
          </div>
          <div className="text-[12px] text-text-sec">{summary}</div>
          <div className="mt-1 text-[11px] text-text-ter">
            {daysLabel} às {schedule.time_of_day} · {schedule.quantity} por execução · score ≥ {schedule.auto_approve_min_score} · cap {schedule.daily_cap}/dia
          </div>
          <div className="text-[11px] text-text-ter">
            Próxima: {schedule.next_run_at ? new Date(schedule.next_run_at).toLocaleString("pt-BR") : "—"} · Última: {schedule.last_run_at ? new Date(schedule.last_run_at).toLocaleString("pt-BR") : "—"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-1">
            <button
              onClick={onRunNow}
              disabled={runningId === schedule.id}
              className="flex items-center gap-1 rounded-md border border-border-card px-2 py-1 text-[11px] hover:bg-bg-general"
              title="Executar agora"
            >
              {runningId === schedule.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Rodar
            </button>
            <button
              onClick={() => onToggle(!schedule.active)}
              className="flex items-center gap-1 rounded-md border border-border-card px-2 py-1 text-[11px] hover:bg-bg-general"
            >
              {schedule.active ? <><Pause className="h-3 w-3" /> Pausar</> : <><Play className="h-3 w-3" /> Ativar</>}
            </button>
            <button onClick={onEdit} className="rounded-md border border-border-card px-2 py-1 text-[11px] hover:bg-bg-general">Editar</button>
            <button onClick={onDelete} className="rounded-md border border-border-card px-2 py-1 text-[11px] text-cold hover:bg-cold/10">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <button onClick={() => setShowRuns((v) => !v)} className="text-[11px] text-primary hover:underline">
            {showRuns ? "Ocultar" : "Ver"} histórico
          </button>
        </div>
      </div>

      {showRuns && (
        <div className="mt-3 border-t border-border-card pt-3">
          {runs.isLoading && <div className="text-[12px] text-text-ter">Carregando…</div>}
          {!runs.isLoading && (runs.data ?? []).length === 0 && <div className="text-[12px] text-text-ter">Nenhuma execução ainda.</div>}
          {(runs.data ?? []).map((r: {
            id: string; started_at: string; finished_at: string | null; status: string;
            found_count: number; approved_count: number; imported_count: number; skipped_count: number;
            error: string | null;
          }) => (
            <Fragment key={r.id}>
              <div className="flex items-center justify-between py-1 text-[12px]">
                <div>
                  <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] uppercase ${
                    r.status === "success" ? "bg-green-500/10 text-green-600"
                    : r.status === "failed" ? "bg-cold/10 text-cold"
                    : r.status === "partial" ? "bg-warm/10 text-warm"
                    : "bg-text-ter/10 text-text-ter"
                  }`}>{r.status}</span>
                  {new Date(r.started_at).toLocaleString("pt-BR")}
                </div>
                <div className="text-text-sec">
                  {r.imported_count}/{r.found_count} lead(s) · {r.approved_count} aprov · {r.skipped_count} pulados
                </div>
              </div>
              {r.error && <div className="pb-1 pl-1 text-[11px] text-cold">✖ {r.error}</div>}
            </Fragment>
          ))}
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase text-text-ter">{label}</div>
      {children}
    </div>
  );
}
