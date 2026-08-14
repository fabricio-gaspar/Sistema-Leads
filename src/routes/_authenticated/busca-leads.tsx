import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, MapPin, Building2, Zap, Target, History } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/busca-leads")({ component: BuscaLeads });

function BuscaLeads() {
  const [raio, setRaio] = useState([50]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-title">Busca de Leads</h1>
          <p className="text-sm text-text-sec">Defina a região, segmentos e volume de prospecção. A Ana busca leads automaticamente.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <SectionTitle title="Localização" hint="Defina a área geográfica da sua busca." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label>País</Label>
                <Input defaultValue="Brasil" />
              </div>
              <div className="space-y-2">
                <Label>Estado (UF)</Label>
                <Input defaultValue="SP" />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input defaultValue="São Paulo" />
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Raio de atuação</Label>
                <span className="font-semibold text-primary">{raio} km</span>
              </div>
              <Slider defaultValue={raio} max={200} step={5} onValueChange={setRaio} />
            </div>
          </Card>

          <Card>
            <SectionTitle title="Segmentos e porte" hint="Quais empresas a Ana deve buscar?" />
            <div className="space-y-4 mt-4">
              <div>
                <Label className="mb-2 block">Segmentos desejados</Label>
                <div className="flex flex-wrap gap-2">
                  {["Tecnologia", "Indústria", "Logística", "Saúde"].map(s => (
                    <Badge key={s} className="bg-[#00bfa5] text-white cursor-pointer">{s} ×</Badge>
                  ))}
                  <Button variant="outline" size="sm" className="h-6 text-xs">+ Adicionar</Button>
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Porte das empresas</Label>
                <div className="flex gap-2">
                  {["MEI", "Micro", "Pequeno", "Médio", "Grande"].map(p => (
                    <Badge key={p} variant="outline" className="cursor-pointer hover:bg-bg-elev">{p}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle title="Volume diário" />
            <div className="flex items-center gap-4 mt-2">
              <Input type="number" className="w-24" defaultValue={30} />
              <span className="text-sm text-text-sec">leads por dia</span>
            </div>
            <Button className="mt-6 w-full bg-[#00bfa5] hover:bg-[#00a690] text-white gap-2">
              <Search className="h-4 w-4" /> Buscar leads agora
            </Button>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <SectionTitle title="Resumo da busca" />
            <div className="space-y-3 text-sm mt-4">
              <div className="flex justify-between"><span className="text-text-sec">Local</span><span className="font-medium">São Paulo - SP</span></div>
              <div className="flex justify-between"><span className="text-text-sec">Raio</span><span className="font-medium">50 km</span></div>
              <div className="flex justify-between"><span className="text-text-sec">Segmentos</span><span className="font-medium">4 selecionados</span></div>
              <div className="flex justify-between"><span className="text-text-sec">Portes</span><span className="font-medium">2 selecionados</span></div>
              <hr className="border-border-card" />
              <div className="flex justify-between font-bold text-lg"><span className="text-text-sec">Volume</span><span>30 leads/dia</span></div>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <SectionTitle title="Histórico de prospecções" action={<Button variant="ghost" size="sm" className="gap-2"><History className="h-4 w-4" /> Ver tudo</Button>} />
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Região</TableHead>
              <TableHead>Segmentos</TableHead>
              <TableHead>Resultados</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              { data: "2026-08-12", regiao: "SP (50km)", seg: "Tecnologia", res: "48", status: "Concluída" },
              { data: "2026-08-11", regiao: "BH (30km)", seg: "Saúde", res: "31", status: "Concluída" },
            ].map((row, i) => (
              <TableRow key={i}>
                <TableCell>{row.data}</TableCell>
                <TableCell>{row.regiao}</TableCell>
                <TableCell>{row.seg}</TableCell>
                <TableCell>{row.res}</TableCell>
                <TableCell><Badge className="bg-success-bg text-success hover:bg-success-bg">{row.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
