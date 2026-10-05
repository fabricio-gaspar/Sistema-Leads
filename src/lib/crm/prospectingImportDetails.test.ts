import { describe, expect, it } from 'vitest';
import { prospectingImportDetails } from './prospectingImportDetails';

describe('prospecting import source fidelity', () => {
  it('recovers a truncated legacy UF only from the saved provider address', () => {
    expect(prospectingImportDetails({
      municipio: 'São Paulo', uf: 'SÃ',
      logradouro: 'Av. Rebouças, 3970 - Pinheiros, São Paulo - SP, 05402-600, Brazil',
      cnae_descricao: 'Electronics store',
    })).toEqual({ cidade: 'São Paulo', estado: 'SP', segmento: 'Electronics store', porte: '' });
  });

  it('does not invent a state, sector or size when absent or ambiguous', () => {
    expect(prospectingImportDetails({ uf: 'ST' })).toEqual({ cidade: '', estado: '', segmento: '', porte: '' });
    expect(prospectingImportDetails({ logradouro: 'Cidade - SP, outra - RJ' }).estado).toBe('');
  });

  it('normalizes complete provider state names without truncating them', () => {
    expect(prospectingImportDetails({ state: 'State of São Paulo' }).estado).toBe('SP');
    expect(prospectingImportDetails({ estado: 'Minas Gerais' }).estado).toBe('MG');
    expect(prospectingImportDetails({ uf: 'sc', segmento: 'Indústria', porte: 'Grande' }))
      .toMatchObject({ estado: 'SC', segmento: 'Indústria', porte: 'Grande' });
  });
});
