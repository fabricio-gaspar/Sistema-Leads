const brazilianStates: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', distritofederal: 'DF', espiritosanto: 'ES', goias: 'GO', maranhao: 'MA', matogrosso: 'MT', matogrossodosul: 'MS', minasgerais: 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', riodejaneiro: 'RJ', riograndedonorte: 'RN', riograndedosul: 'RS', rondonia: 'RO', roraima: 'RR', santacatarina: 'SC', saopaulo: 'SP', sergipe: 'SE', tocantins: 'TO',
};

export function normalizeBrazilianState(value: unknown): string {
  if (typeof value !== 'string') return '';
  const clean = value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
  return clean.length === 2 ? clean.toUpperCase() : brazilianStates[clean] || '';
}
