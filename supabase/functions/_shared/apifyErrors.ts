export function apifyErrorCode(error: unknown): string {
  const record = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
  const response = record.response && typeof record.response === 'object' ? record.response as Record<string, unknown> : {};
  const statusCode = Number(record.statusCode ?? record.status ?? response.status ?? 0);
  if (statusCode === 401) return 'apify_token_rejected';
  if (statusCode === 403) return 'apify_resource_forbidden';
  if (statusCode === 404) return 'apify_actor_not_found';
  if (statusCode === 429) return 'apify_rate_limited';
  if (statusCode >= 400 && statusCode < 500) return `apify_http_${statusCode}`;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes('timeout') || message.includes('timed out') || message.includes('aborted')) return 'provider_timeout';
  return 'apify_provider_error';
}
