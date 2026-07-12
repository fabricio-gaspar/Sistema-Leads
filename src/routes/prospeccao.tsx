import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { Search, Sparkles, User, Filter, Download } from "lucide-react";
import { Card, SectionTitle, TempBadge } from "@/components/ui-kit";
import { formatBRL } from "@/lib/leads-data";

export const Route = createFileRoute("/prospeccao")({ component: Prospeccao });

type Prospect = {
  id: string;
  empresa: string;
  cnpj: string;
  cidade: string;
  uf: string;
  segmento: string;
  porte: string;
  funcionarios: number;
  faturamento: number;
  score: number;
  temp: "hot" | "warm" | "cold";
  motivos: string[];
};

const PROSPECTS: Prospect[] = [
  { id: "P1", empresa: "Metalúrgica Alto Aço", cnpj: "12.345.678/0001-01", cidade: "Diadema", uf: "SP", segmento: "Metalurgia", porte: "Médio", funcionarios: 180, faturamento: 42000000, score: 89, temp: "hot", motivos: ["Fit de segmento perfeito", "Volume compatível", "Região atendida"] },
  { id: "P2", empresa: "Ind. Estamparia BR", cnpj: "22.345.678/0001-02", cidade: "São Bernardo", uf: "SP", segmento: "Metalurgia", porte: "Médio", funcionarios: 220, faturamento: 55000000, score: 92, temp: "hot", motivos: ["Concorrente direto de cliente atual", "Cargo de compra decisor"] },
  { id: "P3", empresa: "Fabricante Cortelaser SP", cnpj: "32.345.678/0001-03", cidade: "Guarulhos", uf: "SP", segmento: "Metalurgia", porte: "Grande", funcionarios: 450, faturamento: 120000000, score: 76, temp: "warm", motivos: ["Faturamento alto", "Ticket estimado > R$100k"] },
  { id: "P4", empresa: "TecnoPeças ABC", cnpj: "42.345.678/0001-04", cidade: "Santo André", uf: "SP", segmento: "Automotivo", porte: "Médio", funcionarios: 150, faturamento: 38000000, score: 72, temp: "warm", motivos: ["Segmento adjacente", "Sem fornecedor exclusivo"] },
  { id: "P5", empresa: "Metalurgia Vale do Sinos", cnpj: "52.345.678/0001-05", cidade: "Novo Hamburgo", uf: "RS", segmento: "Metalurgia", porte: "Pequeno", funcionarios: 45, faturamento: 8000000, score: 54, temp: "cold", motivos: ["Fora da região ideal", "Volume baixo"] },
  { id: "P6", empresa: "Ind. Ferrocampo", cnpj: "62.345.678/0001-06", cidade: "Campinas", uf: "SP", segmento: "Construção", porte: "Médio", funcionarios: 210, faturamento: 60000000, score: 68, temp: "warm", motivos: ["Compra recorrente de chapas"] },
  { id: "P7", empresa: "Estamparia União", cnpj: "72.345.678/0001-07", cidade: "Osasco", uf: "SP", segmento: "Metalurgia", porte: "Médio", funcionarios: 130, faturamento: 27000000, score: 81, temp: "hot", motivos: ["Perdeu fornecedor recentemente (sinal)"] },
  { id: "P8", empresa: "Auto Estampados MG", cnpj: "82.345.678/0001-08", cidade: "Betim", uf: "MG", segmento: "Automotivo", porte: "Grande", funcionarios: 380, faturamento: 95000000, score: 79, temp: "warm", motivos: ["Cluster automotivo", "Volume compatível"] },
];

const SEGMENTOS = ["Todos", "Metalurgia", "Automotivo", "Construção", "Plásticos"];
const UFS = ["Todas", "SP", "MG", "RS", "PR", "SC"];
const PORTES = ["Todos", "Pequeno", "Médio", "Grande"];

