import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Upload, Sparkles, FileText, Trash2, Loader2, Download, Pencil, Save, X, Plug, Eye } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import {
  createDocumentRecord,
  deleteDocument,
  getDocument,
  updateDocument,
  getDocumentSignedUrl,
  listDocuments,
  retrainAna,
  getCompanySettings,
  updateCompanySettings,
  listIntegrations,
} from "@/lib/crm.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/empresa")({ component: Empresa });

const SIZE_LABEL: Record<string, string> = {
  pequena: "Pequena empresa",
  media: "Média empresa",
  grande: "Grande empresa",
};

function Empresa() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2 space-y-4">
        <PerfilCard />
        <DocumentosCard />
      </div>

      <div className="space-y-4">
        <IdentidadeCard />
        <AnaCard />
        <IntegracoesCard />
      </div>
    </div>
  );
}

// ---------- Perfil (editável) ----------

type CompanyForm = {
  name: string;
  cnpj: string;
  segment: string;
  size: "" | "pequena" | "media" | "grande";
  website: string;
  annual_revenue: string;
  city: string;
  state: string;
  phone: string;
  email: string;
};

const EMPTY: CompanyForm = {
  name: "", cnpj: "", segment: "", size: "", website: "",
  annual_revenue: "", city: "", state: "", phone: "", email: "",
};

function PerfilCard() {
  const qc = useQueryClient();
  const loadFn = useServerFn(getCompanySettings);
  const saveFn = useServerFn(updateCompanySettings);
  const q = useQuery({ queryKey: ["company_settings"], queryFn: () => loadFn() });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CompanyForm>(EMPTY);

  useEffect(() => {
    if (q.data) {
      setForm({
        name: q.data.name ?? "",
        cnpj: q.data.cnpj ?? "",
        segment: q.data.segment ?? "",
        size: (q.data.size as CompanyForm["size"]) ?? "",
        website: q.data.website ?? "",
        annual_revenue: q.data.annual_revenue ?? "",
        city: q.data.city ?? "",
        state: q.data.state ?? "",
        phone: q.data.phone ?? "",
        email: q.data.email ?? "",
      });
    }
  }, [q.data]);

  const mut = useMutation({
    mutationFn: (payload: CompanyForm) =>
      saveFn({
        data: {
          ...payload,
          size: payload.size === "" ? null : payload.size,
        },
      }),
    onSuccess: () => {
      toast.success("Perfil da empresa atualizado");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["company_settings"] });
    },
    onError: (e) => toast.error("Falha ao salvar", { description: (e as Error).message }),
  });

  const set = <K extends keyof CompanyForm>(k: K, v: CompanyForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <SectionTitle
        title="Perfil da empresa"
        hint="Estas informações treinam a Ana sobre o seu negócio"
        action={
          !editing ? (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-card px-3 py-1.5 text-[12px] text-text-body hover:bg-bg-general"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(false); if (q.data) qc.invalidateQueries({ queryKey: ["company_settings"] }); }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-card px-3 py-1.5 text-[12px] text-text-body hover:bg-bg-general"
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
              <button
                disabled={mut.isPending}
                onClick={() => mut.mutate(form)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              >
                {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar
              </button>
            </div>
          )
        }
      />

      {q.isLoading ? (
        <div className="text-[12px] text-text-ter">Carregando…</div>
      ) : !editing ? (
        <div className="grid grid-cols-2 gap-4">
          <ReadItem label="Razão social" value={form.name} />
          <ReadItem label="CNPJ" value={form.cnpj} />
          <ReadItem label="Segmento principal" value={form.segment} />
          <ReadItem label="Porte" value={form.size ? SIZE_LABEL[form.size] : ""} />
          <ReadItem label="Website" value={form.website} />
          <ReadItem label="Faturamento anual" value={form.annual_revenue} />
          <ReadItem label="Cidade" value={form.city} />
          <ReadItem label="Estado (UF)" value={form.state} />
          <ReadItem label="Telefone" value={form.phone} />
          <ReadItem label="E-mail" value={form.email} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Razão social" value={form.name} onChange={(v) => set("name", v)} />
          <Field label="CNPJ" value={form.cnpj} onChange={(v) => set("cnpj", v)} placeholder="00.000.000/0000-00" />
          <Field label="Segmento principal" value={form.segment} onChange={(v) => set("segment", v)} />
          <div>
            <div className="mb-1 text-[11px] uppercase text-text-ter">Porte</div>
            <select
              value={form.size}
              onChange={(e) => set("size", e.target.value as CompanyForm["size"])}
              className="w-full rounded-md border border-border-card bg-bg-elev px-2.5 py-2 text-[13px] text-text-title focus:border-primary focus:outline-none"
            >
              <option value="">Selecione…</option>
              <option value="pequena">Pequena empresa</option>
              <option value="media">Média empresa</option>
              <option value="grande">Grande empresa</option>
            </select>
          </div>
          <Field label="Website" value={form.website} onChange={(v) => set("website", v)} placeholder="wfdigital.com.br" />
          <Field label="Faturamento anual" value={form.annual_revenue} onChange={(v) => set("annual_revenue", v)} placeholder="R$ 24 milhões" />
          <Field label="Cidade" value={form.city} onChange={(v) => set("city", v)} />
          <Field label="Estado (UF)" value={form.state} onChange={(v) => set("state", v.toUpperCase().slice(0, 2))} placeholder="SP" />
          <Field label="Telefone" value={form.phone} onChange={(v) => set("phone", v)} />
          <Field label="E-mail" value={form.email} onChange={(v) => set("email", v)} />
        </div>
      )}
    </Card>
  );
}

function ReadItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-text-ter">{label}</div>
      <div className="text-[13px] text-text-title font-medium">{value || <span className="text-text-ter">—</span>}</div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase text-text-ter">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border-card bg-bg-elev px-2.5 py-2 text-[13px] text-text-title focus:border-primary focus:outline-none"
      />
    </div>
  );
}

