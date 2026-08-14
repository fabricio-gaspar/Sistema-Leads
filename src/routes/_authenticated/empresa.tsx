import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Upload, FileText, Settings, Target, MessageSquareText } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/empresa")({ component: Empresa });

type Tab = "dados" | "abordagem" | "apresentacao" | "documentos";

function Empresa() {
  const [activeTab, setActiveTab] = useState<Tab>("dados");

  const tabs: { id: Tab; label: string }[] = [
    { id: "dados", label: "Dados" },
    { id: "abordagem", label: "Abordagem" },
    { id: "apresentacao", label: "Apresentação" },
    { id: "documentos", label: "Documentos" },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-title">Configurações da Empresa</h1>
          <p className="text-sm text-text-sec">Gerencie as operações, IA e base de conhecimento da sua empresa.</p>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-bg-elev rounded-lg w-fit border border-border-card">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-[#00bfa5] text-white shadow-sm" // LeadAI Teal
                : "text-text-sec hover:text-text-title"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3">
          {activeTab === "dados" && <div className="space-y-6">Dados Content</div>}
          {activeTab === "abordagem" && <div className="space-y-6">Abordagem Content</div>}
          {activeTab === "apresentacao" && <div className="space-y-6">Apresentação Content</div>}
          {activeTab === "documentos" && <div className="space-y-6">Documentos Content</div>}
        </div>
        <div className="md:col-span-1 space-y-6">
            <Card>
                <div className="flex flex-col items-center text-center p-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#00bfa5] text-white mb-4">
                        <Building2 className="h-9 w-9" />
                    </div>
                    <div className="text-lg font-semibold">WayFlex</div>
                    <div className="text-sm text-text-sec">São Paulo · SP</div>
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
}
