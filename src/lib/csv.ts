// Utilitários de leitura e mapeamento de CSV usados pela importação em massa
// (leads e produtos). Centraliza o parser e a detecção automática de colunas,
// para que as telas só cuidem de transformar as linhas nos seus tipos.

export interface ParsedCsv {
  cabecalho: string[];
  linhas: string[][];
}

// Normaliza uma chave/nome de coluna para comparação (minusculas, sem acento,
// sem caracteres especiais).
export function normalizarChave(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export const CSV_MAX_BYTES = 5 * 1024 * 1024;
const CSV_MAX_ROWS = 50_000;
const CSV_MAX_COLUMNS = 256;

export class CsvParseError extends Error {
  constructor(message: string, line?: number) {
    super(line ? `CSV, linha ${line}: ${message}` : message);
    this.name = 'CsvParseError';
  }
}

// Detecta somente separadores fora de campos entre aspas no primeiro registro.
function delimiterOf(text: string): ',' | ';' {
  let quoted = false; let commas = 0; let semicolons = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { i += 1; continue; }
      quoted = !quoted;
    } else if (!quoted) {
      if (char === '\r' || char === '\n') break;
      if (char === ',') commas += 1;
      if (char === ';') semicolons += 1;
    }
  }
  return semicolons > commas ? ';' : ',';
}

// Interpreta registros completos: CRLF dentro de aspas não inicia outro lead.
// Arquivo malformado é recusado integralmente antes da confirmação de importação.
export function parseCsv(texto: string): ParsedCsv {
  if (texto.length > CSV_MAX_BYTES || new TextEncoder().encode(texto).length > CSV_MAX_BYTES) {
    throw new CsvParseError('O arquivo CSV deve ter no máximo 5 MB.');
  }
  const text = texto.replace(/^\uFEFF/, '').replace(/^(?:[ \t]*\r?\n)+/, '');
  if (!text.trim()) return { cabecalho: [], linhas: [] };
  const delimiter = delimiterOf(text);
  const records: string[][] = [];
  let row: string[] = []; let field = ''; let quoted = false; let closed = false;
  let line = 1; let rowLine = 1;
  const finishField = () => {
    row.push(field); field = ''; closed = false;
    if (row.length > CSV_MAX_COLUMNS) throw new CsvParseError('Máximo de 256 colunas excedido.', rowLine);
  };
  const finishRow = () => {
    finishField();
    if (row.some((value) => value.trim() !== '')) {
      if (records.length && row.length !== records[0].length) {
        throw new CsvParseError(`Esperadas ${records[0].length} colunas; encontradas ${row.length}.`, rowLine);
      }
      records.push(row);
      if (records.length > CSV_MAX_ROWS + 1) throw new CsvParseError('Máximo de 50.000 registros excedido.', rowLine);
    }
    row = [];
  };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else { quoted = false; closed = true; }
      } else { field += char; if (char === '\n' || (char === '\r' && text[i + 1] !== '\n')) line += 1; }
      continue;
    }
    if (char === delimiter) { finishField(); continue; }
    if (char === '\r' || char === '\n') {
      finishRow();
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      line += 1; rowLine = line; continue;
    }
    if (closed) {
      if (char === ' ' || char === '\t') continue;
      throw new CsvParseError('Conteúdo inesperado após fechar aspas.', line);
    }
    if (char === '"') {
      if (field.length) throw new CsvParseError('Aspas devem envolver o campo inteiro; use aspas duplicadas para escapar.', line);
      quoted = true;
    } else { field += char; }
  }
  if (quoted) throw new CsvParseError('Campo com aspas não fechadas.', rowLine);
  if (field || row.length || closed) finishRow();
  const cabecalho = (records.shift() ?? []).map((value) => value.trim());
  const keys = cabecalho.map(normalizarChave);
  if (keys.some((key) => !key) || new Set(keys).size !== keys.length) {
    throw new CsvParseError('O cabeçalho deve conter nomes de coluna não vazios e diferentes.');
  }
  return { cabecalho, linhas: records };
}

// Proteção no formato de saída, sem alterar o valor canônico no banco.
export function escapeCsvCell(value: unknown): string {
  const text = String(value ?? '');
  // ASCII controls are intentional here: spreadsheets may skip them before formulas.
  // eslint-disable-next-line no-control-regex
  const dangerous = /^[\s\u0000-\u001f]*[=+@\-＝＋－＠]/u.test(text) || /^[\t\r\n]/.test(text);
  return `"${(dangerous ? "'" : '') + text.replaceAll('"', '""')}"`;
}

export interface CampoMapeamento {
  chave: string;
  aliases?: string[];
}

// Detecta automaticamente o índice da coluna de cada campo, comparando o nome
// do cabeçalho (normalizado) com a chave e os aliases do campo.
export function detectarMapeamento(
  cabecalho: string[],
  campos: CampoMapeamento[]
): Record<string, number> {
  const indices = cabecalho.map((c, i) => ({ c: normalizarChave(c), i }));
  const mapeado: Record<string, number> = {};

  campos.forEach((campo) => {
    const alvos = [campo.chave, ...(campo.aliases || [])].map(normalizarChave);
    for (const alvo of alvos) {
      const encontrado = indices.find((x) => x.c === alvo);
      if (encontrado) {
        mapeado[campo.chave] = encontrado.i;
        break;
      }
    }
  });

  return mapeado;
}
