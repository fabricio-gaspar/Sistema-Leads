import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Plus, Download, Loader2, Trash2, Copy, X, ShieldCheck } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { toast } from "sonner";
import { formatBRL } from "@/lib/leads-data";
import { generateOrcamentoPDF } from "@/lib/exports";
import { createProposal, deleteProposal, listProposals, setProposalStatus, duplicateProposal, listServices, listLeads } from "@/lib/crm.functions";

export const Route = createFileRoute("/_authenticated/orcamentos")({ component: Orcamentos });
const STATUS_OPTIONS = ["rascunho", "enviado", "visualizado", "aprovado", "recusado"] as const;
type LineItem = { name: string; qty: number; price: number; unit?: string | null };

function Orcamentos() {
  const qc = useQueryClient();
  const listFn = useServerFn(listProposals), createFn = useServerFn(createProposal), delFn = useServerFn(deleteProposal), statusFn = useServerFn(setProposalStatus), duplicateFn = useServerFn(duplicateProposal);
  const { data: rows = [], isLoading, error } = useQuery({ queryKey: ["proposals"], queryFn: () => listFn() });
  const [creating, setCreating] = useState(false), [tab, setTab] = useState("todos");
  const filtered = tab === "todos" ? rows : rows.filter((row) => (row.status ?? "").toLowerCase() === tab);
  const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
  const approved = rows.filter((row) => ["aprovado", "approved"].includes((row.status ?? "").toLowerCase()));
  const drafts = rows.filter((row) => ["rascunho", "draft", "pending"].includes((row.status ?? "").toLowerCase()));
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["proposals"] }); qc.invalidateQueries({ queryKey: ["sidebar-counts"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); };
  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }), onSuccess: () => { invalidate(); toast.success("Proposta excluída"); }, onError: (e: Error) => toast.error(e.message) });
  const status = useMutation({ mutationFn: (value: { id: string; status: string }) => statusFn({ data: value }), onSuccess: () => { invalidate(); toast.success("Status atualizado"); }, onError: (e: Error) => toast.error(e.message) });
  const duplicate = useMutation({ mutationFn: (id: string) => duplicateFn({ data: { id } }), onSuccess: () => { invalidate(); toast.success("Proposta duplicada"); }, onError: (e: Error) => toast.error(e.message) });
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Propostas emitidas" value={String(rows.length)} hint={formatBRL(total)} />
      <Metric label="Aprovadas" value={String(approved.length)} hint={formatBRL(approved.reduce((sum, row) => sum + Number(row.value || 0), 0))} />
      <Metric label="Aguardando revisão" value={String(drafts.length)} hint="Rascunho exige validação humana" />
    </div>
    <Card className="flex items-start gap-3 border-primary/20 bg-primary/5">
      <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
      <div><div className="text-[12px] font-semibold text-text-title">Orçamento, não pedido</div><div className="mt-0.5 text-[11px] text-text-sec">A Ana pode preparar um rascunho, mas preço, desconto e envio final permanecem sob aprovação humana. Este CRM não cria pedido, cobrança ou checkout.</div></div>
    </Card>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-1 rounded-md border border-border-card bg-bg-card p-1">{["todos", ...STATUS_OPTIONS].map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded px-3 py-1.5 text-[12px] font-medium capitalize ${tab === item ? "bg-primary text-primary-foreground" : "text-text-sec hover:bg-bg-general"}`}>{item}</button>)}</div>
      <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Nova proposta</button>
    </div>
    <Card padded={false}>{isLoading ? <div className="flex items-center gap-2 p-6 text-text-sec"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div> : error ? <div className="p-6 text-error">{(error as Error).message}</div> : filtered.length === 0 ? <div className="flex flex-col items-center gap-2 p-10 text-center text-text-ter"><FileText className="h-8 w-8" /><div className="text-[13px]">Nenhuma proposta neste status.</div></div> : <div className="overflow-x-auto"><table className="w-full text-[13px]"><thead className="border-b border-border-card bg-bg-general/50"><tr className="text-left text-[11px] uppercase text-text-ter"><th className="p-3">Nº</th><th className="p-3">Cliente</th><th className="p-3">Valor</th><th className="p-3">Criado</th><th className="p-3">Status</th><th className="p-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-border-card">{filtered.map((row) => { const current=(row.status??"rascunho").toLowerCase(); return <tr key={row.id} className="hover:bg-bg-general/40"><td className="p-3 font-mono text-[12px] text-text-title">{row.number}</td><td className="p-3 font-medium text-text-title">{row.client}</td><td className="p-3 font-medium text-text-title">{formatBRL(Number(row.value||0))}</td><td className="p-3 text-text-body">{new Date(row.created_at).toLocaleDateString("pt-BR")}</td><td className="p-3"><select value={STATUS_OPTIONS.includes(current as any) ? current : "rascunho"} onChange={(e) => status.mutate({ id: row.id, status: e.target.value })} disabled={status.isPending} className="h-8 rounded-md border border-border-card bg-bg-card px-2 text-[11px] capitalize">{STATUS_OPTIONS.map((s)=><option key={s} value={s}>{s}</option>)}</select></td><td className="p-3 text-right"><div className="inline-flex gap-1.5"><button title="Duplicar" onClick={() => duplicate.mutate(row.id)} className="rounded-md border border-border-card p-2 hover:bg-bg-general"><Copy className="h-3.5 w-3.5" /></button><button title="Gerar PDF" onClick={() => generateOrcamentoPDF({ id: row.number, cliente: row.client, itens: Array.isArray(row.items) ? row.items.length : 0, valor: Number(row.value||0), emissao: new Date(row.created_at).toLocaleDateString("pt-BR"), validade: "—", vendedor: row.creator_name ?? "—" })} className="rounded-md border border-border-card p-2 hover:bg-primary hover:text-primary-foreground"><Download className="h-3.5 w-3.5" /></button><button title="Excluir" onClick={() => confirm(`Excluir proposta ${row.number}?`) && del.mutate(row.id)} className="rounded-md border border-border-card p-2 text-text-sec hover:bg-error hover:text-white"><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr> })}</tbody></table></div>}</Card>
    {creating && <NewProposalModal nextNumber={`ORC-${String(rows.length+1).padStart(4,"0")}`} onClose={() => setCreating(false)} onSubmit={async (value) => { await createFn({ data: value }); invalidate(); setCreating(false); }} />}
  </div>;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) { return <Card><div className="text-[11px] uppercase text-text-ter">{label}</div><div className="mt-1 text-[22px] font-semibold text-text-title">{value}</div><div className="text-[11px] text-text-sec">{hint}</div></Card>; }

