import { CSV_MAX_BYTES, CsvParseError, normalizarChave, parseCsv, type ParsedCsv } from '@/lib/csv';

export type LeadImportFormat = 'csv' | 'xlsx';

// `read-excel-file@9` types date cells as `typeof Date`, while the runtime
// returns `Date` instances. Accept both without ever evaluating cell content.
type SpreadsheetCell = string | number | boolean | Date | typeof Date | null | undefined;

export interface ParsedLeadImportFile extends ParsedCsv {
  format: LeadImportFormat;
  warnings: string[];
}

export interface ParsedSpreadsheetRows extends ParsedCsv {
  ignoredColumns: number;
}

interface SpreadsheetSheet {
  sheet: string;
  data: readonly (readonly SpreadsheetCell[])[];
}

const MAX_IMPORT_ROWS = 50_000;
const MAX_IMPORT_COLUMNS = 256;
const MAX_IMPORT_CELLS = 500_000;
const MAX_IMPORT_PHYSICAL_COLUMNS = 2_048;
const MAX_XLSX_ENTRIES = 2_048;
const MAX_XLSX_UNCOMPRESSED_BYTES = 40 * 1024 * 1024;

export class LeadImportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeadImportParseError';
  }
}

export function detectLeadImportFormat(file: Pick<File, 'name' | 'type'>): LeadImportFormat {
  const extension = file.name.trim().toLocaleLowerCase('pt-BR').split('.').pop();
  if (extension === 'csv') return 'csv';
  if (extension === 'xlsx') return 'xlsx';
  throw new LeadImportParseError('Formato não aceito. Selecione um arquivo CSV ou Excel (.xlsx).');
}

function cellToText(value: SpreadsheetCell): string {
  if (value == null) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return value.toISOString().slice(0, 10);
  }
  if (value === Date) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function hasValue(value: SpreadsheetCell): boolean {
  return cellToText(value).trim().length > 0;
}

export function normalizeSpreadsheetRows(rows: readonly (readonly SpreadsheetCell[])[]): ParsedSpreadsheetRows {
  const populatedRows = rows.filter((row) => row.some(hasValue));
  if (populatedRows.length < 2) throw new LeadImportParseError('A planilha está vazia ou não possui linhas de dados.');
  if (populatedRows.length - 1 > MAX_IMPORT_ROWS) {
    throw new LeadImportParseError(`A planilha excede o limite de ${MAX_IMPORT_ROWS.toLocaleString('pt-BR')} registros.`);
  }

  const widestRow = populatedRows.reduce((max, row) => Math.max(max, row.length), 0);
  if (widestRow > MAX_IMPORT_PHYSICAL_COLUMNS) {
    throw new LeadImportParseError('A planilha possui colunas físicas demais. Remova colunas vazias excedentes ou divida o arquivo.');
  }
  const headerRow = populatedRows[0];
  const namedColumns = Array.from({ length: widestRow }, (_, index) => index)
    .filter((index) => hasValue(headerRow[index]));
  if (namedColumns.length === 0) throw new LeadImportParseError('A primeira linha útil precisa conter os cabeçalhos da planilha.');
  if (namedColumns.length > MAX_IMPORT_COLUMNS) {
    throw new LeadImportParseError(`A planilha excede o limite de ${MAX_IMPORT_COLUMNS} colunas úteis.`);
  }
  if (populatedRows.length * namedColumns.length > MAX_IMPORT_CELLS) {
    throw new LeadImportParseError('A planilha possui células demais para uma importação segura. Reduza colunas vazias ou divida o arquivo.');
  }

  const ignoredColumns = Array.from({ length: widestRow }, (_, index) => index)
    .filter((index) => !hasValue(headerRow[index]) && populatedRows.slice(1).some((row) => hasValue(row[index]))).length;
  const matrix = populatedRows.map((row) => namedColumns.map((index) => cellToText(row[index])));
  const cabecalho = matrix[0].map((value, index) => index === 0 ? value.replace(/^\uFEFF/, '').trim() : value.trim());
  const normalizedHeaders = cabecalho.map(normalizarChave);
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    throw new LeadImportParseError('A planilha possui cabeçalho duplicado. Renomeie as colunas repetidas.');
  }

  return { cabecalho, linhas: matrix.slice(1), ignoredColumns };
}

