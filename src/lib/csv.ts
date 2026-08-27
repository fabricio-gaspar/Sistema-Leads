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

// Faz o parse de um CSV com suporte a aspas e separadores ; ou ,.
export function parseCsv(texto: string): ParsedCsv {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length === 0) return { cabecalho: [], linhas: [] };

  const delimitador = linhas[0].includes(';') ? ';' : ',';

  const parseLinha = (linha: string): string[] => {
    const cols: string[] = [];
    let atual = '';
    let entreAspas = false;
    for (let i = 0; i < linha.length; i += 1) {
      const ch = linha[i];
      if (ch === '"') {
        entreAspas = !entreAspas;
      } else if (ch === delimitador && !entreAspas) {
        cols.push(atual.trim());
        atual = '';
      } else {
        atual += ch;
      }
    }
    cols.push(atual.trim());
    return cols.map((c) => c.replace(/^"|"$/g, '').trim());
  };

  const cabecalho = parseLinha(linhas[0]);
  const dados = linhas
    .slice(1)
    .map(parseLinha)
    .filter((l) => l.some((c) => c !== ''));

  return { cabecalho, linhas: dados };
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