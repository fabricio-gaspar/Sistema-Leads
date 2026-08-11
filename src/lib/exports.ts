export const formatBRL = (v: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export const exportToPdf = async (data: any) => {
  console.log("Exporting to PDF:", data);
};

export const generateOrcamentoPDF = async (orcamento: any) => {
  console.log("Generating budget PDF:", orcamento);
};
