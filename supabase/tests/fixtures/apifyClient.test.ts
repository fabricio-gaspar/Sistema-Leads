import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApifyClient } from './apifyClient.ts';

describe('Apify Vitest adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the mocked fetch transport for a provider run', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { id: 'run-1' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new ApifyClient({ token: 'synthetic-token' }).run('run-1').get();

    expect(result).toEqual({ data: { id: 'run-1' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]?.[0] as Request).url).toContain('/v2/actor-runs/run-1');
  });

  it('fails closed when a test forgets to install a fetch mock', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('unexpected_unmocked_fetch_call');
    });

    await expect(new ApifyClient({ token: 'synthetic-token' }).run('run-1').get())
      .rejects.toThrow('apify_test_fetch_not_mocked');
  });
});
