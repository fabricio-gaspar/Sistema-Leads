import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { QrCode, Smartphone, MessageCircle, Phone, ChevronRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui-kit";
import { useLeads } from "@/hooks/use-leads-store";
import { formatBRL } from "@/lib/leads-data";

export const Route = createFileRoute("/portal-vendedor")({ component: PortalVendedor });

function PortalVendedor() {
  const leads = useLeads();
  const [connected, setConnected] = useState(false);
  const meus = leads.filter((l) => l.responsavel === "Fabrício" || l.responsavel === "Camila" || l.responsavel === "Diego");

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
              Pronto — seus leads, conversas e propostas na palma da mão
            </li>
          </ol>

          <button onClick={() => setConnected(true)} className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover">
            Simular acesso mobile
          </button>
        </Card>

        <Card className="flex flex-col items-center justify-center text-center">
          <div className="rounded-2xl border-4 border-primary bg-white p-4">
            <QrCodeArt />
          </div>
          <div className="mt-4 text-[13px] font-semibold text-text-title">wf.digital/vendedor/f4b</div>
          <div className="text-[11px] text-text-ter">Válido por 10 minutos · vinculado a Fabrício</div>
        </Card>
      </div>
    );
  }

  // "Mobile" preview
  return (
    <div className="flex justify-center">
      <div className="w-[380px] rounded-[36px] border-8 border-text-title bg-bg-general shadow-2xl overflow-hidden">
        <div className="bg-primary px-4 py-3 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] opacity-80">Bom dia</div>
              <div className="text-[15px] font-semibold">Fabrício</div>
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
              <div className="text-[16px] font-semibold">2</div>
              <div className="text-[10px] opacity-80">Propostas</div>
            </div>
            <div className="rounded-md bg-white/10 py-2">
              <div className="text-[16px] font-semibold">1</div>
              <div className="text-[10px] opacity-80">Pedidos</div>
            </div>
          </div>
        </div>

        <div className="p-3 space-y-2 max-h-[520px] overflow-y-auto">
          <div className="flex items-center gap-2 rounded-lg bg-ia-bg p-3 text-ia">
            <Sparkles className="h-4 w-4 shrink-0" />
            <div className="text-[12px]">Ana passou 2 leads quentes pra você essa manhã ☕</div>
          </div>

          {meus.map((l) => (
            <Link
              key={l.id}
              to="/leads/$id"
              params={{ id: l.id }}
              className="block rounded-lg bg-bg-card p-3 shadow-sm active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-text-title">{l.empresa}</div>
                  <div className="truncate text-[11px] text-text-sec">{l.contato} · {l.cidade}</div>
                </div>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${l.temperatura === "hot" ? "bg-hot-bg text-hot" : l.temperatura === "warm" ? "bg-warm-bg text-warm" : "bg-cold-bg text-cold"}`}>
                  {l.score}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-[13px] font-semibold text-primary">{formatBRL(l.valor)}</div>
                <div className="flex gap-1">
                  <button className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-white" onClick={(e) => e.preventDefault()}>
                    <MessageCircle className="h-3.5 w-3.5" />
                  </button>
                  <button className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground" onClick={(e) => e.preventDefault()}>
                    <Phone className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-general text-text-sec">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function QrCodeArt() {
  // Fake decorative QR
  const cells = 21;
  const seed = "10111011101110001010100010001000101110001000101110111011100011110010100011101000101010001010101110001010100010101000111011101110001010101110001110001110101011";
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${cells}, 8px)` }}>
      {Array.from({ length: cells * cells }).map((_, i) => {
        const on = seed[i % seed.length] === "1";
        const corner =
          (i < cells * 5 && (i % cells) < 5) ||
          (i < cells * 5 && (i % cells) >= cells - 5) ||
          (i >= cells * (cells - 5) && (i % cells) < 5);
        return <div key={i} className="h-2 w-2" style={{ background: corner ? "#0F172A" : on ? "#0F172A" : "transparent" }} />;
      })}
    </div>
  );
}

export { QrCodeArt };
