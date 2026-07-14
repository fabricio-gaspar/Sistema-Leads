import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Sparkles, User, Filter, Download, Loader2 } from "lucide-react";
import { Card, TempBadge } from "@/components/ui-kit";
import { formatBRL } from "@/lib/leads-data";
import { listProspects, bulkAssignProspects, listTeam } from "@/lib/crm.functions";
import { downloadCSV } from "@/lib/exports";
import type { Database } from "@/integrations/supabase/types";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

export const Route = createFileRoute("/_authenticated/prospeccao")({ component: Prospeccao });

const SEGMENTOS = ["Todos", "Metalurgia", "Automotivo", "Construção", "Plásticos", "Alimentício", "Químico"];
const UFS = ["Todas", "SP", "MG", "RS", "PR", "SC", "RJ", "BA"];

function Prospeccao() {
  const qc = useQueryClient();
  const listFn = useServerFn(listProspects);
  const teamFn = useServerFn(listTeam);
  const bulkFn = useServerFn(bulkAssignProspects);

  const [seg, setSeg] = useState("Todos");
  const [uf, setUf] = useState("Todas");
  const [minScore, setMinScore] = useState(0);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState({ seg: "Todos", uf: "Todas", minScore: 0, search: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openScore, setOpenScore] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState<string>("");

  const { data: rows = [], isLoading } = useQuery<LeadRow[]>({
    queryKey: ["prospects", applied],
    queryFn: () =>
      listFn({
        data: {
          segment: applied.seg === "Todos" ? null : applied.seg,
          uf: applied.uf === "Todas" ? null : applied.uf,
          min_score: applied.minScore || null,
          search: applied.search || null,
        },
      }),
  });

  const { data: team = [] } = useQuery({ queryKey: ["team"], queryFn: () => teamFn().catch(() => []) });

  const bulk = useMutation({
    mutationFn: (vars: { target: "ana" | "human" }) =>
      bulkFn({
        data: {
          ids: Array.from(selected),
          target: vars.target,
          assigned_to: vars.target === "human" && assignTo ? assignTo : null,
        },
      }),
    onSuccess: (r, vars) => {
      setFlash(
        vars.target === "ana"
          ? `🤖 Ana iniciará abordagem em ${r.count} prospect(s).`
          : `👤 ${r.count} prospect(s) atribuídos ao vendedor.`,
      );
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["prospects"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      setTimeout(() => setFlash(null), 3500);
    },
    onError: (e: Error) => setFlash(`Erro: ${e.message}`),
  });

  function toggle(id: string) {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  }
  function toggleAll() {
    setSelected(selected.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function motivos(p: LeadRow): string[] {
    const out: string[] = [];
    if ((p.score ?? 0) >= 80) out.push("Score alto — fit forte com ICP");
    if (p.segment) out.push(`Segmento: ${p.segment}`);
    if (p.uf) out.push(`Região atendida: ${p.uf}`);
    if ((p.distance ?? 999) <= 100) out.push(`Distância: ${p.distance} km`);
    if (Number(p.value || 0) > 50000) out.push(`Ticket estimado: ${formatBRL(Number(p.value))}`);
    if (!out.length) out.push("Prospect novo — sem sinais fortes ainda");
    return out;
  }

  function exportCSV() {
    downloadCSV(
      `prospects-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((r) => ({
        empresa: r.company,
        segmento: r.segment ?? "",
        uf: r.uf ?? "",
        score: r.score ?? 0,
        temp: r.temp ?? "",
        valor: Number(r.value || 0),
      })),
    );
  }

  const hasSelection = selected.size > 0;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ia-bg text-ia">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-text-title">
              {isLoading ? "Carregando prospects…" : `${rows.length} empresas em prospecção`}
            </div>
            <div className="text-[12px] text-text-sec">Leads no estágio "Prospecção" — filtre e distribua para Ana ou vendedor</div>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-md border border-border-card px-3 py-2 text-[12px] text-text-body hover:bg-bg-general">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Buscar empresa">
            <div className="flex h-9 w-64 items-center gap-2 rounded-md border border-border-card px-3">
              <Search className="h-3.5 w-3.5 text-text-ter" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome da empresa..."
                className="flex-1 bg-transparent text-[13px] outline-none"
              />
            </div>
          </Field>
          <Select label="Segmento" value={seg} onChange={setSeg} options={SEGMENTOS} />
          <Select label="UF" value={uf} onChange={setUf} options={UFS} />
          <Field label="Score mínimo">
            <input
              type="number"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value) || 0)}
              className="h-9 w-24 rounded-md border border-border-card bg-bg-card px-2 text-[13px] outline-none"
            />
          </Field>
          <button
            onClick={() => setApplied({ seg, uf, minScore, search })}
            className="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Filter className="h-3.5 w-3.5" /> Aplicar filtros
          </button>
        </div>
      </Card>

      {hasSelection && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="text-[13px] text-text-title">
            <span className="font-semibold">{selected.size}</span> prospect(s) selecionado(s)
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              className="h-8 rounded-md border border-border-card bg-bg-card px-2 text-[12px]"
            >
              <option value="">Vendedor (opcional)…</option>
              {(team as { id: string; name: string | null }[]).map((t) => (
                <option key={t.id} value={t.id}>{t.name ?? t.id.slice(0, 8)}</option>
              ))}
            </select>
            <button
              onClick={() => bulk.mutate({ target: "ana" })}
              disabled={bulk.isPending}
              className="flex items-center gap-1.5 rounded-md bg-ia px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" /> Enviar para Ana
            </button>
            <button
              onClick={() => bulk.mutate({ target: "human" })}
              disabled={bulk.isPending}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              <User className="h-3.5 w-3.5" /> Atribuir ao vendedor
            </button>
          </div>
        </div>
      )}

      {flash && (
        <div className="rounded-lg border border-success/40 bg-success-bg px-4 py-2.5 text-[13px] text-success">{flash}</div>
      )}

      <Card padded={false}>
        {isLoading ? (
          <div className="flex justify-center p-10 text-text-sec">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-text-sec">Nenhum prospect encontrado com esses filtros.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="border-b border-border-card bg-bg-general/50">
              <tr className="text-left text-[11px] uppercase text-text-ter">
                <th className="p-3 w-8">
                  <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} />
                </th>
                <th className="p-3">Empresa</th>
                <th className="p-3">Segmento</th>
                <th className="p-3">UF</th>
                <th className="p-3">Valor est.</th>
                <th className="p-3">Score Ana</th>
                <th className="p-3">Temperatura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-card">
              {rows.map((p) => (
                <Fragment key={p.id}>
                  <tr className="hover:bg-bg-general/40">
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-text-title">{p.company}</div>
                      <div className="text-[11px] text-text-ter">{p.contact ?? "—"}</div>
                    </td>
                    <td className="p-3 text-text-body">{p.segment ?? "—"}</td>
                    <td className="p-3 text-text-body">{p.uf ?? "—"}</td>
                    <td className="p-3 text-text-body">{formatBRL(Number(p.value || 0))}</td>
                    <td className="p-3">
                      <button
                        onClick={() => setOpenScore(openScore === p.id ? null : p.id)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-ia-bg px-2 py-1 text-[12px] font-semibold text-ia hover:opacity-80"
                      >
                        <Sparkles className="h-3 w-3" /> {p.score ?? 0}
                      </button>
                    </td>
                    <td className="p-3">
                      <TempBadge t={(p.temp as "hot" | "warm" | "cold") ?? "cold"} />
                    </td>
                  </tr>
                  {openScore === p.id && (
                    <tr className="bg-ia-bg/30">
                      <td colSpan={7} className="p-4">
                        <div className="flex items-start gap-3">
                          <Sparkles className="mt-0.5 h-4 w-4 text-ia" />
                          <div>
                            <div className="text-[12px] font-semibold text-text-title">
                              Por que a Ana deu score {p.score ?? 0}?
                            </div>
                            <ul className="mt-1.5 space-y-1 text-[12.5px] text-text-body">
                              {motivos(p).map((m) => (
                                <li key={m}>• {m}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
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
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-border-card bg-bg-card px-2 text-[13px] outline-none"
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </Field>
  );
}