// ---------- Identidade (sidebar) ----------

function IdentidadeCard() {
  const loadFn = useServerFn(getCompanySettings);
  const q = useQuery({ queryKey: ["company_settings"], queryFn: () => loadFn() });
  const name = q.data?.name || "Sua empresa";
  const loc =
    [q.data?.city, q.data?.state].filter(Boolean).join(" · ") || "Sem localização definida";
  return (
    <Card>
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Building2 className="h-9 w-9" />
        </div>
        <div className="mt-3 text-[15px] font-semibold text-text-title">{name}</div>
        <div className="text-[12px] text-text-sec">{loc}</div>
      </div>
    </Card>
  );
}

// ---------- Ana ----------

function AnaCard() {
  const loadFn = useServerFn(getCompanySettings);
  const q = useQuery({ queryKey: ["company_settings"], queryFn: () => loadFn() });
  const description = q.data?.description?.trim();
  return (
    <Card>
      <div className="flex items-center gap-2 text-ia">
        <Sparkles className="h-4 w-4" />
        <div className="text-[13px] font-semibold">Ana aprendeu</div>
      </div>
      <p className="mt-1.5 text-[12.5px] text-text-body leading-relaxed">
        {description || (
          <span className="text-text-ter">
            Nenhum contexto cadastrado ainda. Vá em Configurações → IA / Ana para descrever o negócio e treinar a Ana.
          </span>
        )}
      </p>
      <RetrainAnaButton />
    </Card>
  );
}

// ---------- Integrações (real) ----------

