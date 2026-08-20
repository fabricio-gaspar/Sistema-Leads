import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, User as UserIcon, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listTeam } from "@/lib/crm.functions";
import { getLeadFlowSettings, previewApproachMessage } from "@/lib/lead-flow.functions";

export type ApproachChoice = {
  approach: "ia" | "humano";
  assignee_id?: string | null;
  sla_hours?: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  /** Lead já existente usado para gerar a prévia da primeira mensagem (opcional). */
  previewLeadId?: string | null;
  submitting?: boolean;
  onConfirm: (choice: ApproachChoice) => void | Promise<void>;
};

export function ApproachModal({
  open,
  onOpenChange,
  count,
  previewLeadId,
  submitting,
  onConfirm,
}: Props) {
  const [mode, setMode] = useState<"ia" | "humano" | null>(null);
  const [assignee, setAssignee] = useState<string>("");
  const [sla, setSla] = useState<number>(4);
  const [preview, setPreview] = useState<string | null>(null);

  const flowFn = useServerFn(getLeadFlowSettings);
  const teamFn = useServerFn(listTeam);
  const previewFn = useServerFn(previewApproachMessage);

  const { data: flow } = useQuery({
    queryKey: ["lead-flow-settings"],
    queryFn: () => flowFn(),
    enabled: open,
  });
  const { data: team = [] } = useQuery<any[]>({
    queryKey: ["approach-team"],
    queryFn: () => teamFn(),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setMode(null);
      setPreview(null);
      setAssignee("");
    }
  }, [open]);

  useEffect(() => {
    if (flow?.settings?.human_sla_hours) setSla(flow.settings.human_sla_hours);
  }, [flow]);

  const previewMut = useMutation({
    mutationFn: () => previewFn({ data: { lead_id: previewLeadId! } }),
    onSuccess: (r: any) => setPreview(r.message),
    onError: (e: any) => toast.error(e.message ?? "Não foi possível gerar a prévia"),
  });

  const sellers = team.filter(
    (m: any) => m.active !== false && (m.roles ?? []).some((r: string) => ["vendedor", "sdr", "administrador"].includes(r)),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Como deseja abordar estes leads?</DialogTitle>
          <DialogDescription>
            {count} lead(s) selecionado(s). A escolha é obrigatória e fica registrada na auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("ia")}
            className={`rounded-lg border p-4 text-left transition ${mode === "ia" ? "border-primary bg-primary/5" : "border-border-card hover:bg-bg-general"}`}
          >
            <Bot className="mb-2 h-5 w-5 text-primary" />
            <div className="text-sm font-semibold text-text-title">Ana — abordagem por IA</div>
            <p className="text-xs text-text-sec">Cadência automática: WhatsApp → e-mail → tarefa de ligação.</p>
          </button>
          <button
            type="button"
            onClick={() => setMode("humano")}
            className={`rounded-lg border p-4 text-left transition ${mode === "humano" ? "border-primary bg-primary/5" : "border-border-card hover:bg-bg-general"}`}
          >
            <UserIcon className="mb-2 h-5 w-5 text-primary" />
            <div className="text-sm font-semibold text-text-title">Equipe — abordagem humana</div>
            <p className="text-xs text-text-sec">Cria tarefa de primeiro contato com SLA e notifica o responsável.</p>
          </button>
        </div>

        {mode === "ia" && (
          <div className="space-y-3 rounded-lg border border-border-card p-3">
            <div className="flex items-center justify-between text-xs text-text-sec">
              <span>Cadência padrão ativa da organização</span>
              {previewLeadId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => previewMut.mutate()}
                  disabled={previewMut.isPending}
                >
                  {previewMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Prévia da 1ª mensagem
                </Button>
              )}
            </div>
            {preview && (
              <div className="whitespace-pre-wrap rounded-md bg-bg-general p-3 text-xs text-text-body">{preview}</div>
            )}
            {!flow?.settings?.ai_auto_start && (
              <p className="flex items-start gap-2 text-xs text-warn">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5" />
                O início automático da Ana está desativado em Configurações → Fluxo de Leads. Os leads serão marcados
                como IA, mas o envio não será disparado.
              </p>
            )}
            <p className="text-[11px] text-text-sec">
              Opt-out, contatos suprimidos e duplicados são bloqueados automaticamente. Em modo sandbox, o envio é
              simulado e identificado no histórico.
            </p>
          </div>
        )}

        {mode === "humano" && (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border-card p-3">
            <div className="space-y-1">
              <Label className="text-xs">Responsável</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger><SelectValue placeholder="Selecionar vendedor" /></SelectTrigger>
                <SelectContent>
                  {sellers.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">SLA do primeiro contato (h)</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={sla}
                onChange={(e) => setSla(Number(e.target.value))}
              />
            </div>
            <p className="col-span-2 text-[11px] text-text-sec">
              A automação da Ana permanece pausada nestes leads.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!mode || submitting || (mode === "humano" && !assignee)}
            onClick={() =>
              onConfirm(
                mode === "ia"
                  ? { approach: "ia" }
                  : { approach: "humano", assignee_id: assignee, sla_hours: sla },
              )
            }
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar abordagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
