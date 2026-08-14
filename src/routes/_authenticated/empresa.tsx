import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Building2,
  Upload,
  FileText,
  Settings,
  Target,
  MessageSquareText,
  Save,
  Plus,
  Trash2,
  Globe,
  MapPin,
  Phone,
  Mail,
  Zap,
} from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/empresa")({ component: Empresa });

type Tab = "dados" | "abordagem" | "apresentacao" | "documentos";

function Empresa() {
  const [activeTab, setActiveTab] = useState<Tab>("dados");

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "dados", label: "Dados", icon: Settings },
    { id: "abordagem", label: "Abordagem", icon: Target },
    { id: "apresentacao", label: "Apresentação", icon: MessageSquareText },
    { id: "documentos", label: "Documentos", icon: FileText },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-title">Configurações da Empresa</h1>
          <p className="text-sm text-text-sec">Gerencie as operações, IA e base de conhecimento da sua empresa.</p>
        </div>
        <Button className="bg-[#00bfa5] hover:bg-[#00a690] text-white gap-2">
          <Save className="h-4 w-4" />
          Salvar Alterações
        </Button>
      </div>

      <div className="flex gap-2 p-1 bg-bg-elev rounded-lg w-fit border border-border-card">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? "bg-[#00bfa5] text-white shadow-sm"
                  : "text-text-sec hover:text-text-title"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {activeTab === "dados" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card>
                <SectionTitle title="Informações Gerais" hint="Dados cadastrais e de contato da sede." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>Nome da Empresa</Label>
                    <Input defaultValue="WayFlex Industrial" />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input defaultValue="12.345.678/0001-90" />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 h-4 w-4 text-text-sec" />
                      <Input className="pl-9" defaultValue="www.wayflex.com.br" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Segmento</Label>
                    <Select defaultValue="industria">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o segmento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="industria">Indústria e Manufatura</SelectItem>
                        <SelectItem value="servicos">Serviços B2B</SelectItem>
                        <SelectItem value="tecnologia">Tecnologia / SaaS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>

              <Card>
                <SectionTitle title="Localização" hint="Endereço principal para cálculo de logística e raio." />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label>Logradouro</Label>
                    <Input defaultValue="Av. Industrial, 1500" />
                  </div>
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input defaultValue="09080-510" />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input defaultValue="Santo André" />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado (UF)</Label>
                    <Input defaultValue="SP" />
                  </div>
                  <div className="space-y-2">
                    <Label>País</Label>
                    <Input defaultValue="Brasil" />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === "abordagem" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <SectionTitle title="Canais de Saída" hint="Configure as contas para disparo de cadência." />
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Conectar Canal
                  </Button>
                </div>
                <div className="space-y-4 mt-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border-card bg-bg-elev/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <div className="font-medium text-text-title">WhatsApp (Z-API)</div>
                        <div className="text-xs text-text-sec">+55 11 98888-7777 · Conectado</div>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border-card bg-bg-elev/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <div className="font-medium text-text-title">E-mail (Resend)</div>
                        <div className="text-xs text-text-sec">contato@wayflex.com.br · Conectado</div>
                      </div>
                    </div>
                    <Switch checked={true} />
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between mb-4">
                  <SectionTitle title="Sequências de Outreach" hint="Defina a ordem e o tempo das abordagens." />
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Nova Etapa
                  </Button>
                </div>
                <div className="space-y-3 mt-4">
                  {[
                    { step: 1, channel: "WhatsApp", time: "Imediato", type: "Introdução" },
                    { step: 2, channel: "E-mail", time: "24h depois", type: "Follow-up Técnico" },
                    { step: 3, channel: "WhatsApp", time: "48h depois", type: "Convite Reunião" },
                    { step: 4, channel: "Ligação", time: "72h depois", type: "Tarefa Humana" },
                  ].map((s) => (
                    <div key={s.step} className="flex items-center gap-4 p-3 rounded-md bg-bg-elev border border-border-card group">
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                        {s.step}
                      </div>
                      <div className="flex-1 grid grid-cols-3 gap-4">
                        <div className="text-sm font-medium">{s.channel}</div>
                        <div className="text-sm text-text-sec">{s.time}</div>
                        <div className="text-sm italic text-text-sec">{s.type}</div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-text-sec opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === "apresentacao" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card>
                <SectionTitle title="Personalidade da Ana (IA)" hint="Como a Ana se comporta e fala com os leads." />
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Tom de Voz</Label>
                    <Select defaultValue="consultivo">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consultivo">Consultivo e Técnico</SelectItem>
                        <SelectItem value="direto">Direto e Comercial</SelectItem>
                        <SelectItem value="amigavel">Amigável e Casual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Instruções de Sistema (Prompt)</Label>
                    <Textarea 
                      rows={4}
                      placeholder="Ex: Você é Ana, especialista técnica da WayFlex..."
                      defaultValue="Você é Ana, vendedora técnica da WayFlex. Seu objetivo é qualificar leads industriais interessados em soluções de borracha e silicone. Seja cordial, use termos técnicos quando apropriado, e foque em agendar uma conversa com nossos engenheiros de aplicação."
                    />
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between mb-4">
                  <SectionTitle title="Diferenciais e Argumentos" hint="Pontos fortes que a Ana usará nos pitches." />
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Novo Argumento
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="p-3 rounded-md border border-border-card bg-bg-elev/30">
                    <div className="font-semibold text-sm mb-1">Qualidade ISO 9001</div>
                    <div className="text-xs text-text-sec">Certificação em todos os processos de vulcanização e moldagem.</div>
                  </div>
                  <div className="p-3 rounded-md border border-border-card bg-bg-elev/30">
                    <div className="font-semibold text-sm mb-1">Entrega em 48h</div>
                    <div className="text-xs text-text-sec">Logística própria para a grande São Paulo e parceiros nacionais.</div>
                  </div>
                  <div className="p-3 rounded-md border border-border-card bg-bg-elev/30">
                    <div className="font-semibold text-sm mb-1">Customização Total</div>
                    <div className="text-xs text-text-sec">Desenvolvimento de compostos específicos para necessidades químicas extremas.</div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === "documentos" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <SectionTitle title="Base de Conhecimento (RAG)" hint="Documentos que a Ana lê para responder dúvidas." />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Zap className="h-4 w-4 text-amber-500" /> Reindexar Tudo
                    </Button>
                    <Button className="bg-[#00bfa5] hover:bg-[#00a690] text-white size-sm gap-2">
                      <Upload className="h-4 w-4" /> Upload
                    </Button>
                  </div>
                </div>
                
                <div className="mt-4 border rounded-md border-border-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Documento</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { name: "Catalogo_Tecnico_2026.pdf", type: "PDF", size: "2.4 MB", status: "Indexado" },
                        { name: "Tabela_Precos_Q3.xlsx", type: "Excel", size: "1.1 MB", status: "Processando" },
                        { name: "Diferenciais_Competitivos.docx", type: "Word", size: "850 KB", status: "Indexado" },
                      ].map((doc) => (
                        <TableRow key={doc.name}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-text-sec" />
                              {doc.name}
                            </div>
                          </TableCell>
                          <TableCell>{doc.type}</TableCell>
                          <TableCell>{doc.size}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              doc.status === "Indexado" ? "bg-success-bg text-success" : "bg-ia-bg text-ia"
                            }`}>
                              {doc.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="sticky top-6">
            <div className="flex flex-col items-center text-center p-2">
              <div className="relative mb-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#00bfa5] text-white shadow-lg shadow-teal-500/20">
                  <Building2 className="h-9 w-9" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-success border-2 border-white flex items-center justify-center">
                  <Zap className="h-3 w-3 text-white" />
                </div>
              </div>
              <div className="text-lg font-semibold text-text-title">WayFlex Industrial</div>
              <div className="flex items-center gap-1 text-sm text-text-sec mt-1">
                <MapPin className="h-3 w-3" /> São Paulo · SP
              </div>
              
              <div className="w-full mt-6 space-y-3 text-left border-t border-border-card pt-6">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-text-sec mb-1">Saúde da Automação</div>
                  <div className="h-2 w-full bg-bg-elev rounded-full overflow-hidden">
                    <div className="h-full bg-success w-[85%] rounded-full" />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-text-sec">Eficiência RAG</span>
                    <span className="text-[10px] font-bold text-success">85%</span>
                  </div>
                </div>
                
                <div className="p-3 rounded-lg bg-ia-bg/30 border border-ia/20">
                  <div className="text-[11px] font-semibold text-ia flex items-center gap-1 mb-1">
                    <Zap className="h-3 w-3" /> Insights da Ana
                  </div>
                  <p className="text-[11px] text-text-sec leading-relaxed">
                    A taxa de resposta no WhatsApp aumentou 12% após mudarmos o tom para "Consultivo".
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

