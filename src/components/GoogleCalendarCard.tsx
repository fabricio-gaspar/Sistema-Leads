import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Calendar, Check, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useCallback } from "react";
import {
  startGoogleCalendarConnect,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
} from "@/lib/google-calendar.functions";

function waitForCompletion(popup: Window): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== "google_calendar" ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") resolve();
      else {
        popup.close();
        reject(new Error("Conexão OAuth falhou."));
      }
    };
    window.addEventListener("message", onMessage);
    const poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("Janela fechada antes de concluir."));
    }, 500);
  });
}

export function GoogleCalendarCard() {
  const qc = useQueryClient();
  const startFn = useServerFn(startGoogleCalendarConnect);
  const statusFn = useServerFn(getGoogleCalendarStatus);
  const disconnectFn = useServerFn(disconnectGoogleCalendar);
  const { data: status, isLoading } = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: () => statusFn(),
  });

  const onConnect = useCallback(async () => {
    const popup = window.open("", "google-calendar-oauth", "width=600,height=720");
    if (!popup) {
      toast.error("Popup bloqueado. Permita popups e tente novamente.");
      return;
    }
    try {
      const { authorizationUrl } = await startFn();
      const done = waitForCompletion(popup);
      popup.location.href = authorizationUrl;
      await done;
      await qc.invalidateQueries({ queryKey: ["google-calendar-status"] });
      toast.success("Google Calendar conectado");
    } catch (err) {
      popup.close();
      toast.error((err as Error).message);
    }
  }, [startFn, qc]);

  const disconnectMut = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-calendar-status"] });
      toast.success("Google Calendar desconectado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-3 rounded-md border border-border-card p-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-text-title">Google Calendar (por vendedor)</div>
          <div className="text-[11.5px] text-text-sec">
            Cada usuário conecta a própria agenda. Ao agendar reunião, o evento é criado no Google Calendar do responsável.
          </div>
        </div>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-text-ter" />
        ) : status?.sandbox ? (
          <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[10.5px] font-semibold text-warning">
            Sandbox ativo
          </span>
        ) : !status?.configured ? (
          <span className="rounded-full border border-border-card px-2 py-0.5 text-[10.5px] text-text-ter">
            Não configurado no workspace
          </span>
        ) : status.connected ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[10.5px] font-semibold text-success">
              <Check className="h-3 w-3" /> {status.email ?? "Conectado"}
            </span>
            <button
              onClick={() => confirm("Desconectar Google Calendar?") && disconnectMut.mutate()}
              disabled={disconnectMut.isPending}
              className="inline-flex items-center gap-1 rounded-md border border-border-card px-2 py-1 text-[11px] text-text-sec hover:bg-error hover:text-white hover:border-error disabled:opacity-50"
            >
              <LogOut className="h-3 w-3" /> Desconectar
            </button>
          </div>
        ) : (
          <button
            onClick={onConnect}
            className="inline-flex items-center gap-1 rounded-md border border-border-card bg-bg-card px-2.5 py-1 text-[11.5px] font-medium text-text-body hover:bg-primary hover:text-primary-foreground hover:border-primary"
          >
            <Calendar className="h-3 w-3" /> Conectar
          </button>
        )}
      </div>
      {!status?.configured && !isLoading && (
        <div className="mt-2 rounded-md bg-warning-bg px-2 py-1 text-[11px] text-warning">
          Um admin do workspace precisa configurar o cliente OAuth do Google Calendar em <b>Workspace Settings → App User Connectors</b> antes de os vendedores conseguirem conectar.
        </div>
      )}
      {status?.sandbox && !isLoading && (
        <div className="mt-2 rounded-md bg-warning-bg px-2 py-1 text-[11px] text-warning">
          Reuniões são registradas localmente para teste. A conexão com o Google Calendar será liberada quando o sandbox for desativado por um administrador.
        </div>
      )}
    </div>
  );
}
