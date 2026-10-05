import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CSV_MAX_BYTES, CsvParseError, detectarMapeamento, escapeCsvCell, parseCsv } from './csv';

describe('CSV R9 — registros íntegros antes de importar', () => {
  it('preserva CRLF e aspas escapadas dentro de um registro', () => {
    expect(parseCsv('Nome,Observação\r\nAna,"Peça ""A""\r\naprovada"\r\n')).toEqual({
      cabecalho: ['Nome', 'Observação'], linhas: [['Ana', 'Peça "A"\r\naprovada']],
    });
  });
  it('aceita BOM, ponto-e-vírgula e newline final opcional', () => {
    expect(parseCsv('\uFEFFNome;Empresa\nAna;"A;B"')).toEqual({ cabecalho: ['Nome', 'Empresa'], linhas: [['Ana', 'A;B']] });
  });
  it('não detecta separador dentro do cabeçalho entre aspas', () => {
    expect(parseCsv('"Nome;apelido",Empresa\nAna,WayFlex').cabecalho).toEqual(['Nome;apelido', 'Empresa']);
  });
  it('preserva espaços como dados e ignora somente registros vazios', () => {
    expect(parseCsv('\nNome,Nota\nAna,"  A  "\n\nBeto,  B  \n').linhas).toEqual([['Ana', '  A  '], ['Beto', '  B  ']]);
  });
  it('aceita campos vazios inclusive o último', () => {
    expect(parseCsv('Nome,Empresa,Nota\nAna,,').linhas).toEqual([['Ana', '', '']]);
  });
  it.each(['Nome,Nota\nAna,"aberto', 'Nome,Nota\nAna,"fim"resto', 'Nome,Nota\nAna,as"pas',
    'Nome,Nota\nAna', 'Nome,Nota\nAna,A,extra', 'Nome,Nome\nAna,B', 'Nome,\nAna,B'])('recusa inteiro um arquivo malformado: %s', (csv) => {
    expect(() => parseCsv(csv)).toThrow(CsvParseError);
  });
  it('dá erro localizado sem devolver lote parcial', () => {
    expect(() => parseCsv('Nome,Nota\nAna,ok\nBeto')).toThrow('linha 3');
  });
  it('limita tamanho em bytes, inclusive UTF-8 multibyte', () => {
    expect(() => parseCsv('a'.repeat(CSV_MAX_BYTES + 1))).toThrow('5 MB');
    expect(() => parseCsv('á'.repeat(CSV_MAX_BYTES / 2 + 1))).toThrow('5 MB');
  });
  it('limita largura e quantidade de registros', () => {
    expect(() => parseCsv(Array.from({ length: 257 }, (_, i) => `c${i}`).join(','))).toThrow('256');
    expect(() => parseCsv('Nome\n' + 'Ana\n'.repeat(50_001))).toThrow('50.000');
  });
  it('arquivo vazio e mapeamento normalizado continuam compatíveis', () => {
    expect(parseCsv(' \n')).toEqual({ cabecalho: [], linhas: [] });
    expect(detectarMapeamento(['E-mail', 'Razão Social'], [{ chave: 'email' }, { chave: 'empresa', aliases: ['Razão Social'] }])).toEqual({ email: 0, empresa: 1 });
  });
});

describe('CSV R9 — exportação como texto sem mudar o banco', () => {
  it.each(['=1+1', '+1+1', '-1+1', '@SUM(1)', '\ttexto', '\rtexto', '\ntexto', '  =1+1', '\u0000=1', '＝1', '＋1', '－1', '＠1'])('neutraliza prefixo %j', (value) => {
    expect(escapeCsvCell(value)).toBe(`"'${value}"`);
  });
  it('escapa aspas e mantém valores inocentes sem alteração', () => {
    expect(escapeCsvCell('Peça "A", B; C')).toBe('"Peça ""A"", B; C"');
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(42)).toBe('"42"');
    const input = { empresa: '=1+1' }; escapeCsvCell(input.empresa); expect(input.empresa).toBe('=1+1');
  });
  it.each(['src/pages/dashboard/leads/page.tsx', 'src/pages/dashboard/kanban/page.tsx',
    'src/pages/dashboard/equipe/equipeUtils.ts', 'src/components/feature/CommercialAnalytics.tsx',
    'src/components/feature/FunnelAnalytics.tsx'])('consumidor %s usa o escape central (contrato estático)', (path) => {
    const source = readFileSync(path, 'utf8');
    expect(source).toContain("import { escapeCsvCell } from '@/lib/csv'");
    expect(source).toMatch(/(?:quote|escape|csvCampo) = escapeCsvCell/);
  });
  it('métrica usa o rótulo do período calculado (contrato estático)', () => {
    const source = readFileSync('src/components/feature/CommercialAnalytics.tsx', 'utf8');
    expect(source).toContain("title: 'Mensagens no período'");
    expect(source).not.toContain("title: 'Mensagens hoje'");
  });
});