function IntegracoesCard() {
  const listFn = useServerFn(listIntegrations);
  const q = useQuery({ queryKey: ["integrations"], queryFn: () => listFn() });

  return (
    <Card>
      <SectionTitle title="Integrações" hint="Status real de cada canal" />
      {q.isLoading ? (
        <div className="text-[12px] text-text-ter">Carregando…</div>
      ) : (
        <ul className="space-y-2">
          {q.data?.map((i) => (
            <li key={i.id} className="flex items-center justify-between text-[12.5px]">
              <span className="text-text-body">{i.label}</span>
              {i.connected ? (
                <span className="rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-semibold text-success">
                  Conectado
                </span>
              ) : (
                <button
                  onClick={() =>
                    toast.info(`${i.label} ainda não configurado`, {
                      description:
                        "Peça para o admin conectar essa integração — quando as credenciais forem cadastradas, o status muda automaticamente.",
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-border-card px-2 py-0.5 text-[10px] font-semibold text-text-ter hover:bg-bg-general"
                >
                  <Plug className="h-3 w-3" /> Conectar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------- Documentos ----------

function DocumentosCard() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDocuments);
  const createFn = useServerFn(createDocumentRecord);
  const deleteFn = useServerFn(deleteDocument);
  const signFn = useServerFn(getDocumentSignedUrl);

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const docsQ = useQuery({ queryKey: ["documents"], queryFn: () => listFn() });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Documento removido");
    },
    onError: (e) => toast.error("Falha ao remover", { description: (e as Error).message }),
  });

  const onPick = async (file: File) => {
    setError(null);
    setUploading(true);
    let uploadedPath: string | null = null;
    try {
      const isTextKnowledge = file.type.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(file.name);
      if (!isTextKnowledge) {
        throw new Error("Use TXT, Markdown, CSV ou JSON. PDF/DOC ainda exigem extração antes de poderem orientar a IA.");
      }
      if (file.size > 500_000) {
        throw new Error("O documento deve ter no máximo 500 KB para entrar na base de conhecimento.");
      }
      const contentText = (await file.text()).trim();
      if (!contentText) throw new Error("O documento está vazio.");
      const path = `${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("docs").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;
      uploadedPath = path;
      await createFn({
        data: {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
          storage_path: path,
          status: "active",
          content_text: contentText,
        },
      });
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Documento enviado", { description: "A base de conhecimento foi reindexada." });
    } catch (e) {
      if (uploadedPath) await supabase.storage.from("docs").remove([uploadedPath]);
      setError(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const download = async (storage_path: string) => {
    const signed = await signFn({ data: { storage_path } });
    if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
  };

  return (
    <Card>
      <SectionTitle
        title="Documentos"
        hint="Base aprovada usada pela Ana nas respostas (TXT, Markdown, CSV ou JSON)"
        action={
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Enviar
            </button>
          </>
        }
      />
      {error && <div className="mb-2 rounded-md bg-error-bg p-2 text-[12px] text-error">{error}</div>}
      {docsQ.isLoading && <div className="text-[12px] text-text-ter">Carregando…</div>}
      {docsQ.data && docsQ.data.length === 0 && (
        <div className="text-[12px] text-text-ter">Nenhum documento enviado.</div>
      )}
      <ul className="space-y-1.5">
        {docsQ.data?.map((d) => (
          <li key={d.id} className="flex items-center gap-2 rounded-md border border-border-card p-2 text-[12.5px]">
            <FileText className="h-4 w-4 text-text-ter shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-text-title">{d.name}</div>
              <div className="text-[10.5px] text-text-ter">
                {d.type} · {d.size ?? "—"} · {d.status ?? "active"}
                {d.created_at && ` · enviado ${new Date(d.created_at as string).toLocaleDateString("pt-BR")}`}
                {d.updated_at && d.updated_at !== d.created_at && ` · editado ${new Date(d.updated_at as string).toLocaleDateString("pt-BR")}`}
              </div>
            </div>
            <button onClick={() => setViewingId(d.id)} className="text-text-ter hover:text-primary" aria-label={`Visualizar ${d.name}`} title="Visualizar">
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setEditingId(d.id)} className="text-text-ter hover:text-primary" aria-label={`Editar ${d.name}`} title="Editar">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => d.storage_path && download(d.storage_path)} className="text-text-ter hover:text-primary" title="Baixar">
              <Download className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { if (confirm(`Remover "${d.name}"?`)) delMut.mutate(d.id); }} className="text-text-ter hover:text-error" title="Remover">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {viewingId && <DocumentModal id={viewingId} mode="view" onClose={() => setViewingId(null)} />}
      {editingId && <DocumentModal id={editingId} mode="edit" onClose={() => setEditingId(null)} />}
    </Card>
  );
}

function DocumentModal({ id, mode, onClose }: { id: string; mode: "view" | "edit"; onClose: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getDocument);
  const updateFn = useServerFn(updateDocument);
  const { data, isLoading } = useQuery({ queryKey: ["document", id], queryFn: () => getFn({ data: { id } }) });
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setName((data.name as string) ?? "");
      setContent((data.content_text as string) ?? "");
      setStatus(((data.status as string) === "inactive" ? "inactive" : "active"));
    }
  }, [data]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateFn({ data: { id, patch: { name, status, content_text: content } } });
      await qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Documento atualizado", { description: "A base de conhecimento foi reindexada." });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dlgId = `doc-modal-${id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dlgId}-title`}
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl border border-border-card bg-bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-card p-4">
          <div>
            <div id={`${dlgId}-title`} className="text-[14px] font-semibold text-text-title">{mode === "view" ? "Visualizar documento" : "Editar documento"}</div>
            <div className="text-[11px] text-text-ter">
              {data?.type ?? ""}
              {data?.size ? ` · ${data.size as string}` : ""}
              {data?.created_at ? ` · enviado ${new Date(data.created_at as string).toLocaleString("pt-BR")}` : ""}
              {data?.updated_at && data.updated_at !== data.created_at ? ` · editado ${new Date(data.updated_at as string).toLocaleString("pt-BR")}` : ""}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-text-ter hover:text-text-body"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="text-[12px] text-text-ter">Carregando…</div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-[11px] uppercase text-text-ter">Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} disabled={mode === "view"} className="w-full h-9 rounded-md border border-border-card bg-bg-general px-2 text-[13px] disabled:opacity-70" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase text-text-ter">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as "active" | "inactive")} disabled={mode === "view"} className="h-9 rounded-md border border-border-card bg-bg-general px-2 text-[13px] disabled:opacity-70">
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase text-text-ter">Conteúdo</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} readOnly={mode === "view"} rows={16} className="w-full rounded-md border border-border-card bg-bg-general p-2 text-[12.5px] font-mono leading-relaxed" />
                <div className="mt-1 text-right text-[11px] text-text-ter">{content.length.toLocaleString("pt-BR")} caracteres</div>
              </div>
              {error && <div className="rounded-md bg-error-bg px-3 py-2 text-[12px] text-error">{error}</div>}
            </>
          )}
        </div>
        {mode === "edit" && (
          <div className="flex justify-end gap-2 border-t border-border-card p-3">
            <button onClick={onClose} className="rounded-md border border-border-card px-3 py-1.5 text-[12px] text-text-body hover:bg-bg-general">Cancelar</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar e reindexar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RetrainAnaButton() {
  const retrainFn = useServerFn(retrainAna);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => retrainFn(),
    onSuccess: (r) => {
      toast.success("Ana foi retreinada", {
        description: `${r.objections} objeções · ${r.learned} respostas aprendidas.`,
      });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["sidebar-counts"] });
    },
    onError: (e) => toast.error("Falha ao retreinar", { description: (e as Error).message }),
  });
  return (
    <button
      onClick={() => mut.mutate()}
      disabled={mut.isPending}
      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ia px-3 py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-60"
    >
      {mut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {mut.isPending ? "Retreinando…" : "Retreinar a Ana"}
    </button>
  );
}
