import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QrCode, Smartphone, MessageCircle, Phone, ChevronRight, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui-kit";
import { formatBRL } from "@/lib/leads-data";
import { listLeads } from "@/lib/crm.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

export const Route = createFileRoute("/_authenticated/portal-vendedor")({ component: PortalVendedor });

function PortalVendedor() {
  const [connected, setConnected] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
    if (typeof window !== "undefined") {
      setPortalUrl(`${window.location.origin}/portal-vendedor`);
    }
  }, []);

  const listFn = useServerFn(listLeads);
  const { data: leads = [], isLoading } = useQuery<LeadRow[]>({
    queryKey: ["leads"],
    queryFn: () => listFn(),
    enabled: connected,
  });

  const meus = leads.filter((l) => l.owner === "human" && (!me || l.assigned_to === me || !l.assigned_to));

  const waLink = (phone?: string | null) => {
    const digits = (phone ?? "").replace(/\D/g, "");
    if (!digits) return null;
    return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
  };

  if (!connected) {
    return (
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-text-title">Portal do Vendedor</div>
              <div className="text-[12px] text-text-sec">Acesso rápido e mobile-first para o time em campo</div>
            </div>
          </div>

          <ol className="mt-5 space-y-3 text-[13px] text-text-body">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">1</span>
              Abra a câmera do seu celular
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">2</span>
              Aponte para o QR Code ao lado
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">3</span>
              Faça login com sua conta e visualize seus leads na palma da mão
            </li>
          </ol>

          <button onClick={() => setConnected(true)} className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover">
            <QrCode className="mr-2 inline h-4 w-4" /> Pré-visualizar aqui
          </button>
        </Card>

        <Card className="flex flex-col items-center justify-center text-center">
          <div className="rounded-2xl border-4 border-primary bg-white p-4">
            {portalUrl ? (
              <QRCodeSVG value={portalUrl} size={168} level="M" />
            ) : (
              <div className="h-[168px] w-[168px] animate-pulse bg-bg-general" />
            )}
          </div>
          <div className="mt-4 break-all text-[13px] font-semibold text-text-title">{portalUrl || "…"}</div>
          <div className="text-[11px] text-text-ter">Aponte a câmera para acessar o portal no celular</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <div className="w-[380px] rounded-[36px] border-8 border-text-title bg-bg-general shadow-2xl overflow-hidden">
        <div className="bg-primary px-4 py-3 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] opacity-80">Bem-vindo</div>
              <div className="text-[15px] font-semibold">Vendedor</div>
            </div>
            <button onClick={() => setConnected(false)} className="rounded-full bg-white/20 px-2 py-1 text-[10px]">
              Sair
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-white/10 py-2">
              <div className="text-[16px] font-semibold">{meus.length}</div>
              <div className="text-[10px] opacity-80">Leads</div>
            </div>
            <div className="rounded-md bg-white/10 py-2">
              <div className="text-[16px] font-semibold">{meus.filter((l) => l.stage === "Proposta").length}</div>
              <div className="text-[10px] opacity-80">Propostas</div>
            </div>
            <div className="rounded-md bg-white/10 py-2">
              <div className="text-[16px] font-semibold">{meus.filter((l) => l.stage === "Pedido").length}</div>
              <div className="text-[10px] opacity-80">Pedidos</div>
            </div>
          </div>
        </div>

        <div className="p-3 space-y-2 max-h-[520px] overflow-y-auto">
          {isLoading && (
            <div className="flex justify-center p-6 text-text-sec">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {!isLoading && meus.length === 0 && (
            <div className="rounded-lg bg-bg-card p-6 text-center text-[12px] text-text-sec">
              Nenhum lead atribuído a vendedor humano ainda.
            </div>
          )}

          {meus.map((l) => {
            const wa = waLink(l.phone);
            const tel = l.phone ? `tel:${l.phone.replace(/\s+/g, "")}` : null;
            return (
              <Link
                key={l.id}
                to="/leads/$id"
                params={{ id: l.id }}
                className="block rounded-lg bg-bg-card p-3 shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-text-title">{l.company}</div>
                    <div className="truncate text-[11px] text-text-sec">{l.contact ?? "—"} · {l.uf ?? ""}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${l.temp === "hot" ? "bg-hot-bg text-hot" : l.temp === "warm" ? "bg-warm-bg text-warm" : "bg-cold-bg text-cold"}`}>
                    {l.score}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[13px] font-semibold text-primary">{formatBRL(Number(l.value || 0))}</div>
                  <div className="flex gap-1">
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-white"
                        aria-label="Abrir WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-general text-text-ter opacity-50">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {tel ? (
                      <a
                        href={tel}
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
                        aria-label="Ligar"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-general text-text-ter opacity-50">
                        <Phone className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-general text-text-sec">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
