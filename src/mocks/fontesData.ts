export const fontesLeads = [
  { id: 'f-1', sourceKey: 'cnpj', nome: 'Receita Federal', tipo: 'API', status: 'ativo', endpoint: 'https://api.receitaws.com.br', ultimaSincronizacao: '2026-08-18 09:30', leadsImportados: 1240, erros: 12, mapeamento: 'CNPJ, Razão Social, UF, Município, CNAE', tagsPadrao: ['RF'] },
  { id: 'f-2', sourceKey: 'google_places', nome: 'Google Places', tipo: 'API', status: 'ativo', endpoint: 'https://maps.googleapis.com/maps/api/place', ultimaSincronizacao: '2026-08-17 14:15', leadsImportados: 856, erros: 3, mapeamento: 'Nome, Endereço, Telefone, Site', tagsPadrao: ['Google'] },
  { id: 'f-3', sourceKey: 'apify', nome: 'Apify — Google Maps', tipo: 'API', status: 'ativo', endpoint: 'https://api.apify.com/v2', ultimaSincronizacao: '2026-08-16 11:00', leadsImportados: 432, erros: 8, mapeamento: 'Nome, Telefone, Site, Avaliações', tagsPadrao: ['Apify'] },
  { id: 'f-4', sourceKey: 'ai', nome: 'Pesquisa assistida por IA', tipo: 'API', status: 'pendente', endpoint: 'internal://ai-search', ultimaSincronizacao: '—', leadsImportados: 0, erros: 0, mapeamento: 'Custom', tagsPadrao: ['AI'] },
  { id: 'f-5', sourceKey: 'csv', nome: 'Importação CSV', tipo: 'CSV', status: 'ativo', endpoint: 'upload://csv', ultimaSincronizacao: '2026-08-15 16:45', leadsImportados: 320, erros: 0, mapeamento: 'Nome, Empresa, E-mail, Telefone, Segmento', tagsPadrao: ['CSV'] },
];
