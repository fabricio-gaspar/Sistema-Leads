import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package, Plus, Loader2, Trash2 } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { formatBRL } from "@/lib/leads-data";
import { createOrder, deleteOrder, listOrders, setOrderStatus } from "@/lib/crm.functions";
import { toast } from "sonner";

const ORDER_STATUS = ["producao", "expedicao", "entregue", "cancelado"];

export const Route = createFileRoute("/_authenticated/pedidos")({ component: Pedidos });

function Pedidos() {
  const qc = useQueryClient();
  const listFn = useServerFn(listOrders);
  const createFn = useServerFn(createOrder);
  const delFn = useServerFn(deleteOrder);
  const statusFn = useServerFn(setOrderStatus);


  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: () => listFn(),
  });

  const [creating, setCreating] = useState(false);

  const total = rows.reduce((a, p) => a + Number(p.value || 0), 0);
  const entregue = rows
    .filter((p) => (p.status ?? "").toLowerCase() === "entregue")
    .reduce((a, p) => a + Number(p.value || 0), 0);
  const producao = rows
    .filter((p) => ["producao", "produção", "em produção"].includes((p.status ?? "").toLowerCase()))
    .reduce((a, p) => a + Number(p.value || 0), 0);

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: string }) => statusFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["orders"] }); toast.success("Status atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-[11px] uppercase text-text-ter">Total faturado</div>
          <div className="text-[22px] font-semibold text-text-title">{formatBRL(total)}</div>
          <div className="text-[11px] text-text-sec">{rows.length} pedidos</div>
        </Card>
        <Card>
          <div className="text-[11px] uppercase text-text-ter">Entregue</div>
          <div className="text-[22px] font-semibold text-success">{formatBRL(entregue)}</div>
        </Card>
        <Card>
          <div className="text-[11px] uppercase text-text-ter">Em produção</div>
          <div className="text-[22px] font-semibold text-warm">{formatBRL(producao)}</div>
        </Card>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
        >
          <Plus className="h-3.5 w-3.5" /> Novo pedido
        </button>
      </div>

      {isLoading ? (
        <Card>
          <div className="flex items-center gap-2 text-text-sec">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        </Card>
      ) : error ? (
        <Card>
          <div className="text-error">{(error as Error).message}</div>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-10 text-center text-text-ter">
            <Package className="h-8 w-8" />
            <div className="text-[13px]">Nenhum pedido ainda.</div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((p) => (
            <Card key={p.id}>
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-[12px] text-text-sec">{p.number}</div>
                    <div className="text-[14px] font-semibold text-text-title">{p.company}</div>
                  </div>
                  <div className="text-[12px] text-text-sec">
                    {p.seller_name ?? "—"} · {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-semibold text-text-title">{formatBRL(Number(p.value || 0))}</div>
                  <span className="inline-flex rounded-full bg-bg-general px-2 py-0.5 text-[11px] capitalize">
                    {p.status ?? "novo"}
                  </span>
                </div>
                <button
                  onClick={() => confirm(`Excluir pedido ${p.number}?`) && delMut.mutate(p.id)}
                  className="ml-2 text-text-ter hover:text-error"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <NewOrderModal
          nextNumber={`PED-${String(rows.length + 1).padStart(4, "0")}`}
          onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            await createFn({ data: v });
            qc.invalidateQueries({ queryKey: ["orders"] });
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function NewOrderModal({
  onClose,
  onSubmit,
  nextNumber,
}: {
  onClose: () => void;
  onSubmit: (v: { number: string; company: string; value: number; status?: string; seller_name?: string }) => Promise<void>;
  nextNumber: string;
}) {
  const [form, setForm] = useState({
    number: nextNumber,
    company: "",
    value: "",
    status: "producao",
    seller_name: "",
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
              company: form.company.trim(),
              value: Number(form.value) || 0,
              status: form.status,
              seller_name: form.seller_name || undefined,
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
        <SectionTitle title="Novo pedido" hint="Cadastro rápido" />
        <div className="space-y-3">
          <Field label="Número *">
            <input
              required
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
            />
          </Field>
          <Field label="Cliente *">
            <input
              required
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$) *">
              <input
                type="number"
                required
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
              />
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]"
              >
                <option value="producao">Em produção</option>
                <option value="expedicao">Expedição</option>
                <option value="entregue">Entregue</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </Field>
          </div>
          <Field label="Vendedor">
            <input
              value={form.seller_name}
              onChange={(e) => setForm({ ...form, seller_name: e.target.value })}
              className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
            />
          </Field>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] uppercase text-text-ter">{label}</div>
      {children}
    </label>
  );
}
