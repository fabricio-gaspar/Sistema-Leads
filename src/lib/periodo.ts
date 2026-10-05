// Helpers para filtrar dados por período selecionado nos relatórios.
// Como os dados de demonstração têm datas fixas (ex.: 2026-08), ancoramos o
// "hoje" na data mais recente presente nos dados para o filtro fazer sentido.

export function maxDataString(datas: (string | null | undefined)[]): string {
  const validas = datas.filter((d): d is string => !!d && d.length >= 10);
  if (validas.length === 0) return new Date().toISOString().slice(0, 10);
  return validas.reduce((a, b) => (a > b ? a : b));
}

function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function periodoDesde(periodo: string, refDate: string): string | null {
  const [y, m, d] = refDate.split('-').map(Number);
  const ref = new Date(y || 2000, (m || 1) - 1, d || 1);
  switch (periodo) {
    case 'Hoje':
      return refDate;
    case '7 dias':
    case 'Últimos 7 dias':
    case '7d':
      ref.setDate(ref.getDate() - 7);
      return fmt(ref.getFullYear(), ref.getMonth() + 1, ref.getDate());
    case 'Este mês':
      return fmt(y || 2000, m || 1, 1);
    case 'Últimos 30 dias':
    case '30d':
      ref.setDate(ref.getDate() - 30);
      return fmt(ref.getFullYear(), ref.getMonth() + 1, ref.getDate());
    case 'Últimos 90 dias':
    case '90d':
      ref.setDate(ref.getDate() - 90);
      return fmt(ref.getFullYear(), ref.getMonth() + 1, ref.getDate());
    case 'Este ano':
    case 'ano':
      return fmt(y || 2000, 1, 1);
    default:
      return null;
  }
}

export function dentroDoPeriodo(data: string | null | undefined, desde: string | null): boolean {
  if (!desde) return true;
  if (!data) return false;
  return data.slice(0, 10) >= desde;
}