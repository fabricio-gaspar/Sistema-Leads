import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Loader2, Play, Download, ShieldAlert } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { runMockScan, type MockScanReport, type MockFinding } from "@/lib/mock-scan.functions";
import { getOutreachHealth } from "@/lib/outreach.functions";

export const Route = createFileRoute("/_authenticated/diagnostico")({
  component: DiagnosticoPage,
});

const SEV_STYLE: Record<MockFinding["severity"], string> = {
  high: "bg-error-bg text-error",
  medium: "bg-warm-bg text-warm",
  low: "bg-bg-general text-text-sec",
};

function DiagnosticoPage() {
  const scanFn = useServerFn(runMockScan);
  const healthFn = useServerFn(getOutreachHealth);
  const [report, setReport] = useState<MockScanReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => scanFn(),
    onSuccess: (r) => {
      setReport(r);
      setErr(null);
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "Falha ao executar."),
  });
  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["outreach-health"],
    queryFn: () => healthFn(),
  });

  function downloadCSV() {
    if (!report) return;
    const header = ["tabela", "id", "coluna", "valor", "motivo", "severidade"];
    const rows = report.findings.map((f) => [
      f.table,
      f.id ?? "",
      f.column,
      (f.value ?? "").replace(/"/g, '""'),
      f.reason.replace(/"/g, '""'),
      f.severity,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostico-mock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalFindings = report?.findings.length ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title="Saúde das integrações"
          hint="Verifica se as credenciais obrigatórias estão presentes, sem exibir segredos"
        />
        {healthLoading || !health ? (
          <div className="flex items-center gap-2 text-[12px] text-text-sec">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando configurações…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              ["Ana (IA)", health.ai],
              ["Google Places", health.prospecting],
              ["WhatsApp Z-API", health.zapi],
              ["Token cliente Z-API", health.zapiClientToken],
              ["Webhook WhatsApp", health.zapiWebhook],
              ["E-mail Resend", health.email],
              ["Webhook de e-mail", health.emailWebhook],
              ["Agendador da cadência", health.scheduler],
            ].map(([label, configured]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-md border border-border-card bg-bg-general p-2.5">
                <span className="text-[11.5px] text-text-body">{String(label)}</span>
                {configured ? (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Configurada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-warm">
                    <AlertTriangle className="h-3.5 w-3.5" /> Pendente
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[15px] font-semibold text-text-title">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Diagnóstico de dados simulados
            </div>
            <p className="mt-1 max-w-2xl text-[12.5px] text-text-sec">
              Varre as principais tabelas do sistema em busca de valores com padrão de teste
              (lorem/ipsum, empresa X, contato Y, e-mails <code>@example.com</code>, telefones
              repetidos, CNPJ inválido, integrações marcadas como conectadas sem configuração
              real etc.). Apenas administradores podem executar.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {mut.isPending ? "Analisando..." : "Executar varredura"}
            </button>
            {report && (
              <button
                onClick={downloadCSV}
                className="inline-flex items-center gap-2 rounded-md border border-border-card bg-bg-card px-4 py-2 text-[13px] text-text-body hover:bg-bg-general"
              >
                <Download className="h-4 w-4" /> CSV
              </button>
            )}
          </div>
        </div>
        {err && (
          <div className="mt-3 rounded-md bg-error-bg px-3 py-2 text-[12.5px] text-error">
            {err}
          </div>
        )}
      </Card>

      {report && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <div className="text-[11px] uppercase text-text-ter">Executado em</div>
              <div className="text-[15px] font-semibold text-text-title">
                {new Date(report.scannedAt).toLocaleString("pt-BR")}
              </div>
            </Card>
            <Card>
              <div className="text-[11px] uppercase text-text-ter">Tabelas analisadas</div>
              <div className="text-[22px] font-semibold text-text-title">{report.totals.length}</div>
            </Card>
            <Card>
              <div className="text-[11px] uppercase text-text-ter">Registros</div>
              <div className="text-[22px] font-semibold text-text-title">
                {report.totals.reduce((a, t) => a + t.rows, 0)}
              </div>
            </Card>
            <Card>
              <div className="text-[11px] uppercase text-text-ter">Suspeitas</div>
              <div className={`text-[22px] font-semibold ${totalFindings === 0 ? "text-success" : "text-error"}`}>
                {totalFindings}
              </div>
            </Card>
          </div>

          <Card>
            <SectionTitle title="Resumo por tabela" />
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase text-text-ter">
                  <th className="pb-2">Tabela</th>
                  <th className="pb-2">Linhas analisadas</th>
                  <th className="pb-2">Suspeitas</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-card">
                {report.totals.map((t) => (
                  <tr key={t.table}>
                    <td className="py-2.5 font-medium text-text-title">{t.table}</td>
                    <td className="py-2.5 text-text-body">{t.rows}</td>
                    <td className="py-2.5 text-text-body">{t.findings}</td>
                    <td className="py-2.5">
                      {t.findings === 0 ? (
                        <span className="inline-flex items-center gap-1 text-success text-[12px]">
                          <CheckCircle2 className="h-3.5 w-3.5" /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-error text-[12px]">
                          <AlertTriangle className="h-3.5 w-3.5" /> Revisar
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <SectionTitle
              title={`Suspeitas detalhadas (${totalFindings})`}
              hint="Revise, corrija ou remova cada item"
            />
            {totalFindings === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-success-bg px-3 py-3 text-[13px] text-success">
                <CheckCircle2 className="h-4 w-4" /> Nenhum indício de dados simulados encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase text-text-ter">
                      <th className="pb-2">Severidade</th>
                      <th className="pb-2">Tabela</th>
                      <th className="pb-2">Coluna</th>
                      <th className="pb-2">Valor</th>
                      <th className="pb-2">Motivo</th>
                      <th className="pb-2">ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-card">
                    {report.findings.map((f, i) => (
                      <tr key={i}>
                        <td className="py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase ${SEV_STYLE[f.severity]}`}>
                            {f.severity}
                          </span>
                        </td>
                        <td className="py-2 font-medium text-text-title">{f.table}</td>
                        <td className="py-2 text-text-body">{f.column}</td>
                        <td className="py-2 max-w-[260px] truncate text-text-body" title={f.value ?? ""}>
                          {f.value ?? <span className="text-text-ter">—</span>}
                        </td>
                        <td className="py-2 text-text-sec">{f.reason}</td>
                        <td className="py-2 font-mono text-[10.5px] text-text-ter">
                          {f.id ? f.id.slice(0, 8) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {!report && !mut.isPending && (
        <Card>
          <div className="p-6 text-center text-[13px] text-text-sec">
            Clique em <strong>Executar varredura</strong> para gerar o relatório.
          </div>
        </Card>
      )}
    </div>
  );
}
