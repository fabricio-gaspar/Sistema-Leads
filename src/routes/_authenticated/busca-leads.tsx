import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, History, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, SectionTitle } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApproachModal, type ApproachChoice } from "@/components/ApproachModal";
import {
  getEnabledSources,
  searchExternalCompanies,
  listSavedSearches,
  type ExternalCompany,
  type SourceId,
} from "@/lib/prospecting.functions";
import { importProspectsAndApproach } from "@/lib/lead-flow.functions";

export const Route = createFileRoute("/_authenticated/busca-leads")({ component: BuscaLeads });

const PORTES = ["MEI", "Micro", "Pequeno", "Médio", "Grande"];

function BuscaLeads() {
  const navigate = useNavigate();
  const [raio, setRaio] = useState([50]);
  const [uf, setUf] = useState("SP");
  const [cidade, setCidade] = useState("São Paulo");
  const [keyword, setKeyword] = useState("");
  const [porte, setPorte] = useState<string | null>(null);
  const [limite, setLimite] = useState(15);
  const [source, setSource] = useState<SourceId>("cnpj_ws");

  const [cacheId, setCacheId] = useState<string | null>(null);
  const [results, setResults] = useState<ExternalCompany[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);

  const searchFn = useServerFn(searchExternalCompanies);
  const sourcesFn = useServerFn(getEnabledSources);
  const historyFn = useServerFn(listSavedSearches);
  const importFn = useServerFn(importProspectsAndApproach);

  const { data: sources } = useQuery({ queryKey: ["prospecting-sources"], queryFn: () => sourcesFn() });
  const { data: history = [], refetch: refetchHistory } = useQuery<any[]>({
    queryKey: ["prospecting-history"],
    queryFn: () => historyFn(),
  });

  const enabledSources = useMemo(() => {
    const map = (sources ?? {}) as Record<string, boolean>;
    return (["cnpj_ws", "google_places", "apify", "ai_only"] as SourceId[]).filter((s) => map[s]);
  }, [sources]);

  const searchMut = useMutation({
    mutationFn: () =>
      searchFn({
        data: {
          source,
          uf: uf || null,
          municipio: cidade || null,
          keyword: keyword || null,
          porte: porte,
          radius_km: source === "google_places" ? Math.min(50, raio[0]) : null,
          limit: limite,
        },
      }),
    onSuccess: (r: any) => {
      setCacheId(r.cache_id);
      setResults(r.results ?? []);
      setSelected(new Set());
      refetchHistory();
      toast.success(`${r.results?.length ?? 0} prospecto(s) encontrado(s)`);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha na busca"),
  });

  const approachMut = useMutation({
    mutationFn: (choice: ApproachChoice) =>
      importFn({
        data: {
          cache_id: cacheId!,
          cnpjs: Array.from(selected),
          approach: choice.approach,
          assignee_id: choice.assignee_id ?? null,
          sla_hours: choice.sla_hours,
        },
      }),
    onSuccess: (r: any) => {
      setModalOpen(false);
      setSelected(new Set());
      toast.success(
        `${r.imported} lead(s) importado(s), ${r.started} abordagem(ns) iniciada(s), ${r.skipped.length + r.blocked.length} ignorado(s)/bloqueado(s).`,
        {
          action: { label: "Abrir no Kanban", onClick: () => navigate({ to: "/leads" }) },
        },
      );
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao importar"),
  });

  const allSelected = results.length > 0 && selected.size === results.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(results.map((r) => r.cnpj)));
  const toggleOne = (cnpj: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cnpj)) next.delete(cnpj);
      else next.add(cnpj);
      return next;
    });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-title">Busca de Leads</h1>
          <p className="text-sm text-text-sec">
            Defina a região, segmentos e volume de prospecção. A abordagem é escolhida depois da seleção.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <SectionTitle title="Localização" hint="Defina a área geográfica da sua busca." />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>País</Label>
                <Input defaultValue="Brasil" disabled />
              </div>
              <div className="space-y-2">
                <Label>Estado (UF)</Label>
                <Input value={uf} maxLength={2} onChange={(e) => setUf(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Raio de atuação</Label>
                <span className="font-semibold text-primary">{raio[0]} km</span>
              </div>
              <Slider value={raio} max={200} step={5} onValueChange={setRaio} />
              <p className="text-[11px] text-text-sec">O raio é aplicado quando a fonte Google Places está ativa.</p>
            </div>
          </Card>

          <Card>
            <SectionTitle title="Segmentos e porte" hint="Quais empresas a Ana deve buscar?" />
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Segmento / palavra-chave</Label>
                <Input
                  value={keyword}
                  placeholder="Ex.: Tecnologia, Logística, Clínica"
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-2 block">Porte das empresas</Label>
                <div className="flex flex-wrap gap-2">
                  {PORTES.map((p) => (
                    <Badge
                      key={p}
                      onClick={() => setPorte(porte === p ? null : p)}
                      variant={porte === p ? "default" : "outline"}
                      className="cursor-pointer"
                    >
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fonte de dados</Label>
                <Select value={source} onValueChange={(v) => setSource(v as SourceId)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(enabledSources.length ? enabledSources : (["cnpj_ws"] as SourceId[])).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === "cnpj_ws" ? "Receita (CNPJ.ws)" : s === "google_places" ? "Google Places" : s === "apify" ? "Apify" : "IA (sugestões)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle title="Volume da busca" />
            <div className="mt-2 flex items-center gap-4">
              <Input
                type="number"
                className="w-24"
                min={1}
                max={30}
                value={limite}
                onChange={(e) => setLimite(Math.max(1, Math.min(30, Number(e.target.value))))}
              />
              <span className="text-sm text-text-sec">prospectos por busca</span>
            </div>
            <Button
              className="mt-6 w-full gap-2"
              onClick={() => searchMut.mutate()}
              disabled={searchMut.isPending}
            >
              {searchMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar leads agora
            </Button>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <SectionTitle title="Resumo da busca" />
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-text-sec">Local</span><span className="font-medium">{cidade || "—"} {uf ? `- ${uf}` : ""}</span></div>
              <div className="flex justify-between"><span className="text-text-sec">Raio</span><span className="font-medium">{raio[0]} km</span></div>
              <div className="flex justify-between"><span className="text-text-sec">Segmento</span><span className="font-medium">{keyword || "todos"}</span></div>
              <div className="flex justify-between"><span className="text-text-sec">Porte</span><span className="font-medium">{porte ?? "todos"}</span></div>
              <hr className="border-border-card" />
              <div className="flex justify-between text-lg font-bold"><span className="text-text-sec">Resultados</span><span>{results.length}</span></div>
              <div className="flex justify-between"><span className="text-text-sec">Selecionados</span><span className="font-medium">{selected.size}</span></div>
              <Button
                className="w-full"
                disabled={!selected.size || !cacheId}
                onClick={() => setModalOpen(true)}
              >
                Enviar selecionados para Leads
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {results.length > 0 && (
        <Card>
          <SectionTitle
            title="Prospectos encontrados"
            hint="Selecione e escolha a abordagem. Nenhum contato é feito nesta etapa."
          />
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Selecionar todos" />
                </TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Canais</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((c) => (
                <TableRow key={c.cnpj}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(c.cnpj)}
                      onCheckedChange={() => toggleOne(c.cnpj)}
                      aria-label={`Selecionar ${c.razao_social}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-text-title">{c.nome_fantasia || c.razao_social}</div>
                    <div className="text-xs text-text-sec">{c.cnpj}</div>
                  </TableCell>
                  <TableCell className="text-xs">{c.cnae_descricao ?? "—"}</TableCell>
                  <TableCell className="text-xs">{[c.municipio, c.uf].filter(Boolean).join("/") || "—"}</TableCell>
                  <TableCell className="space-x-1 text-xs">
                    {c.whatsapp && <Badge variant="outline">WhatsApp</Badge>}
                    {c.email && <Badge variant="outline">E-mail</Badge>}
                    {c.telefone && <Badge variant="outline">Telefone</Badge>}
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-primary">{c.score ?? "—"}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card>
        <SectionTitle
          title="Histórico de prospecções"
          action={<Button variant="ghost" size="sm" className="gap-2"><History className="h-4 w-4" /> Ver tudo</Button>}
        />
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Busca</TableHead>
              <TableHead>Fonte</TableHead>
              <TableHead>Resultados</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-text-sec">
                  Nenhuma prospecção registrada ainda.
                </TableCell>
              </TableRow>
            )}
            {history.map((h: any) => (
              <TableRow key={h.id}>
                <TableCell className="text-xs">{new Date(h.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-xs">{h.name}</TableCell>
                <TableCell className="text-xs">{h.source}</TableCell>
                <TableCell className="text-xs">{h.total_found}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 text-xs text-ok">
                    <CheckCircle2 className="h-3 w-3" /> Concluída
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ApproachModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        count={selected.size}
        submitting={approachMut.isPending}
        onConfirm={(choice) => approachMut.mutate(choice)}
      />
    </div>
  );
}
