interface SourceDetails {
  cidade?: string;
  city?: string;
  municipio?: string;
  estado?: string;
  state?: string;
  uf?: string;
  logradouro?: string;
  segmento?: string;
  cnae_descricao?: string;
  porte?: string;
}

const states: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE',
  'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA',
  paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};
const validCodes = new Set(Object.values(states));
const clean = (value: string | undefined) => value?.trim() || '';

function stateCode(value: string | undefined): string {
  const text = clean(value);
  if (validCodes.has(text.toUpperCase())) return text.toUpperCase();
  const name = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/^(state of|estado de|estado do)\s+/, '');
  return states[name] || '';
}

/** Use only returned source fields, never the current search form as company facts. */
export function prospectingImportDetails(source: SourceDetails) {
  let estado = [source.estado, source.state, source.uf].map(stateCode).find(Boolean) || '';
  if (!estado) {
    // Legacy caches truncated state names (SÃ/ST). Recover only an explicit UF
    // from the provider's saved address; a requested search region is not proof.
    const codes = [...clean(source.logradouro).matchAll(/(?:-|,)\s*([A-Z]{2})(?=\s*(?:,|$))/g)]
      .map((match) => match[1]).filter((code) => validCodes.has(code));
    const unique = [...new Set(codes)];
    if (unique.length === 1) estado = unique[0];
  }
  return {
    cidade: clean(source.cidade) || clean(source.city) || clean(source.municipio),
    estado,
    segmento: clean(source.segmento) || clean(source.cnae_descricao),
    porte: clean(source.porte),
  };
}
