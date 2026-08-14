import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Flame,
  Thermometer,
  Snowflake,
  Bot,
  User as UserIcon,
  Plus,
  Search,
  Eye,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/leads-data";
import { createLead, listLeads, moveLeadStage, deleteLead } from "@/lib/crm.functions";
import type { Database } from "@/types/database";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TempBadge({ t, score }: { t: "hot" | "warm" | "cold"; score?: number }) {
  const map = {
    hot: { Icon: Flame, cls: "bg-hot-bg text-hot", label: "Hot" },
    warm: { Icon: Thermometer, cls: "bg-warm-bg text-warm", label: "Warm" },
    cold: { Icon: Snowflake, cls: "bg-cold-bg text-cold", label: "Cold" },
  } as const;
  const { Icon, cls, label } = map[t];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {score ?? label}
    </span>
  );
}


type Stage = Database["public"]["Enums"]["lead_stage"];
const STAGES: Stage[] = ["Prospecção", "Qualificado", "Proposta", "Negociação", "Pedido", "Fechado", "Perdido"];

export const Route = createFileRoute("/_authenticated/leads")({ component: LeadsPage });

function LeadsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/leads") return <Outlet />;
  
  const qc = useQueryClient();
  const listFn = useServerFn(listLeads);
  const moveFn = useServerFn(moveLeadStage);
  const createFn = useServerFn(createLead);
  const delFn = useServerFn(deleteLead);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => listFn(),
  });

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");

  const segments = Array.from(new Set(leads.map((l: any) => l.segment).filter(Boolean)));

  const filteredLeads = leads.filter((l: any) => {
    const matchesSearch = 
      l.company?.toLowerCase().includes(search.toLowerCase()) ||
      l.contact?.toLowerCase().includes(search.toLowerCase()) ||
      l.segment?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStage = stageFilter === "all" || l.stage === stageFilter;
    const matchesSegment = segmentFilter === "all" || l.segment === segmentFilter;

    return matchesSearch && matchesStage && matchesSegment;
  });

  const moveMut = useMutation({
    mutationFn: (v: { id: string; stage: Stage }) => moveFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-title">Gestão de Leads</h1>
          <p className="text-sm text-text-sec">
            {leads.length} leads no funil · CRM completo com score, tags e responsáveis.
          </p>
        </div>
        <Button className="bg-[#00bfa5] hover:bg-[#00a690] text-white gap-2">
          <Plus className="h-4 w-4" />
          Novo Lead
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-ter" />
          <Input 
            placeholder="Buscar por nome, empresa ou segmento..." 
            className="pl-9 bg-bg-card border-border-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[180px] bg-bg-card border-border-card">
            <SelectValue placeholder="Todas as etapas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etapas</SelectItem>
            {STAGES.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={segmentFilter} onValueChange={setSegmentFilter}>
          <SelectTrigger className="w-[180px] bg-bg-card border-border-card">
            <SelectValue placeholder="Todos os segmentos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os segmentos</SelectItem>
            {segments.map(s => (
              <SelectItem key={s as string} value={s as string}>{s as string}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border-card bg-bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-bg-elev/50">
            <TableRow className="hover:bg-transparent border-border-card">
              <TableHead className="w-12"><input type="checkbox" className="rounded border-border-card" /></TableHead>
              <TableHead className="text-[12px] font-semibold text-text-ter uppercase tracking-wider">Lead / Empresa</TableHead>
              <TableHead className="text-[12px] font-semibold text-text-ter uppercase tracking-wider">Segmento</TableHead>
              <TableHead className="text-[12px] font-semibold text-text-ter uppercase tracking-wider">Score</TableHead>
              <TableHead className="text-[12px] font-semibold text-text-ter uppercase tracking-wider">Etapa</TableHead>
              <TableHead className="text-[12px] font-semibold text-text-ter uppercase tracking-wider">Responsável</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-text-sec">Carregando leads...</TableCell>
              </TableRow>
            ) : filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-text-sec">Nenhum lead encontrado.</TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead: any) => (
                <TableRow key={lead.id} className="border-border-card hover:bg-bg-elev/30 group transition-colors">
                  <TableCell><input type="checkbox" className="rounded border-border-card" /></TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-text-title text-[14px]">{lead.contact || "Sem Contato"}</span>
                      <span className="text-[12px] text-text-sec">{lead.company}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-text-body">{lead.segment || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] text-text-title">{lead.score || 0}</span>
                      <Flame className="h-3.5 w-3.5 text-orange-500 fill-orange-500" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={lead.stage} 
                      onValueChange={(stage) => moveMut.mutate({ id: lead.id, stage: stage as Stage })}
                    >
                      <SelectTrigger className={`h-7 w-fit min-w-[110px] text-[11px] font-bold uppercase rounded-md border-none px-2 ${getStageCls(lead.stage)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${lead.owner === 'ia' ? 'bg-ia-bg text-ia' : 'bg-primary/10 text-primary'}`}>
                        {lead.owner === 'ia' ? <Bot className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                        {lead.owner === 'ia' ? 'Ana (IA)' : 'Humano'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link to="/leads/$id" params={{ id: lead.id }}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-text-ter hover:text-text-title opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function getStageCls(stage: string) {
  switch (stage) {
    case "Prospecção": return "bg-gray-100 text-gray-600";
    case "Qualificado": return "bg-teal-50 text-teal-600";
    case "Proposta": return "bg-orange-50 text-orange-600";
    case "Negociação": return "bg-blue-50 text-blue-600";
    case "Pedido": return "bg-teal-100 text-teal-700";
    case "Fechado": return "bg-[#00bfa5]/10 text-[#00bfa5]";
    case "Perdido": return "bg-red-50 text-red-600";
    default: return "bg-bg-elev text-text-sec";
  }
}
