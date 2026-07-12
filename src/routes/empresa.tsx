import { createFileRoute } from "@tanstack/react-router";
import { Building2, Upload, Sparkles, CheckCircle2 } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";

export const Route = createFileRoute("/empresa")({ component: Empresa });

function Empresa() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2 space-y-4">
        <Card>
          <SectionTitle title="Perfil da empresa" hint="Estas informações treinam a Ana sobre o seu negócio" />
          <div className="grid grid-cols-2 gap-4">
            {[
              ["Razão social", "WF Digital Indústria Ltda."],
              ["CNPJ", "42.183.559/0001-08"],
              ["Segmento principal", "Metalurgia · Estamparia"],
              ["Porte", "Média empresa"],
              ["Website", "wfdigital.com.br"],
              ["Faturamento anual", "R$ 24 milhões"],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-[11px] uppercase text-text-ter">{k}</div>
                <div className="text-[13px] text-text-title font-medium">{v}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Produtos e serviços" hint="A Ana usa isso para qualificar leads" />
          <div className="space-y-2">
            {[
              { name: "Peças estampadas sob desenho", tag: "Principal" },
              { name: "Corte a laser de chapas", tag: "Complementar" },
              { name: "Montagem e solda de conjuntos", tag: "Complementar" },
              { name: "Ferramentaria — projetos especiais", tag: "Premium" },
            ].map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-md border border-border-card p-3">
                <div className="text-[13px] text-text-title">{p.name}</div>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {p.tag}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle
            title="Diferenciais competitivos"
            hint="Argumentos que a Ana usa na abordagem"
          />
          <ul className="grid grid-cols-2 gap-2">
            {[
              "Entrega em até 15 dias úteis",
              "Redução comprovada de 22% no lead time",
              "Certificação ISO 9001:2015",
              "Atendimento técnico dedicado",
              "Ferramentaria própria",
              "Mínimo de 500 peças por pedido",
            ].map((d) => (
              <li key={d} className="flex items-center gap-2 text-[13px] text-text-body">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                {d}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Building2 className="h-9 w-9" />
            </div>
            <div className="mt-3 text-[15px] font-semibold text-text-title">WF Digital</div>
            <div className="text-[12px] text-text-sec">São Paulo · SP</div>
            <button className="mt-3 flex items-center gap-1.5 rounded-md border border-border-card px-3 py-1.5 text-[12px] text-text-body hover:bg-bg-general">
              <Upload className="h-3.5 w-3.5" /> Enviar logotipo
            </button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-ia">
            <Sparkles className="h-4 w-4" />
            <div className="text-[13px] font-semibold">Ana aprendeu</div>
          </div>
          <p className="mt-1.5 text-[12.5px] text-text-body leading-relaxed">
            "Sou a Ana, assistente comercial da WF Digital. Trabalhamos com estamparia e corte a laser para indústrias de médio porte. Nosso diferencial é lead time curto e ferramentaria própria."
          </p>
          <button className="mt-3 w-full rounded-md bg-ia px-3 py-2 text-[12px] font-medium text-white hover:opacity-90">
            Retreinar a Ana
          </button>
        </Card>

        <Card>
          <SectionTitle title="Integrações" />
          <ul className="space-y-2">
            {[
              { name: "WhatsApp Business", ok: true },
              { name: "E-mail (SMTP)", ok: true },
              { name: "ERP — Bling", ok: false },
              { name: "Meta Ads", ok: false },
            ].map((i) => (
              <li key={i.name} className="flex items-center justify-between text-[12.5px]">
                <span className="text-text-body">{i.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${i.ok ? "bg-success-bg text-success" : "bg-bg-general text-text-ter"}`}>
                  {i.ok ? "Conectado" : "Conectar"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
