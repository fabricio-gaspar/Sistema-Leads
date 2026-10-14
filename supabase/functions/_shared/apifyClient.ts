import { ApifyClient } from 'npm:apify-client@2.25.0/browser';
import { apifyErrorCode } from './apifyErrors.ts';

export type ApifyRunSummary = {
  id: string;
  status: string;
  defaultDatasetId: string;
};

type ApifyCredentials = Record<string, unknown>;
type ClientOptions = { maxRetries?: number; timeoutSecs?: number };

const text = (value: unknown, maximum = 500): string => typeof value === 'string' ? value.trim().slice(0, maximum) : '';

function unwrapData(value: unknown): unknown {
  if (!value || typeof value !== 'object' || !('data' in value)) return value;
  const data = (value as { data?: unknown }).data;
  return data && typeof data === 'object' ? data : value;
}

function tokenFrom(credentials: ApifyCredentials): string {
  return text(credentials.api_token || credentials.token, 1_000);
}

function clientFrom(credentials: ApifyCredentials, options: ClientOptions = {}): ApifyClient {
  const token = tokenFrom(credentials);
  if (!token) throw new Error('source_credentials_missing');
  return new ApifyClient({
    token,
    maxRetries: options.maxRetries ?? 3,
    minDelayBetweenRetriesMillis: 300,
    timeoutSecs: options.timeoutSecs ?? 25,
    userAgentSuffix: 'wayflex-crm',
  });
}

function runSummary(run: unknown): ApifyRunSummary {
  const unwrapped = unwrapData(run);
  const record = unwrapped && typeof unwrapped === 'object' ? unwrapped as Record<string, unknown> : {};
  const id = text(record.id, 300), status = text(record.status, 80).toUpperCase(), defaultDatasetId = text(record.defaultDatasetId, 300);
  if (!id || !status) throw new Error('provider_invalid_response');
  return { id, status, defaultDatasetId };
}

export async function startApifyRun(credentials: ApifyCredentials, input: Record<string, unknown>): Promise<ApifyRunSummary> {
  try {
    const actor = text(credentials.actor_id, 300), task = text(credentials.task_id, 300);
    if (!actor && !task) throw new Error('source_credentials_missing');
    // O POST de início não pode ser repetido automaticamente: se a resposta
    // desaparecer depois de a Apify aceitar o run, um retry criaria cobrança e
    // dois runs para a mesma solicitação. A idempotência continua no ledger do CRM.
    const client = clientFrom(credentials, { maxRetries: 0 });
    const run = task
      ? await client.task(task).start(input, { waitForFinish: 0 })
      : await client.actor(actor).start(input, { waitForFinish: 0 });
    return runSummary(run);
  } catch (error) {
    if (error instanceof Error && /^(source_credentials_missing|provider_invalid_response)$/.test(error.message)) throw error;
    throw new Error(apifyErrorCode(error));
  }
}

export async function getApifyRun(credentials: ApifyCredentials, runId: string): Promise<ApifyRunSummary> {
  try {
    const run = await clientFrom(credentials).run(runId).get();
    if (!run) throw new Error('apify_actor_not_found');
    return runSummary(run);
  } catch (error) {
    if (error instanceof Error && /^(apify_actor_not_found|provider_invalid_response)$/.test(error.message)) throw error;
    throw new Error(apifyErrorCode(error));
  }
}

export async function listApifyItems(credentials: ApifyCredentials, datasetId: string, limit: number): Promise<unknown[]> {
  try {
    if (!datasetId) throw new Error('provider_invalid_response');
    const page = unwrapData(await clientFrom(credentials).dataset(datasetId).listItems({ limit: Math.max(1, Math.min(100, Math.floor(limit))) }));
    if (Array.isArray(page)) return page;
    const items = page && typeof page === 'object' ? (page as { items?: unknown }).items : undefined;
    return Array.isArray(items) ? items : [];
  } catch (error) {
    if (error instanceof Error && error.message === 'provider_invalid_response') throw error;
    throw new Error(apifyErrorCode(error));
  }
}

export async function validateApifyConfiguration(credentials: ApifyCredentials): Promise<void> {
  try {
    const actor = text(credentials.actor_id, 300), task = text(credentials.task_id, 300);
    if (!actor && !task) throw new Error('source_credentials_missing');
    const client = clientFrom(credentials);
    if (task) await client.task(task).get();
    else await client.actor(actor).get();
  } catch (error) {
    if (error instanceof Error && error.message === 'source_credentials_missing') throw error;
    throw new Error(apifyErrorCode(error));
  }
}
