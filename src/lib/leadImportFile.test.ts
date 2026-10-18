import { describe, expect, it } from 'vitest';
import {
  LeadImportParseError,
  detectLeadImportFormat,
  inspectXlsxArchive,
  normalizeSpreadsheetRows,
  selectSpreadsheetSheet,
} from './leadImportFile';

function zipCentralDirectory(uncompressedBytes: number, encrypted = false): ArrayBuffer {
  const name = new TextEncoder().encode('xl/workbook.xml');
  const centralSize = 46 + name.length;
  const buffer = new ArrayBuffer(centralSize + 22);
  const view = new DataView(buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(8, encrypted ? 1 : 0, true);
  view.setUint32(24, uncompressedBytes, true);
  view.setUint16(28, name.length, true);
  new Uint8Array(buffer, 46, name.length).set(name);
  view.setUint32(centralSize, 0x06054b50, true);
  view.setUint16(centralSize + 10, 1, true);
  view.setUint32(centralSize + 12, centralSize, true);
  view.setUint32(centralSize + 16, 0, true);
  return buffer;
}

describe('importação tabular de leads', () => {
  it('reconhece somente CSV e Excel moderno', () => {
    expect(detectLeadImportFormat({ name: 'leads.csv', type: 'text/csv' })).toBe('csv');
    expect(detectLeadImportFormat({ name: 'leads.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })).toBe('xlsx');
    expect(() => detectLeadImportFormat({ name: 'leads.xls', type: 'application/vnd.ms-excel' })).toThrow(LeadImportParseError);
  });

  it('normaliza a estrutura observada na Base Oficial sem expor as linhas reais', () => {
    const parsed = normalizeSpreadsheetRows([
      ['Empresa', 'Categoria', 'Endereço', 'Cidade', 'Estado', 'Telefone', 'Site', 'E-mail', null, 'Data'],
      ['Empresa teste', 'Indústria', 'Rua exemplo', 'Sorocaba', 'São Paulo', '(15) 3000-0000', 'https://example.com', 'contato@example.com', null, new Date('2026-10-14T00:00:00.000Z')],
      [null, null, null, null, null, null, null, null, null, null],
    ]);

    expect(parsed.cabecalho).toEqual(['Empresa', 'Categoria', 'Endereço', 'Cidade', 'Estado', 'Telefone', 'Site', 'E-mail', 'Data']);
    expect(parsed.linhas).toEqual([[
      'Empresa teste', 'Indústria', 'Rua exemplo', 'Sorocaba', 'São Paulo', '(15) 3000-0000',
      'https://example.com', 'contato@example.com', '2026-10-14',
    ]]);
    expect(parsed.ignoredColumns).toBe(0);
  });

  it('rejeita cabeçalho ausente ou duplicado e identifica colunas excedentes sem nome', () => {
    expect(() => normalizeSpreadsheetRows([['Empresa', 'empresa'], ['A', 'B']])).toThrow('duplicado');
    expect(() => normalizeSpreadsheetRows([[null], ['A']])).toThrow('linhas de dados');
    expect(normalizeSpreadsheetRows([['Empresa', null], ['A', 'valor']]).ignoredColumns).toBe(1);
  });

  it('seleciona de forma explícita a aba com mais dados', () => {
    const selected = selectSpreadsheetSheet([
      { sheet: 'Instruções', data: [['Leia'], ['Antes']] },
      { sheet: 'Leads', data: [['Empresa'], ['A'], ['B']] },
    ]);
    expect(selected.sheet).toBe('Leads');
  });

  it('recusa arquivo compactado perigoso ou protegido antes de descompactar', () => {
    expect(() => inspectXlsxArchive(zipCentralDirectory(1024))).not.toThrow();
    expect(() => inspectXlsxArchive(zipCentralDirectory(41 * 1024 * 1024))).toThrow('descompactada');
    expect(() => inspectXlsxArchive(zipCentralDirectory(1024, true))).toThrow('senha');
  });
});