async function hasXlsxSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return bytes.length === 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
    && ((bytes[2] === 0x03 && bytes[3] === 0x04)
      || (bytes[2] === 0x05 && bytes[3] === 0x06)
      || (bytes[2] === 0x07 && bytes[3] === 0x08));
}

function findZipEnd(view: DataView): number {
  const minimum = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

/** Refuses encrypted/ZIP64/oversized archives before XML is decompressed. */
export function inspectXlsxArchive(buffer: ArrayBuffer): void {
  const view = new DataView(buffer);
  if (view.byteLength < 22) throw new LeadImportParseError('O arquivo Excel está incompleto ou corrompido.');
  const end = findZipEnd(view);
  if (end < 0) throw new LeadImportParseError('O arquivo não possui uma estrutura Excel (.xlsx) válida.');

  const entries = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  if (!entries || entries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff
    || entries > MAX_XLSX_ENTRIES || centralOffset + centralSize > end) {
    throw new LeadImportParseError('A estrutura interna da planilha não é suportada ou excede os limites seguros.');
  }

  let offset = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) {
      throw new LeadImportParseError('O arquivo Excel está incompleto ou corrompido.');
    }
    const flags = view.getUint16(offset + 8, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if ((flags & 0x1) !== 0 || uncompressed === 0xffffffff) {
      throw new LeadImportParseError('Planilhas protegidas por senha ou ZIP64 não são aceitas.');
    }
    totalUncompressed += uncompressed;
    if (totalUncompressed > MAX_XLSX_UNCOMPRESSED_BYTES) {
      throw new LeadImportParseError('A planilha descompactada excede o limite seguro de processamento.');
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== centralOffset + centralSize) {
    throw new LeadImportParseError('O arquivo Excel possui uma estrutura interna inconsistente.');
  }
}

export function selectSpreadsheetSheet(sheets: readonly SpreadsheetSheet[]): SpreadsheetSheet {
  const candidates = sheets
    .map((sheet, index) => ({ sheet, index, populated: sheet.data.filter((row) => row.some(hasValue)).length }))
    .filter((candidate) => candidate.populated >= 2)
    .sort((left, right) => right.populated - left.populated || left.index - right.index);
  if (!candidates.length) throw new LeadImportParseError('A planilha está vazia ou não possui linhas de dados.');
  return candidates[0].sheet;
}

export async function parseLeadImportFile(file: File): Promise<ParsedLeadImportFile> {
  if (file.size > CSV_MAX_BYTES) {
    throw new LeadImportParseError('O arquivo deve ter no máximo 5 MB.');
  }
  const format = detectLeadImportFormat(file);
  if (format === 'csv') {
    try {
      return { ...parseCsv(await file.text()), format, warnings: [] };
    } catch (error) {
      if (error instanceof CsvParseError) throw error;
      throw new LeadImportParseError('Não foi possível ler o CSV. Verifique se o arquivo está íntegro.');
    }
  }

  if (!await hasXlsxSignature(file)) {
    throw new LeadImportParseError('O arquivo não possui uma estrutura Excel (.xlsx) válida.');
  }
  try {
    const buffer = await file.arrayBuffer();
    inspectXlsxArchive(buffer);
    const { default: readXlsxFile } = await import('read-excel-file/browser');
    const sheets = await readXlsxFile(buffer);
    const selectedSheet = selectSpreadsheetSheet(sheets);
    const { ignoredColumns, ...parsed } = normalizeSpreadsheetRows(selectedSheet.data);
    const warnings: string[] = [];
    if (sheets.length > 1) {
      warnings.push(`O arquivo contém ${sheets.length} abas. Foi usada “${selectedSheet.sheet}”, a aba com mais linhas preenchidas.`);
    }
    if (ignoredColumns > 0) {
      warnings.push(`${ignoredColumns} coluna(s) sem cabeçalho foram ignoradas. Somente colunas identificadas podem ser importadas.`);
    }
    return {
      ...parsed,
      format,
      warnings,
    };
  } catch (error) {
    if (error instanceof LeadImportParseError) throw error;
    throw new LeadImportParseError('Não foi possível ler a planilha. Verifique se o arquivo está íntegro, sem senha e no formato .xlsx.');
  }
}
