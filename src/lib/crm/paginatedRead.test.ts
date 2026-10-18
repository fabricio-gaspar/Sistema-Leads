import { describe, expect, it } from 'vitest';
import { readAllPages } from './paginatedRead';

describe('paginated reads', () => {
  it('continues when the service limit is smaller than the requested page', async () => {
    const data = Array.from({ length: 7 }, (_, id) => ({ id }));
    const calls: number[] = [];
    const result = await readAllPages(async (from) => { calls.push(from); return { data: data.slice(from, from + 3), error: null }; });
    expect(result).toEqual(data); expect(calls).toEqual([0, 3, 6, 7]);
  });
  it('rejects a partial result when any page fails', async () => {
    await expect(readAllPages(async (from) => from === 0 ? { data: [1], error: null } : { data: null, error: new Error('offline') })).rejects.toThrow('offline');
  });
  it('returns a confirmed empty result', async () => {
    expect(await readAllPages(async () => ({ data: [], error: null }))).toEqual([]);
  });
  it('confirms an exact configured limit with a final empty page', async () => {
    const data = [1, 2, 3, 4];
    await expect(readAllPages(async (from) => ({ data: data.slice(from, from + 2), error: null }), 4)).resolves.toEqual(data);
  });
  it('rejects instead of returning a partial result above the configured limit', async () => {
    const data = [1, 2, 3, 4, 5];
    await expect(readAllPages(async (from) => ({ data: data.slice(from, from + 2), error: null }), 4)).rejects.toThrow('excede o limite');
  });
});