function Prospeccao() {
  const [seg, setSeg] = useState("Todos");
  const [uf, setUf] = useState("Todas");
  const [porte, setPorte] = useState("Todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openScore, setOpenScore] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      PROSPECTS.filter(
        (p) =>
          (seg === "Todos" || p.segmento === seg) &&
          (uf === "Todas" || p.uf === uf) &&
          (porte === "Todos" || p.porte === porte),
      ),
    [seg, uf, porte],
  );

  function toggle(id: string) {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  }
  function toggleAll() {
    setSelected(selected.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)));
  }
  function bulk(to: "ana" | "humano") {
    const count = selected.size;
    if (!count) return;
    setFlash(
      to === "ana"
        ? `🤖 Ana iniciará abordagem em ${count} prospect(s) via WhatsApp em até 2 min.`
        : `👤 ${count} prospect(s) atribuídos ao seu time humano.`,
    );
    setSelected(new Set());
    setTimeout(() => setFlash(null), 3500);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ia-bg text-ia">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-text-title">Ana encontrou 2.847 empresas com fit para você</div>
            <div className="text-[12px] text-text-sec">Base atualizada há 12 min · filtros abaixo refinam os resultados</div>
          </div>
          <button className="flex items-center gap-1.5 rounded-md border border-border-card px-3 py-2 text-[12px] text-text-body hover:bg-bg-general">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Buscar empresa">
            <div className="flex h-9 w-64 items-center gap-2 rounded-md border border-border-card px-3">
              <Search className="h-3.5 w-3.5 text-text-ter" />
              <input placeholder="Nome, CNPJ..." className="flex-1 bg-transparent text-[13px] outline-none" />
            </div>
          </Field>
          <Select label="Segmento" value={seg} onChange={setSeg} options={SEGMENTOS} />
          <Select label="UF" value={uf} onChange={setUf} options={UFS} />
          <Select label="Porte" value={porte} onChange={setPorte} options={PORTES} />
          <button className="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover">
            <Filter className="h-3.5 w-3.5" /> Aplicar filtros
          </button>
        </div>
      </Card>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="text-[13px] text-text-title">
            <span className="font-semibold">{selected.size}</span> prospect(s) selecionado(s)
          </div>
          <div className="flex gap-2">
            <button onClick={() => bulk("ana")} className="flex items-center gap-1.5 rounded-md bg-ia px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90">
              <Sparkles className="h-3.5 w-3.5" /> Enviar para Ana
            </button>
            <button onClick={() => bulk("humano")} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover">
              <User className="h-3.5 w-3.5" /> Atribuir ao vendedor
            </button>
          </div>
        </div>
      )}

      {flash && (
        <div className="rounded-lg border border-success/40 bg-success-bg px-4 py-2.5 text-[13px] text-success">
          {flash}
        </div>
      )}

      <Card padded={false}>
        <table className="w-full text-[13px]">
          <thead className="border-b border-border-card bg-bg-general/50">
            <tr className="text-left text-[11px] uppercase text-text-ter">
              <th className="p-3 w-8"><input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} /></th>
              <th className="p-3">Empresa</th>
              <th className="p-3">Segmento</th>
              <th className="p-3">Localização</th>
              <th className="p-3">Porte</th>
              <th className="p-3">Faturamento est.</th>
              <th className="p-3">Score Ana</th>
              <th className="p-3">Temperatura</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-card">
            {rows.map((p) => (
              <>
                <tr key={p.id} className="hover:bg-bg-general/40">
                  <td className="p-3"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></td>
                  <td className="p-3">
                    <div className="font-medium text-text-title">{p.empresa}</div>
                    <div className="text-[11px] text-text-ter">{p.cnpj}</div>
                  </td>
                  <td className="p-3 text-text-body">{p.segmento}</td>
                  <td className="p-3 text-text-body">{p.cidade}/{p.uf}</td>
                  <td className="p-3 text-text-body">{p.porte} · {p.funcionarios} func.</td>
                  <td className="p-3 text-text-body">{formatBRL(p.faturamento)}</td>
                  <td className="p-3">
                    <button
                      onClick={() => setOpenScore(openScore === p.id ? null : p.id)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-ia-bg px-2 py-1 text-[12px] font-semibold text-ia hover:opacity-80"
                    >
                      <Sparkles className="h-3 w-3" /> {p.score}
                    </button>
                  </td>
                  <td className="p-3"><TempBadge t={p.temp} /></td>
                </tr>
                {openScore === p.id && (
                  <tr key={p.id + "-x"} className="bg-ia-bg/30">
                    <td colSpan={8} className="p-4">
                      <div className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 h-4 w-4 text-ia" />
                        <div>
                          <div className="text-[12px] font-semibold text-text-title">Por que a Ana deu score {p.score}?</div>
                          <ul className="mt-1.5 space-y-1 text-[12.5px] text-text-body">
                            {p.motivos.map((m) => (
                              <li key={m}>• {m}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
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
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-md border border-border-card bg-bg-card px-2 text-[13px] outline-none">
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </Field>
  );
}
