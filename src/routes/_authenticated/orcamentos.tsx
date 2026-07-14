import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Plus, Download, Loader2, Trash2 } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { formatBRL } from "@/lib/leads-data";
import { generateOrcamentoPDF } from "@/lib/exports";
import { createProposal, deleteProposal, listProposals } from "@/lib/crm.functions";

export const Route = createFileRoute("/_authenticated/orcamentos")({ component: Orcamentos });

function Orcamentos() {
  const qc = useQueryClient();
  const listFn = useServerFn(listProposals);
  const createFn = useServerFn(createProposal);
  const delFn = useServerFn(deleteProposal);

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

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposals"] }),
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
          {["todos", "rascunho", "enviado", "visualizado", "aprovado", "recusado"].map((t) => (
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
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-bg-general/40">
                  <td className="p-3 font-mono text-[12px] text-text-title">{o.number}</td>
                  <td className="p-3 font-medium text-text-title">{o.client}</td>
                  <td className="p-3 font-medium text-text-title">{formatBRL(Number(o.value || 0))}</td>
                  <td className="p-3 text-text-body">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-3">
                    <span className="rounded-full bg-bg-general px-2 py-0.5 text-[11px] capitalize">
                      {o.status ?? "rascunho"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
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
                        <Download className="h-3 w-3" /> PDF
                      </button>
                      <button
                        onClick={() => confirm(`Excluir proposta ${o.number}?`) && delMut.mutate(o.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-border-card bg-bg-card px-2 py-1 text-[11px] text-text-sec hover:bg-error hover:text-white hover:border-error"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
            qc.invalidateQueries({ queryKey: ["proposals"] });
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

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
  }) => Promise<void>;
  nextNumber: string;
}) {
  const [form, setForm] = useState({
    number: nextNumber,
    client: "",
    value: "",
    status: "rascunho",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await onSubmit({
              number: form.number.trim(),
              client: form.client.trim(),
              value: Number(form.value) || 0,
              status: form.status,
            });
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        className="w-[520px] rounded-lg bg-bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SectionTitle title="Nova proposta" hint="Cadastro rápido" />
        <div className="space-y-3">
          <Input label="Número *" value={form.number} onChange={(v) => setForm({ ...form, number: v })} required />
          <Input label="Cliente *" value={form.client} onChange={(v) => setForm({ ...form, client: v })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valor (R$) *"
              type="number"
              value={form.value}
              onChange={(v) => setForm({ ...form, value: v })}
              required
            />
            <div>
              <div className="mb-1 text-[11px] uppercase text-text-ter">Status</div>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]"
              >
                <option>rascunho</option>
                <option>enviado</option>
                <option>visualizado</option>
                <option>aprovado</option>
                <option>recusado</option>
              </select>
            </div>
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
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Criar
          </button>
        </div>
      </form>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase text-text-ter">{label}</div>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
      />
    </div>
  );
}
