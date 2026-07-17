import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Search, Loader2, Download, Plus, ExternalLink, RotateCcw, Info, Building2, MapPin, Bot, Save, Bookmark, Trash2, FolderOpen, Zap } from "lucide-react";
import { Card } from "@/components/ui-kit";
import {
  searchExternalCompanies,
  importExternalAsLead,
  getEnabledSources,
  saveProspectingSearch,
  listSavedSearches,
  getSavedSearch,
  deleteSavedSearch,
  type ExternalCompany,
  type SourceId,
} from "@/lib/prospecting.functions";
import { downloadCSV } from "@/lib/exports";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/prospeccao")({ component: Prospeccao });

const UFS = ["", "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

const CNAE_SUGESTOES = [
  { value: "", label: "Qualquer atividade" },
  { value: "6202300", label: "6202-3/00 — Desenvolvimento de software" },
  { value: "6201501", label: "6201-5/01 — Desenvolvimento de programas customizáveis" },
  { value: "4751201", label: "4751-2/01 — Comércio de equipamentos de informática" },
  { value: "4711302", label: "4711-3/02 — Supermercados" },
  { value: "2543800", label: "2543-8/00 — Fabricação de ferramentas" },
  { value: "4930202", label: "4930-2/02 — Transporte rodoviário de carga" },
  { value: "4520001", label: "4520-0/01 — Manutenção de veículos" },
  { value: "1091102", label: "1091-1/02 — Fabricação de produtos de padaria" },
];

const PORTES = [
  { value: "", label: "Qualquer porte" },
  { value: "micro", label: "Micro Empresa (ME)" },
  { value: "pequeno", label: "Pequeno Porte (EPP)" },
  { value: "demais", label: "Médio/Grande" },
];

type FormState = {
  source: SourceId;
  cnae: string;
  uf: string;
  municipio: string;
  porte: string;
  min_capital: number;
  keyword: string;
  limit: number;
};

const INITIAL: FormState = {
  source: "cnpj_ws",
  cnae: "",
  uf: "",
  municipio: "",
  porte: "",
  min_capital: 0,
  keyword: "",
  limit: 15,
};

const SOURCE_META: Record<SourceId, { label: string; icon: typeof Building2; color: string }> = {
  cnpj_ws: { label: "Receita Federal", icon: Building2, color: "text-primary" },
  google_places: { label: "Google Places", icon: MapPin, color: "text-blue-600" },
  ai_only: { label: "IA (Claude)", icon: Bot, color: "text-ia" },
};

function Prospeccao() {
  const qc = useQueryClient();
  const searchFn = useServerFn(searchExternalCompanies);
  const importFn = useServerFn(importExternalAsLead);
  const enabledFn = useServerFn(getEnabledSources);

  const { data: enabled } = useQuery({ queryKey: ["enabled-sources"], queryFn: () => enabledFn() });

  const savedListFn = useServerFn(listSavedSearches);
  const savedGetFn = useServerFn(getSavedSearch);
  const savedSaveFn = useServerFn(saveProspectingSearch);
  const savedDelFn = useServerFn(deleteSavedSearch);
  const savedQuery = useQuery({ queryKey: ["saved-searches"], queryFn: () => savedListFn() });

  const [form, setForm] = useState<FormState>(INITIAL);
  const [applied, setApplied] = useState<FormState | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [openReason, setOpenReason] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [loadedSaved, setLoadedSaved] = useState<{ id: string; name: string; results: ExternalCompany[]; source: SourceId; created_at: string } | null>(null);

  // If current source becomes disabled, switch to first enabled
  useEffect(() => {
    if (!enabled) return;
    const active = (["cnpj_ws", "google_places", "ai_only"] as SourceId[]).filter((s) => enabled[s]);
    if (active.length > 0 && !enabled[form.source]) {
      setForm((f) => ({ ...f, source: active[0] }));
    }
  }, [enabled, form.source]);

  const search = useQuery({
    queryKey: ["external-prospects", applied],
    queryFn: () => searchFn({ data: applied! }),
    enabled: applied !== null,
    retry: false,
  });

  useEffect(() => {
    if (search.data?.cache_id) {
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
    }
  }, [search.data?.cache_id, qc]);


  // Unified view: either a live search result or a loaded saved search
  const currentCacheId: string | null = loadedSaved?.id ?? search.data?.cache_id ?? null;
  const currentResults: ExternalCompany[] = loadedSaved?.results ?? search.data?.results ?? [];
  const currentSource: SourceId | null = loadedSaved?.source ?? applied?.source ?? null;
  const isSavedView = !!loadedSaved;

  const importMut = useMutation({
    mutationFn: (cnpj: string) =>
      importFn({ data: { cache_id: currentCacheId!, cnpj } }),
    onSuccess: () => {
      setFlash("✔ Empresa importada como Lead em 'Prospecção'.");
      qc.invalidateQueries({ queryKey: ["leads"] });
      setTimeout(() => setFlash(null), 3500);
    },
    onError: (e: Error) => {
      setFlash(`Erro: ${e.message}`);
      setTimeout(() => setFlash(null), 4000);
    },
  });

  const saveMut = useMutation({
    mutationFn: (name: string) => savedSaveFn({ data: { cache_id: currentCacheId!, name } }),
    onSuccess: () => {
      setFlash("✔ Busca salva com sucesso.");
      setSaveName("");
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
      setTimeout(() => setFlash(null), 3000);
    },
    onError: (e: Error) => {
      setFlash(`Erro ao salvar: ${e.message}`);
      setTimeout(() => setFlash(null), 4000);
    },
  });

  const loadMut = useMutation({
    mutationFn: (id: string) => savedGetFn({ data: { id } }),
    onSuccess: (r) => {
      setLoadedSaved({ id: r.cache_id, name: r.name, results: r.results, source: r.source, created_at: r.created_at });
      setApplied(null);
    },
    onError: (e: Error) => {
      setFlash(`Erro ao carregar: ${e.message}`);
      setTimeout(() => setFlash(null), 4000);
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => savedDelFn({ data: { id } }),
    onSuccess: (_r, id) => {
      if (loadedSaved?.id === id) setLoadedSaved(null);
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
    },
  });

  function apply() {
    setLoadedSaved(null);
    setApplied({ ...form });
  }

  function reset() {
    setForm({ ...INITIAL, source: form.source });
    setApplied(null);
    setLoadedSaved(null);
  }

  const results = currentResults;
  const activeSources = enabled ? (["cnpj_ws", "google_places", "ai_only"] as SourceId[]).filter((s) => enabled[s]) : [];
  const noneEnabled = enabled && activeSources.length === 0;


  function exportCSV() {
    if (!results.length) return;
    downloadCSV(
      `prospeccao-${form.source}-${new Date().toISOString().slice(0, 10)}.csv`,
      results.map((c) => ({
        fonte: c.source,
        identificador: c.cnpj,
        razao_social: c.razao_social,
        nome_fantasia: c.nome_fantasia ?? "",
        cnae: `${c.cnae_principal ?? ""} ${c.cnae_descricao ?? ""}`,
        porte: c.porte ?? "",
        capital_social: c.capital_social ?? 0,
        municipio: c.municipio ?? "",
        uf: c.uf ?? "",
        telefone: c.telefone ?? "",
        whatsapp: c.whatsapp ?? "",
        email: c.email ?? "",

        website: c.website ?? "",
        score_ia: c.score ?? "",
        motivo: c.score_reason ?? "",
      })),
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ia-bg text-ia">
            <Search className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-text-title">Prospecção externa multi-fonte</div>
            <div className="text-[12px] text-text-sec">
              Escolha a fonte de dados abaixo. Ative/desative fontes em <Link to="/configuracoes" className="underline text-primary">Configurações → Prospecção</Link>.
            </div>
          </div>
        </div>
      </Card>

      {/* Saved searches */}
      {(savedQuery.data?.length ?? 0) > 0 && (
        <Card>
          <div className="mb-2 flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-primary" />
            <div className="text-[13px] font-semibold text-text-title">Buscas salvas</div>
            <span className="text-[11px] text-text-ter">({savedQuery.data!.length})</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {savedQuery.data!.map((s) => {
              const meta = SOURCE_META[s.source];
              const Icon = meta.icon;
              const isActive = loadedSaved?.id === s.id;
              return (
                <div
                  key={s.id}
                  className={`flex items-start justify-between gap-2 rounded-md border p-2.5 ${
                    isActive ? "border-primary bg-primary/5" : "border-border-card"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => loadMut.mutate(s.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                      <div className="truncate text-[13px] font-medium text-text-title">{s.name}</div>
                    </div>
                    <div className="mt-1 text-[11px] text-text-ter">
                      {new Date(s.created_at).toLocaleString("pt-BR")} · {s.total_found} resultado{s.total_found === 1 ? "" : "s"} · {meta.label}
                    </div>
                  </button>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      title="Abrir"
                      onClick={() => loadMut.mutate(s.id)}
                      disabled={loadMut.isPending}
                      className="rounded p-1 text-text-ter hover:bg-bg-general hover:text-primary"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Excluir"
                      onClick={() => {
                        if (confirm(`Excluir a busca "${s.name}"?`)) delMut.mutate(s.id);
                      }}
                      className="rounded p-1 text-text-ter hover:bg-bg-general hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {noneEnabled && (
        <Card>
          <div className="text-[13px] text-warm">
            Nenhuma fonte de prospecção está ativa. Vá em <Link to="/configuracoes" className="underline">Configurações → Prospecção</Link> para ativar.
          </div>
        </Card>
      )}

      {!noneEnabled && (
        <>
          {/* Source picker */}
          <Card>
            <div className="mb-2 text-[11px] uppercase text-text-ter">Fonte de dados</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(["cnpj_ws", "google_places", "ai_only"] as SourceId[]).map((s) => {
                const meta = SOURCE_META[s];
                const Icon = meta.icon;
                const active = form.source === s;
                const disabled = !enabled?.[s];
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    onClick={() => setForm({ ...form, source: s })}
                    className={`flex items-center gap-2 rounded-md border p-3 text-left transition ${
                      active
                        ? "border-primary bg-primary/5"
                        : disabled
                          ? "border-border-card bg-bg-general/50 opacity-50 cursor-not-allowed"
                          : "border-border-card hover:border-primary/40"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-text-title">{meta.label}</div>
                      <div className="text-[11px] text-text-ter">
                        {disabled ? "Desativada" : active ? "Selecionada" : "Disponível"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            {form.source === "cnpj_ws" && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  API pública gratuita limitada a <b>3 consultas/min</b>. Resultados em cache por 7 dias. Configure <code>CNPJWS_API_KEY</code> para maior volume.
                </span>
              </div>
            )}
            {form.source === "google_places" && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-900">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Use a <b>palavra-chave</b> para descrever o negócio (ex.: "restaurantes", "clínicas odontológicas"). Cidade/UF refinam a busca.
                </span>
              </div>
            )}
            {form.source === "ai_only" && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-ia/30 bg-ia-bg px-3 py-2 text-[12px] text-ia">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Ana usará o perfil da sua empresa e os filtros abaixo para gerar sugestões plausíveis. <b>Não retorna CNPJ/telefone reais</b> — use para descobrir setores/nichos.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {(form.source === "google_places" || form.source === "ai_only") && (
                <Field label={form.source === "google_places" ? "Palavra-chave (obrigatório)" : "Palavra-chave / setor"}>
                  <input
                    value={form.keyword}
                    onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                    placeholder={form.source === "google_places" ? "Ex.: clínicas odontológicas" : "Ex.: indústrias de embalagens"}
                    className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px] outline-none"
                  />
                </Field>
              )}

              {form.source === "cnpj_ws" && (
                <Field label="Atividade principal (CNAE)">
                  <select
                    value={form.cnae}
                    onChange={(e) => setForm({ ...form, cnae: e.target.value })}
                    className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px] outline-none"
                  >
                    {CNAE_SUGESTOES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="UF">
                <select
                  value={form.uf}
                  onChange={(e) => setForm({ ...form, uf: e.target.value })}
                  className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px] outline-none"
                >
                  {UFS.map((u) => (
                    <option key={u || "any"} value={u}>{u || "Qualquer UF"}</option>
                  ))}
                </select>
              </Field>
              <Field label="Município">
                <input
                  value={form.municipio}
                  onChange={(e) => setForm({ ...form, municipio: e.target.value })}
                  placeholder="Ex.: São Paulo"
                  className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px] outline-none"
                />
              </Field>

              {form.source !== "google_places" && (
                <Field label="Porte">
                  <select
                    value={form.porte}
                    onChange={(e) => setForm({ ...form, porte: e.target.value })}
                    className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px] outline-none"
                  >
                    {PORTES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              )}

              {form.source === "cnpj_ws" && (
                <Field label="Capital social mínimo (R$)">
                  <input
                    type="number"
                    min={0}
                    value={form.min_capital}
                    onChange={(e) => setForm({ ...form, min_capital: Number(e.target.value) || 0 })}
                    className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px] outline-none"
                  />
                </Field>
              )}

              <Field label="Máx. de resultados">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={form.limit}
                  onChange={(e) => setForm({ ...form, limit: Math.min(30, Math.max(1, Number(e.target.value) || 15)) })}
                  className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px] outline-none"
                />
              </Field>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={reset}
                className="flex items-center gap-1.5 rounded-md border border-border-card px-3 py-2 text-[12px] text-text-body hover:bg-bg-general"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Limpar
              </button>
              <button
                onClick={apply}
                disabled={search.isFetching || (form.source === "google_places" && !form.keyword.trim())}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              >
                {search.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                Buscar
              </button>
            </div>
          </Card>
        </>
      )}

      {flash && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-2.5 text-[13px] text-text-title">{flash}</div>
      )}

      {search.isError && (
        <Card>
          <div className="text-[13px] text-red-600">Erro: {(search.error as Error).message}</div>
        </Card>
      )}

      {(applied || isSavedView) && !search.isFetching && !search.isError && currentSource && (
        <Card padded={false}>
          <div className="flex flex-col gap-3 border-b border-border-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[13px] text-text-body">
              {isSavedView ? (
                <>
                  <Bookmark className="mr-1 inline h-3.5 w-3.5 text-primary" />
                  <b>{loadedSaved!.name}</b>
                  <span className="mx-1 text-text-ter">·</span>
                  <span className="text-[11px] text-text-ter">
                    Salva em {new Date(loadedSaved!.created_at).toLocaleString("pt-BR")}
                  </span>
                </>
              ) : (
                <>
                  <b>{results.length}</b> empresas encontradas via <b>{SOURCE_META[currentSource].label}</b>
                  {search.data?.cached && <span className="ml-2 text-[11px] text-text-ter">(cache)</span>}
                  <span className="ml-2 text-[11px] text-primary">· Auto-salva em "Buscas salvas"</span>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isSavedView && (
                <button
                  onClick={() => setLoadedSaved(null)}
                  className="flex items-center gap-1.5 rounded-md border border-border-card px-3 py-1.5 text-[12px] text-text-body hover:bg-bg-general"
                >
                  Fechar busca salva
                </button>
              )}
              <button
                onClick={exportCSV}
                disabled={!results.length}
                className="flex items-center gap-1.5 rounded-md border border-border-card px-3 py-1.5 text-[12px] text-text-body hover:bg-bg-general disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" /> Exportar CSV
              </button>
            </div>
          </div>

          {!isSavedView && currentCacheId && results.length > 0 && (
            <div className="flex flex-col gap-2 border-b border-border-card bg-primary/5 px-4 py-3 sm:flex-row sm:items-center">
              <label className="text-[12px] font-medium text-text-title whitespace-nowrap">
                <Bookmark className="mr-1 inline h-3.5 w-3.5 text-primary" />
                Renomear esta busca:
              </label>
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Ex.: Clínicas SP outubro"
                maxLength={120}
                className="h-9 flex-1 rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
              />
              <button
                onClick={() => saveMut.mutate(saveName.trim())}
                disabled={!saveName.trim() || saveMut.isPending}
                className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
              >
                {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar nome
              </button>
            </div>
          )}
          {results.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-text-sec">
              Nenhuma empresa encontrada. Tente ampliar os filtros.
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="border-b border-border-card bg-bg-general/50">
                <tr className="text-left text-[11px] uppercase text-text-ter">
                  <th className="p-3">Empresa</th>
                  <th className="p-3">Segmento</th>
                  <th className="p-3">Porte / Capital</th>
                  <th className="p-3">Cidade / UF</th>
                  <th className="p-3">Contato</th>
                  <th className="p-3">Score IA</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-card">
                {results.map((c) => (
                  <>
                    <tr key={c.cnpj} className="hover:bg-bg-general/40">
                      <td className="p-3 align-top">
                        <div className="font-medium text-text-title">{c.nome_fantasia || c.razao_social}</div>
                        <div className="text-[11px] text-text-ter">
                          {c.razao_social}
                          {c.source === "cnpj_ws" && (
                            <>
                              <span className="mx-1">·</span>
                              {formatCnpj(c.cnpj)}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-3 align-top text-text-body">
                        <div className="text-[12px]">{c.cnae_descricao ?? "—"}</div>
                        <div className="text-[11px] text-text-ter">{c.cnae_principal ?? ""}</div>
                      </td>
                      <td className="p-3 align-top text-text-body">
                        <div>{c.porte ?? "—"}</div>
                        <div className="text-[11px] text-text-ter">
                          {c.capital_social ? `R$ ${c.capital_social.toLocaleString("pt-BR")}` : ""}
                        </div>
                      </td>
                      <td className="p-3 align-top text-text-body">
                        {[c.municipio, c.uf].filter(Boolean).join(" / ") || "—"}
                      </td>
                      <td className="p-3 align-top text-text-body">
                        <div>{c.telefone ?? "—"}</div>
                        {c.whatsapp && (
                          <div className="text-[11px] text-success">📱 WhatsApp: {c.whatsapp}</div>
                        )}
                        <div className="text-[11px] text-text-ter">{c.email ?? c.website ?? ""}</div>
                      </td>

                      <td className="p-3 align-top">
                        {c.score != null ? (
                          <button
                            onClick={() => setOpenReason(openReason === c.cnpj ? null : c.cnpj)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-ia-bg px-2 py-1 text-[12px] font-semibold text-ia hover:opacity-80"
                          >
                            <Sparkles className="h-3 w-3" /> {c.score}
                          </button>
                        ) : (
                          <span className="text-[11px] text-text-ter">—</span>
                        )}
                      </td>
                      <td className="p-3 align-top text-right">
                        <div className="flex justify-end gap-1.5">
                          {c.source === "cnpj_ws" && (
                            <a
                              href={`https://cnpj.ws/cnpj/${c.cnpj.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-border-card px-2 py-1 text-[11px] text-text-body hover:bg-bg-general"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {c.website && (
                            <a
                              href={c.website}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-border-card px-2 py-1 text-[11px] text-text-body hover:bg-bg-general"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <button
                            onClick={() => importMut.mutate(c.cnpj)}
                            disabled={importMut.isPending}
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                          >
                            <Plus className="h-3 w-3" /> Importar
                          </button>
                        </div>
                      </td>
                    </tr>
                    {openReason === c.cnpj && c.score_reason && (
                      <tr key={c.cnpj + "-r"} className="bg-ia-bg/30">
                        <td colSpan={7} className="p-4">
                          <div className="flex items-start gap-2">
                            <Sparkles className="mt-0.5 h-4 w-4 text-ia" />
                            <div className="text-[12.5px] text-text-body">
                              <span className="font-semibold">Análise Ana:</span> {c.score_reason}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {!applied && !isSavedView && !noneEnabled && (
        <Card>
          <div className="text-center text-[13px] text-text-sec py-6">
            Escolha a fonte, preencha os filtros e clique em <b>Buscar</b>.
          </div>
        </Card>
      )}
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

function formatCnpj(cnpj: string): string {
  const c = cnpj.replace(/\D/g, "");
  if (c.length !== 14) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}
