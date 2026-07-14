import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatBRL } from "./leads-data";

export function downloadCSV(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(";")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}


export type OrcPdfInput = {
  id: string;
  cliente: string;
  itens: number;
  valor: number;
  emissao: string;
  validade: string;
  vendedor: string;
};

export function generateOrcamentoPDF(orc: OrcPdfInput) {
  const doc = new jsPDF();
  // Cabeçalho
  doc.setFillColor(14, 107, 97); // verde-petróleo
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("WF Digital", 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Proposta comercial", 14, 20);

  doc.setFontSize(11);
  doc.text(`Nº ${orc.id}`, 196, 12, { align: "right" });
  doc.setFontSize(9);
  doc.text(`Emissão: ${orc.emissao}`, 196, 18, { align: "right" });
  doc.text(`Válido até: ${orc.validade}`, 196, 24, { align: "right" });

  // Cliente
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Cliente", 14, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(orc.cliente, 14, 49);
  doc.text(`Responsável: ${orc.vendedor}`, 14, 55);

  // Itens (mock — 1 linha agregada)
  autoTable(doc, {
    startY: 65,
    head: [["Descrição", "Qtd", "Valor unit.", "Total"]],
    body: [
      [
        `Fornecimento conforme escopo (${orc.itens} item(s))`,
        String(orc.itens),
        formatBRL(orc.valor / Math.max(1, orc.itens)),
        formatBRL(orc.valor),
      ],
    ],
    headStyles: { fillColor: [14, 107, 97], textColor: 255 },
    styles: { fontSize: 10 },
  });

  const afterTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 90;

  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Total: ${formatBRL(orc.valor)}`, 196, afterTable + 12, { align: "right" });

  // Condições
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Condições comerciais:", 14, afterTable + 22);
  doc.text("• Pagamento: 30/60/90 dias mediante análise de crédito", 14, afterTable + 28);
  doc.text("• Prazo de entrega: 15 dias úteis após confirmação", 14, afterTable + 33);
  doc.text("• Garantia: 12 meses contra defeitos de fabricação", 14, afterTable + 38);

  // Rodapé
  doc.setFontSize(8);
  doc.text("WF Digital · contato@wfdigital.com.br · Gerado pelo WF Digital CRM", 105, 285, {
    align: "center",
  });

  doc.save(`${orc.id}-${orc.cliente.replace(/\s+/g, "-")}.pdf`);
}
