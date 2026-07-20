import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Plus, Download, Loader2, Trash2, Copy, ArrowRightCircle, X } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { toast } from "sonner";
import { formatBRL } from "@/lib/leads-data";
import { generateOrcamentoPDF } from "@/lib/exports";
import {
  createProposal,
  deleteProposal,
  listProposals,
  setProposalStatus,
  duplicateProposal,
  convertProposalToOrder,
  listServices,
  listLeads,
} from "@/lib/crm.functions";

export const Route = createFileRoute("/_authenticated/orcamentos")({ component: Orcamentos });

const STATUS_OPTIONS = ["rascunho", "enviado", "visualizado", "aprovado", "recusado"];

type LineItem = { name: string; qty: number; price: number; unit?: string | null };

function Orcamentos() {
  const qc = useQueryClient();
  const listFn = useServerFn(listProposals);
  const createFn = useServerFn(createProposal);
  const delFn = useServerFn(deleteProposal);
  const setStatusFn = useServerFn(setProposalStatus);
  const dupFn = useServerFn(duplicateProposal);
  const convertFn = useServerFn(convertProposalToOrder);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["proposals"],
    queryFn: () => listFn(),
  });

  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<string>("todos");

  const filtered = tab === "todos" ? rows : rows.filter((r) => (r.status ?? "").toLowerCase() === tab);

  const totalEmitido = rows.reduce((a, r) => a + Number(r.value || 0), 0);
  const aprovado = rows
    .filter((r) => (r.status ?? "").toLowerCase() === "aprovado")
    .reduce((a, r) => a + Number(r.value || 0), 0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["proposals"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["sidebar-counts"] });
  };

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Proposta excluída"); },
  });
  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: string }) => setStatusFn({ data: v }),
    onSuccess: () => { invalidate(); toast.success("Status atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dupMut = useMutation({
    mutationFn: (id: string) => dupFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Proposta duplicada"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const convertMut = useMutation({
    mutationFn: (id: string) => convertFn({ data: { id } }),
    onSuccess: (o: any) => { invalidate(); toast.success(`Convertida em pedido ${o?.number ?? ""}`); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-[11px] uppercase text-text-ter">Total emitido</div>
          <div className="text-[22px] font-semibold text-text-title">{formatBRL(totalEmitido)}</div>
          <div className="text-[11px] text-text-sec">{rows.length} propostas</div>
        </Card>
        <Card>
          <div className="text-[11px] uppercase text-text-ter">Aprovado</div>
          <div className="text-[22px] font-semibold text-success">{formatBRL(aprovado)}</div>
        </Card>
        <Card>
          <div className="text-[11px] uppercase text-text-ter">Rascunho</div>
          <div className="text-[22px] font-semibold text-text-title">
            {rows.filter((r) => (r.status ?? "").toLowerCase() === "rascunho").length}
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-md bg-bg-card p-1 border border-border-card">
          {["todos", ...STATUS_OPTIONS].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1.5 text-[12px] font-medium capitalize ${
                tab === t ? "bg-primary text-primary-foreground" : "text-text-sec hover:bg-bg-general"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
        >
          <Plus className="h-3.5 w-3.5" /> Nova proposta
        </button>
      </div>

      <Card padded={false}>
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-text-sec">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : error ? (
          <div className="p-6 text-error">{(error as Error).message}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-text-ter">
            <FileText className="h-8 w-8" />
            <div className="text-[13px]">Nenhuma proposta ainda.</div>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="border-b border-border-card bg-bg-general/50">
              <tr className="text-left text-[11px] uppercase text-text-ter">
                <th className="p-3">Nº</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Valor</th>
                <th className="p-3">Criado</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-card">
              {filtered.map((o) => {
                const st = (o.status ?? "rascunho").toLowerCase();
                const canConvert = st === "aprovado";
                return (
                  <tr key={o.id} className="hover:bg-bg-general/40">
                    <td className="p-3 font-mono text-[12px] text-text-title">{o.number}</td>
                    <td className="p-3 font-medium text-text-title">{o.client}</td>
                    <td className="p-3 font-medium text-text-title">{formatBRL(Number(o.value || 0))}</td>
                    <td className="p-3 text-text-body">
                      {new Date(o.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-3">
                      <select
                        value={st}
                        disabled={statusMut.isPending}
                        onChange={(e) => statusMut.mutate({ id: o.id, status: e.target.value })}
                        className="h-7 rounded-md border border-border-card bg-bg-card px-2 text-[11px] capitalize outline-none focus:border-primary"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-1.5">
                        <button
                          title="Converter em pedido"
                          disabled={!canConvert || convertMut.isPending}
                          onClick={() =>
                            confirm(`Converter proposta ${o.number} em pedido?`) &&
                            convertMut.mutate(o.id)
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-border-card bg-bg-card px-2 py-1 text-[11px] hover:bg-success hover:text-white hover:border-success disabled:opacity-40"
                        >
                          <ArrowRightCircle className="h-3 w-3" /> Pedido
                        </button>
                        <button
                          title="Duplicar"
                          disabled={dupMut.isPending}
                          onClick={() => dupMut.mutate(o.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-border-card bg-bg-card px-2 py-1 text-[11px] hover:bg-bg-general disabled:opacity-40"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          title="PDF"
                          onClick={() =>
                            generateOrcamentoPDF({
                              id: o.number,
                              cliente: o.client,
                              itens: Array.isArray(o.items) ? o.items.length : 1,
                              valor: Number(o.value || 0),
                              emissao: new Date(o.created_at).toLocaleDateString("pt-BR"),
                              validade: "—",
                              vendedor: o.creator_name ?? "—",
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-border-card bg-bg-card px-2 py-1 text-[11px] hover:bg-primary hover:text-primary-foreground hover:border-primary"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                        <button
                          title="Excluir"
                          onClick={() => confirm(`Excluir proposta ${o.number}?`) && delMut.mutate(o.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-border-card bg-bg-card px-2 py-1 text-[11px] text-text-sec hover:bg-error hover:text-white hover:border-error"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {creating && (
        <NewProposalModal
          nextNumber={`ORC-${String(rows.length + 1).padStart(4, "0")}`}
          onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            await createFn({ data: v });
            invalidate();
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

// ================ Modal ================

function NewProposalModal({
  onClose,
  onSubmit,
  nextNumber,
}: {
  onClose: () => void;
  onSubmit: (v: {
    number: string;
    client: string;
    value: number;
    status?: string;
    items?: LineItem[];
    discount?: number;
    lead_id?: string | null;
  }) => Promise<void>;
  nextNumber: string;
}) {
  const servicesFn = useServerFn(listServices);
  const leadsFn = useServerFn(listLeads);
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: () => servicesFn() });
  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: () => leadsFn() });

  const [form, setForm] = useState({
    number: nextNumber,
    client: "",
    status: "rascunho",
    discount: 0,
    lead_id: "" as string,
  });
  const [items, setItems] = useState<LineItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (services as any[]).forEach((s) => s?.category && set.add(s.category));
    return Array.from(set).sort();
  }, [services]);

  const subtotal = items.reduce((a, it) => a + it.qty * it.price, 0);
  const total = Math.max(0, subtotal - Number(form.discount || 0));

  const addFromService = (id: string) => {
    const s = (services as any[]).find((x) => x.id === id);
    if (!s) return;
    setItems((prev) => [...prev, { name: s.name, qty: 1, price: Number(s.price || 0), unit: s.unit }]);
  };
  const addFromTemplate = (cat: string) => {
    const bundle = (services as any[]).filter((s) => s.category === cat && s.active !== false);
    if (bundle.length === 0) return toast.error("Nenhum item no template");
    setItems((prev) => [
      ...prev,
      ...bundle.map((s) => ({ name: s.name, qty: 1, price: Number(s.price || 0), unit: s.unit })),
    ]);
    if (!form.client && bundle[0]) toast.info(`Template "${cat}" carregado (${bundle.length} itens)`);
  };
  const addBlank = () => setItems((prev) => [...prev, { name: "", qty: 1, price: 0 }]);
  const patchItem = (i: number, p: Partial<LineItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (items.length === 0) { setErr("Adicione pelo menos um item"); return; }
          setBusy(true); setErr(null);
          try {
            await onSubmit({
              number: form.number.trim(),
              client: form.client.trim(),
              value: total,
              status: form.status,
              items,
              discount: Number(form.discount) || 0,
              lead_id: form.lead_id || null,
            });
          } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
        }}
        className="max-h-[90vh] w-[760px] overflow-y-auto rounded-lg bg-bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SectionTitle title="Nova proposta" hint="Use um template ou monte item a item" />

        {/* Templates por tipo de produto */}
        {categories.length > 0 && (
          <div className="mb-4 rounded-md border border-border-card bg-bg-general/40 p-3">
            <div className="mb-2 text-[11px] uppercase text-text-ter">Templates (categorias do catálogo)</div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => addFromTemplate(c)}
                  className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  + {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Número *" value={form.number} onChange={(v) => setForm({ ...form, number: v })} required />
          <div>
            <div className="mb-1 text-[11px] uppercase text-text-ter">Vincular ao lead</div>
            <select
              value={form.lead_id}
              onChange={(e) => {
                const l = (leads as any[]).find((x) => x.id === e.target.value);
                setForm({ ...form, lead_id: e.target.value, client: l?.company ?? form.client });
              }}
              className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]"
            >
              <option value="">— nenhum —</option>
              {(leads as any[]).map((l) => (
                <option key={l.id} value={l.id}>{l.company}</option>
              ))}
            </select>
          </div>
          <Input label="Cliente *" value={form.client} onChange={(v) => setForm({ ...form, client: v })} required />
          <div>
            <div className="mb-1 text-[11px] uppercase text-text-ter">Status</div>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]"
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Itens */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] uppercase text-text-ter">Itens</div>
            <div className="flex gap-2">
              {services.length > 0 && (
                <select
                  onChange={(e) => { if (e.target.value) { addFromService(e.target.value); e.target.value = ""; } }}
                  className="h-8 rounded-md border border-border-card bg-bg-card px-2 text-[12px]"
                  defaultValue=""
                >
                  <option value="">+ do catálogo…</option>
                  {(services as any[]).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {formatBRL(Number(s.price || 0))}
                    </option>
                  ))}
                </select>
              )}
              <button type="button" onClick={addBlank}
                className="rounded-md border border-border-card bg-bg-card px-2 py-1 text-[11px] hover:bg-bg-general">
                + item vazio
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-md border border-dashed border-border-card p-6 text-center text-[12px] text-text-ter">
              Selecione um template acima ou adicione um item do catálogo.
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="text-[10px] uppercase text-text-ter">
                <tr><th className="pb-1 text-left">Descrição</th><th className="pb-1 w-16">Qtd</th><th className="pb-1 w-28">Preço</th><th className="pb-1 w-28 text-right">Subtotal</th><th className="pb-1 w-8"></th></tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-t border-border-card">
                    <td className="py-1.5 pr-2">
                      <input value={it.name} onChange={(e) => patchItem(i, { name: e.target.value })}
                        className="h-8 w-full rounded border border-border-card bg-bg-card px-2 text-[12px]" required />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input type="number" min={0} step="1" value={it.qty}
                        onChange={(e) => patchItem(i, { qty: Number(e.target.value) })}
                        className="h-8 w-full rounded border border-border-card bg-bg-card px-2 text-[12px]" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input type="number" min={0} step="0.01" value={it.price}
                        onChange={(e) => patchItem(i, { price: Number(e.target.value) })}
                        className="h-8 w-full rounded border border-border-card bg-bg-card px-2 text-[12px]" />
                    </td>
                    <td className="py-1.5 pr-2 text-right font-medium text-text-title">{formatBRL(it.qty * it.price)}</td>
                    <td className="py-1.5">
                      <button type="button" onClick={() => removeItem(i)} className="text-text-ter hover:text-error">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Totais */}
        <div className="mt-4 flex items-end justify-between gap-4 border-t border-border-card pt-4">
          <div className="w-40">
            <div className="mb-1 text-[11px] uppercase text-text-ter">Desconto (R$)</div>
            <input type="number" min={0} step="0.01" value={form.discount}
              onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
              className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]" />
          </div>
          <div className="text-right">
            <div className="text-[11px] text-text-ter">Subtotal: {formatBRL(subtotal)}</div>
            <div className="text-[20px] font-semibold text-text-title">Total: {formatBRL(total)}</div>
          </div>
        </div>

        {err && <div className="mt-3 rounded bg-error-bg px-3 py-2 text-[12px] text-error">{err}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-md border border-border-card px-3 py-2 text-[12px] text-text-body hover:bg-bg-general">
            Cancelar
          </button>
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Criar proposta
          </button>
        </div>
      </form>
    </div>
  );
}

function Input({
  label, value, onChange, ...rest
}: {
  label: string; value: string; onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase text-text-ter">{label}</div>
      <input {...rest} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary" />
    </div>
  );
}
