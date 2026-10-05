export interface Pasta {
  id: string;
  nome: string;
  icone: string;
  cor: string;
  arquivos: number;
}

export interface Arquivo {
  id: string;
  nome: string;
  tipo: 'documento' | 'imagem' | 'planilha' | 'apresentacao' | 'video' | 'outro';
  formato: string;
  tamanho: string;
  pasta: string;
  autor: string;
  data: string;
}

export const pastas: Pasta[] = [
  { id: 'p-1', nome: 'Materiais de marketing', icone: 'ri-image-line', cor: 'bg-primary-100 text-primary-600', arquivos: 24 },
  { id: 'p-2', nome: 'Propostas e contratos', icone: 'ri-file-text-line', cor: 'bg-accent-100 text-accent-600', arquivos: 12 },
  { id: 'p-3', nome: 'Cases de sucesso', icone: 'ri-trophy-line', cor: 'bg-secondary-100 text-secondary-700', arquivos: 8 },
  { id: 'p-4', nome: 'Identidade visual', icone: 'ri-palette-line', cor: 'bg-primary-500/20 text-primary-600', arquivos: 15 },
  { id: 'p-5', nome: 'Vídeos institucionais', icone: 'ri-video-line', cor: 'bg-accent-500/20 text-accent-600', arquivos: 6 },
];

export const arquivos: Arquivo[] = [
  { id: 'a-1', nome: 'Apresentação comercial v4.pdf', tipo: 'documento', formato: 'PDF', tamanho: '3,2 MB', pasta: 'Propostas e contratos', autor: 'Marina Sales', data: '2026-08-12' },
  { id: 'a-2', nome: 'Banner Instagram - Promo.pdf', tipo: 'imagem', formato: 'PDF', tamanho: '1,8 MB', pasta: 'Materiais de marketing', autor: 'João Vendedor', data: '2026-08-11' },
  { id: 'a-3', nome: 'Logo Wayflex v2.png', tipo: 'imagem', formato: 'PNG', tamanho: '640 KB', pasta: 'Identidade visual', autor: 'Wayflex', data: '2026-08-10' },
  { id: 'a-4', nome: 'Case - Clínica OrtoPrime.pdf', tipo: 'documento', formato: 'PDF', tamanho: '4,8 MB', pasta: 'Cases de sucesso', autor: 'Marina Sales', data: '2026-08-09' },
  { id: 'a-5', nome: 'Vídeo institucional 2026.mp4', tipo: 'video', formato: 'MP4', tamanho: '48 MB', pasta: 'Vídeos institucionais', autor: 'Fabrício', data: '2026-08-08' },
  { id: 'a-6', nome: 'Planilha de precificação.xlsx', tipo: 'planilha', formato: 'XLSX', tamanho: '220 KB', pasta: 'Propostas e contratos', autor: 'Marina Sales', data: '2026-08-07' },
  { id: 'a-7', nome: 'Catálogo Wayflex 2021.pdf', tipo: 'documento', formato: 'PDF', tamanho: '2,4 MB', pasta: 'Identidade visual', autor: 'Wayflex', data: '2026-08-06' },
  { id: 'a-8', nome: 'Case - EduTech Pro.pdf', tipo: 'documento', formato: 'PDF', tamanho: '3,1 MB', pasta: 'Cases de sucesso', autor: 'João Vendedor', data: '2026-08-05' },
  { id: 'a-9', nome: 'Flyer promocional.pdf', tipo: 'imagem', formato: 'PDF', tamanho: '1,2 MB', pasta: 'Materiais de marketing', autor: 'Paula SDR', data: '2026-08-04' },
  { id: 'a-10', nome: 'Contrato modelo - Serviços.docx', tipo: 'documento', formato: 'DOCX', tamanho: '180 KB', pasta: 'Propostas e contratos', autor: 'Fabrício', data: '2026-08-03' },
  { id: 'a-11', nome: 'Apresentação onboarding.pptx', tipo: 'apresentacao', formato: 'PPTX', tamanho: '5,6 MB', pasta: 'Materiais de marketing', autor: 'Paula SDR', data: '2026-08-02' },
  { id: 'a-12', nome: 'Paleta de cores e tipografia.pdf', tipo: 'documento', formato: 'PDF', tamanho: '890 KB', pasta: 'Identidade visual', autor: 'Fabrício', data: '2026-08-01' },
];