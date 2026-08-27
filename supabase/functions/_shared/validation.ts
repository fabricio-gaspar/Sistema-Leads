export function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`invalid_${field}`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new Error(`invalid_${field}`);
  return normalized;
}

export function optionalString(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredString(value, field, maxLength);
}

export function requiredUuid(value: unknown, field: string): string {
  const uuid = requiredString(value, field, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
    throw new Error(`invalid_${field}`);
  }
  return uuid;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 32_768) throw new Error('payload_too_large');
  const rawBody = await request.text();
  if (rawBody.length > 32_768) throw new Error('payload_too_large');
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new Error('invalid_payload');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_payload');
  return body as Record<string, unknown>;
}
