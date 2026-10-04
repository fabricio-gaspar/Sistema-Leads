import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle2,
  CircleAlert,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Card, SectionTitle } from "@/components/ui-kit";
import {
  connectMyEvolutionInstance,
  disconnectMyEvolutionInstance,
  getMyEvolutionInstance,
  getMyEvolutionQr,
  refreshMyEvolutionInstance,
} from "@/lib/evolution-go.functions";

export const Route = createFileRoute("/_authenticated/meu-whatsapp")({
  component: MeuWhatsapp,
});

const STATUS_LABEL: Record<string, string> = {
  pending_configuration: "Aguardando configuração",
  provisioning: "Criando instância",
  awaiting_connection: "Aguardando leitura do QR",
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "Ação necessária",
  disabled: "Desativado",
};

function MeuWhatsapp() {
  const queryClient = useQueryClient();
  const getInstance = useServerFn(getMyEvolutionInstance);
  const connect = useServerFn(connectMyEvolutionInstance);
  const refresh = useServerFn(refreshMyEvolutionInstance);
  const disconnect = useServerFn(disconnectMyEvolutionInstance);
  const getQr = useServerFn(getMyEvolutionQr);
  const instanceQuery = useQuery({
    queryKey: ["my-evolution-instance"],
    queryFn: () => getInstance(),
    refetchInterval: (query) =>
      query.state.data?.connection_status === "awaiting_connection" ? 8_000 : false,
  });
  const qrQuery = useQuery({
    queryKey: ["my-evolution-qr", instanceQuery.data?.id],
    queryFn: () => getQr(),
    enabled: false,
    retry: false,
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["my-evolution-instance"] });
    queryClient.removeQueries({ queryKey: ["my-evolution-qr"] });
  };
  const connectMutation = useMutation({
    mutationFn: async () => {
      await connect();
      return getQr();
    },
    onSuccess: (qr) => {
      queryClient.setQueryData(["my-evolution-qr", instanceQuery.data?.id], qr);
      invalidate();
      toast.success("Conexão iniciada. Escaneie o QR Code antes que ele expire.");
    },
    onError: (error: Error) =>
      toast.error("Não foi possível iniciar a conexão", { description: error.message }),
  });
  const refreshMutation = useMutation({
    mutationFn: () => refresh(),
    onSuccess: () => {
      invalidate();
      toast.success("Status da conexão atualizado.");
    },
    onError: (error: Error) =>
      toast.error("Não foi possível consultar a conexão", { description: error.message }),
  });
  const disconnectMutation = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      invalidate();
      toast.success("A sessão do WhatsApp foi desconectada.");
    },
    onError: (error: Error) =>
      toast.error("Não foi possível desconectar", { description: error.message }),
  });

  if (instanceQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-text-sec">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando sua conexão…
      </div>
    );
  }
  if (instanceQuery.error) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-error">
          <CircleAlert className="h-4 w-4" /> {(instanceQuery.error as Error).message}
        </div>
      </Card>
    );
  }

  const instance = instanceQuery.data;
  if (!instance) {
    return (
      <Card>
        <SectionTitle title="Meu WhatsApp" hint="Evolution GO" />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900">
          Sua instância ainda está aguardando provisionamento. Peça a um administrador para
          configurar a Evolution GO em Configurações → Canais.
        </div>
      </Card>
    );
  }

  const isConnected = instance.connection_status === "connected";
  const isPending =
    connectMutation.isPending || refreshMutation.isPending || disconnectMutation.isPending;
  const qr = qrQuery.data;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <SectionTitle title="Meu WhatsApp" hint="Sua conexão individual pela Evolution GO" />
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border-card bg-bg-general p-4">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-text-title">{instance.channel_name}</div>
              <div className="mt-0.5 text-[12px] text-text-sec">
                Instância: {instance.instance_name}
              </div>
              {instance.phone_e164 && (
                <div className="mt-0.5 text-[12px] text-text-sec">
                  Número conectado: +{instance.phone_e164}
                </div>
              )}
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isConnected ? "bg-success-bg text-success" : "bg-amber-100 text-amber-800"}`}
          >
            {STATUS_LABEL[instance.connection_status] ?? instance.connection_status}
          </span>
        </div>

        {instance.last_error && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            {instance.last_error}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={isPending}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border-card bg-bg-card px-3 text-[12px] font-medium text-text-body hover:bg-bg-general disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshMutation.isPending ? "animate-spin" : ""}`}
            />{" "}
            Atualizar status
          </button>
          {!isConnected && (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={isPending}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {connectMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Smartphone className="h-3.5 w-3.5" />
              )}{" "}
              Conectar e mostrar QR
            </button>
          )}
          {isConnected && (
            <button
              onClick={() => {
                if (
                  confirm(
                    "Desconectar este WhatsApp? Será necessário escanear um novo QR para usá-lo novamente.",
                  )
                )
                  disconnectMutation.mutate();
              }}
              disabled={isPending}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-error/40 bg-error-bg px-3 text-[12px] font-medium text-error hover:bg-error-bg/70 disabled:opacity-50"
            >
              <Unplug className="h-3.5 w-3.5" /> Desconectar
            </button>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Conectar aparelho" hint="QR Code temporário" />
        {isConnected ? (
          <div className="mt-5 flex flex-col items-center gap-3 py-5 text-center text-[13px] text-success">
            <CheckCircle2 className="h-9 w-9" /> Seu WhatsApp já está conectado.
          </div>
        ) : qr?.imageDataUrl || qr?.qrText ? (
          <div className="mt-4 flex flex-col items-center gap-3">
            <div className="rounded-xl border border-border-card bg-white p-3">
              {qr.imageDataUrl ? (
                <img
                  src={qr.imageDataUrl}
                  alt="QR Code da sua conexão WhatsApp"
                  className="h-56 w-56"
                />
              ) : (
                <QRCodeSVG value={qr.qrText!} size={224} level="M" includeMargin />
              )}
            </div>
            <p className="text-center text-[11.5px] text-text-sec">
              No WhatsApp, abra Aparelhos conectados → Conectar um aparelho e escaneie este código.
              Ele não revela seu token.
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-lg bg-bg-general p-4 text-center text-[12px] text-text-sec">
            Clique em “Conectar e mostrar QR” para gerar um código temporário.
          </div>
        )}
      </Card>

      <Card className="xl:col-span-2">
        <div className="flex items-start gap-2 text-[12px] text-text-sec">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> A chave global e o token
          da instância ficam cifrados no servidor. Esta tela só pode consultar sua própria instância
          e exibe o QR temporariamente.
        </div>
      </Card>
    </div>
  );
}
