type ClientOptions = { token: string };
type StartOptions = { waitForFinish?: number };
type DatasetOptions = { limit?: number };

type ProviderError = Error & {
  status?: number;
  statusCode?: number;
  response?: { status: number };
};

function encoded(value: string) {
  return encodeURIComponent(value);
}

function mockedFetch(): typeof fetch {
  const candidate = globalThis.fetch as (typeof fetch & { mock?: unknown }) | undefined;
  if (typeof candidate !== 'function' || !('mock' in candidate)) {
    throw new Error('apify_test_fetch_not_mocked');
  }
  return candidate;
}

/**
 * Test-only adapter for the Deno npm package used in production.
 * It keeps every provider request behind the Vitest global fetch mock, so the
 * handler contracts can assert request safety without reaching Apify.
 */
export class ApifyClient {
  constructor(private readonly options: ClientOptions) {}

  actor(id: string) {
    return {
      get: () => this.request(`/v2/acts/${encoded(id)}`),
      start: (input: unknown, options?: StartOptions) => this.request(`/v2/acts/${encoded(id)}/runs`, {
        method: 'POST',
        body: input,
        query: options?.waitForFinish === undefined ? {} : { waitForFinish: options.waitForFinish },
      }),
    };
  }

  task(id: string) {
    return {
      get: () => this.request(`/v2/actor-tasks/${encoded(id)}`),
      start: (input: unknown, options?: StartOptions) => this.request(`/v2/actor-tasks/${encoded(id)}/runs`, {
        method: 'POST',
        body: input,
        query: options?.waitForFinish === undefined ? {} : { waitForFinish: options.waitForFinish },
      }),
    };
  }

  run(id: string) {
    return { get: () => this.request(`/v2/actor-runs/${encoded(id)}`) };
  }

  dataset(id: string) {
    return {
      listItems: (options?: DatasetOptions) => this.request(`/v2/datasets/${encoded(id)}/items`, {
        query: options?.limit === undefined ? {} : { limit: options.limit },
      }),
    };
  }

  private async request(
    path: string,
    options: { method?: string; body?: unknown; query?: Record<string, string | number> } = {},
  ) {
    const url = new URL(`https://api.apify.com${path}`);
    url.searchParams.set('token', this.options.token);
    for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, String(value));
    const response = await mockedFetch()(new Request(url, {
      method: options.method,
      headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }));
    if (!response.ok) {
      const error = new Error(`Apify request failed: ${response.status}`) as ProviderError;
      error.status = response.status;
      error.statusCode = response.status;
      error.response = { status: response.status };
      throw error;
    }
    return response.json();
  }
}
