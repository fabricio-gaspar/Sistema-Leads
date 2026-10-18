/** Never silently report a truncated API result as a complete portfolio. */
export async function readAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  maxRows = 100_000,
): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let from = 0; from <= maxRows;) {
    const result = await fetchPage(from, from + size - 1);
    if (result.error) throw result.error;
    const page = result.data ?? [];
    if (page.length === 0) return rows;
    if (rows.length + page.length > maxRows) {
      throw new Error('A carteira excede o limite da leitura detalhada. Os indicadores precisam de agregação no servidor.');
    }
    rows.push(...page);
    from += page.length;
  }
  throw new Error('A carteira excede o limite da leitura detalhada. Os indicadores precisam de agregação no servidor.');
}