function NewProposalModal({ onClose, onSubmit, nextNumber }: { onClose: () => void; onSubmit: (value: { number: string; client: string; value: number; status?: string; items?: LineItem[]; discount?: number; lead_id?: string | null }) => Promise<void>; nextNumber: string }) {
  const servicesFn = useServerFn(listServices), leadsFn = useServerFn(listLeads);
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: () => servicesFn() });
  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: () => leadsFn() });
  const [form,setForm]=useState({number:nextNumber,client:"",status:"rascunho",discount:0,lead_id:""}),[items,setItems]=useState<LineItem[]>([]),[busy,setBusy]=useState(false),[err,setErr]=useState<string|null>(null);
  const subtotal=items.reduce((sum,item)=>sum+item.qty*item.price,0),total=Math.max(0,subtotal-Number(form.discount||0));
  const addService=(id:string)=>{const service=(services as any[]).find((item)=>item.id===id);if(service)setItems((prev)=>[...prev,{name:service.name,qty:1,price:Number(service.price||0),unit:service.unit}]);};
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}><form onClick={(e)=>e.stopPropagation()} onSubmit={async(e)=>{e.preventDefault();if(!items.length){setErr("Adicione pelo menos um item.");return}setBusy(true);setErr(null);try{await onSubmit({number:form.number.trim(),client:form.client.trim(),value:total,status:form.status,items,discount:Number(form.discount)||0,lead_id:form.lead_id||null})}catch(error){setErr((error as Error).message)}finally{setBusy(false)}}} className="max-h-[90vh] w-full max-w-[760px] overflow-y-auto rounded-lg bg-bg-card p-6 shadow-2xl">
    <div className="mb-4 flex items-center justify-between"><SectionTitle title="Nova proposta" hint="Rascunho comercial sujeito a aprovação" /><button type="button" onClick={onClose}><X className="h-4 w-4" /></button></div>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Número"><input required value={form.number} onChange={(e)=>setForm({...form,number:e.target.value})} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3" /></Field><Field label="Lead"><select value={form.lead_id} onChange={(e)=>{const lead=(leads as any[]).find((l)=>l.id===e.target.value);setForm({...form,lead_id:e.target.value,client:lead?.company||form.client})}} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2"><option value="">Selecione…</option>{(leads as any[]).map((lead)=><option key={lead.id} value={lead.id}>{lead.company}</option>)}</select></Field><Field label="Cliente"><input required value={form.client} onChange={(e)=>setForm({...form,client:e.target.value})} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3" /></Field><Field label="Adicionar do catálogo"><select defaultValue="" onChange={(e)=>{if(e.target.value)addService(e.target.value);e.currentTarget.value=""}} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2"><option value="">Escolha um serviço/produto…</option>{(services as any[]).filter((s)=>s.active!==false).map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field></div>
    <div className="mt-4 space-y-2">{items.map((item,index)=><div key={index} className="grid grid-cols-[1fr_80px_120px_36px] gap-2"><input value={item.name} onChange={(e)=>setItems((prev)=>prev.map((x,i)=>i===index?{...x,name:e.target.value}:x))} className="h-9 rounded-md border border-border-card px-2" placeholder="Item" /><input type="number" min="0.01" step="0.01" value={item.qty} onChange={(e)=>setItems((prev)=>prev.map((x,i)=>i===index?{...x,qty:Number(e.target.value)}:x))} className="h-9 rounded-md border border-border-card px-2" /><input type="number" min="0" step="0.01" value={item.price} onChange={(e)=>setItems((prev)=>prev.map((x,i)=>i===index?{...x,price:Number(e.target.value)}:x))} className="h-9 rounded-md border border-border-card px-2" /><button type="button" onClick={()=>setItems((prev)=>prev.filter((_,i)=>i!==index))} className="text-error"><Trash2 className="h-4 w-4" /></button></div>)}</div>
    <button type="button" onClick={()=>setItems((prev)=>[...prev,{name:"",qty:1,price:0}])} className="mt-3 text-[12px] font-medium text-primary">+ Item manual</button>
    <div className="mt-4 grid gap-3 sm:grid-cols-3"><Field label="Desconto (R$)"><input type="number" min="0" step="0.01" value={form.discount} onChange={(e)=>setForm({...form,discount:Number(e.target.value)})} className="h-9 w-full rounded-md border border-border-card px-3" /></Field><div className="sm:col-span-2 rounded-md bg-bg-general p-3 text-right"><div className="text-[11px] text-text-sec">Total do orçamento</div><div className="text-[20px] font-semibold text-text-title">{formatBRL(total)}</div></div></div>
    {err&&<div className="mt-3 rounded bg-error-bg px-3 py-2 text-[12px] text-error">{err}</div>}
    <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-md border border-border-card px-3 py-2 text-[12px]">Cancelar</button><button disabled={busy} className="rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground">{busy?"Salvando…":"Criar rascunho"}</button></div>
  </form></div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><div className="mb-1 text-[11px] uppercase text-text-ter">{label}</div>{children}</label>}
