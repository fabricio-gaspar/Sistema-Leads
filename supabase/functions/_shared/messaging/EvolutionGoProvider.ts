import type {
  MessagingProvider,
  ProviderSendRequest,
  ProviderSendResult,
} from './MessagingProvider.ts';

type FetchLike = typeof fetch;
type ObjectValue = Record<string, unknown>;

export interface EvolutionGoProviderOptions {
  baseUrl: string;
  instanceToken: string;
  /** Explicit origins operated by the customer. This is intentionally required to prevent SSRF. */
  allowedOrigins: string[];
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

export interface EvolutionGoConnectionOptions {
  webhookUrl: string;
  subscribe?: boolean;
  immediate?: boolean;
}

export interface EvolutionGoStatus {
  connected: boolean;
  loggedIn: boolean;
  phone?: string;
  name?: string;
  confirmed?: boolean;
}

export interface EvolutionGoQrCode {
  qrcode?: string;
  pairingCode?: string;
  pairingUrl?: string;
}

function asObject(value: unknown): ObjectValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {};
}

function stringValue(value: unknown, limit = 500): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : undefined;
}

/**
 * Upstream error bodies may be from a reverse proxy and must never be logged
 * verbatim: some proxies echo credentials, URLs or request bodies.  These
 * coarse flags are enough to distinguish an invalid number from a temporary
 * session-state rejection while keeping the failure diagnostic safe.
 */
function upstreamErrorFlags(payload: ObjectValue): Record<string, boolean> {
  const values = [payload.error, payload.message, payload.errors]
    .filter((value): value is string => typeof value === 'string')
    .join(' ').toLowerCase();
  return {
    phone: /phone|number|telefone|celular/.test(values),
    instance: /instance|inst[aâ]ncia/.test(values),
    session: /session|sess[aã]o|connection|conex[aã]o|websocket/.test(values),
    authentication: /auth|token|apikey|api key|credential/.test(values),
    retry: /retry|again|aguarde|wait|later/.test(values),
  };
}

function safeRecipient(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error('evolution_go_recipient_invalid');
  return digits;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

function allowedOriginSet(origins: string[]): Set<string> {
  const parsed = origins.map((origin) => {
    try {
      const url = new URL(origin.trim());
      return url.protocol === 'https:' && !url.username && !url.password ? url.origin : '';
    } catch {
      return '';
    }
  }).filter(Boolean);
  if (!parsed.length) throw new Error('evolution_go_allowed_origins_required');
  return new Set(parsed);
}

/**
 * Evolution GO's API is self-hosted. Requiring an explicit HTTPS origin is a
 * deliberate boundary: credentials must never turn this server into an SSRF
 * proxy to a private network.
 */
export function normalizeEvolutionGoBaseUrl(value: string, allowedOrigins: string[]): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('evolution_go_base_url_invalid');
  }
  if (url.protocol !== 'https:' || url.username || url.password || isPrivateIpv4(url.hostname)) {
    throw new Error('evolution_go_base_url_unsafe');
  }
  if (url.pathname !== '/' || url.search || url.hash || !allowedOriginSet(allowedOrigins).has(url.origin)) {
    throw new Error('evolution_go_base_url_not_allowed');
  }
  return url.origin;
}

function safeMediaUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('evolution_go_media_url_invalid');
  }
  if (url.protocol !== 'https:' || url.username || url.password || isPrivateIpv4(url.hostname)) {
    throw new Error('evolution_go_media_url_unsafe');
  }
  return url.toString();
}

function bodyFor(request: ProviderSendRequest): ObjectValue {
  const id = request.idempotencyKey.trim();
  if (!id || id.length > 180) throw new Error('message_idempotency_key_invalid');
  const number = safeRecipient(request.to);

  if (request.kind === 'text') {
    const text = request.text?.trim();
    if (!text || text.length > 4096) throw new Error('evolution_go_text_invalid');
    return { number, text, id };
  }

  if (!['image', 'audio', 'video', 'document'].includes(request.kind)) {
    throw new Error('evolution_go_message_kind_unsupported');
  }
  const url = request.media?.link ? safeMediaUrl(request.media.link) : '';
  if (!url) throw new Error('evolution_go_media_url_required');
  const type = request.kind;
  const body: ObjectValue = { number, url, type, id };
  if (request.media?.caption) body.caption = request.media.caption.slice(0, 1024);
  if (request.media?.filename) body.filename = request.media.filename.slice(0, 240);
  return body;
}

function messageId(payload: ObjectValue): string | undefined {
  const data = asObject(payload.data);
  const info = asObject(data.info ?? data.Info ?? payload.info ?? payload.Info);
  return stringValue(info.id ?? info.ID ?? data.id ?? data.ID ?? payload.id ?? payload.ID, 300);
}

export class EvolutionGoProvider implements MessagingProvider {
  readonly name = 'evolution_go' as const;
  private readonly baseUrl: string;
  private readonly instanceToken: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: EvolutionGoProviderOptions) {
    this.baseUrl = normalizeEvolutionGoBaseUrl(options.baseUrl, options.allowedOrigins);
    if (!options.instanceToken.trim()) throw new Error('evolution_go_instance_token_required');
    this.instanceToken = options.instanceToken.trim();
    this.timeoutMs = Math.min(Math.max(options.timeoutMs ?? 12_000, 2_000), 30_000);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request(path: string, init: RequestInit, timeoutMs = this.timeoutMs): Promise<ObjectValue> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        apikey: this.instanceToken,
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
    const payload = asObject(await response.json().catch(() => null));
    if (!response.ok) {
      // Providers in the Evolution GO family vary between `{ code }`,
      // `{ error: { code } }`, `{ error: "code" }` and `{ message }`.
      // Preserve only a short machine-readable token: never propagate a
      // response body, because an upstream proxy may echo request material.
      const upstreamError = asObject(payload.error);
      const rawCode = upstreamError.code
        ?? payload.code
        ?? (typeof payload.error === 'string' ? payload.error : undefined)
        ?? payload.message;
      const candidate = stringValue(rawCode, 60);
      const providerCode = candidate && /^[A-Za-z][A-Za-z0-9_-]{0,59}$/.test(candidate)
        ? candidate
        : String(response.status);
      console.warn('evolution_go_upstream_rejected', {
        path,
        status: response.status,
        response_keys: Object.keys(payload).sort(),
        error_flags: upstreamErrorFlags(payload),
      });
      throw new Error(`evolution_go_request_rejected_${providerCode}`);
    }
    return payload;
  }

  async send(request: ProviderSendRequest): Promise<ProviderSendResult> {
    const endpoint = request.kind === 'text' ? '/send/text' : '/send/media';
    // Do not retry POST sends here. A transport timeout can still mean Evolution
    // accepted the request; the worker reconciles that outcome instead of duplicating it.
    const payload = await this.request(endpoint, { method: 'POST', body: JSON.stringify(bodyFor(request)) });
    const providerMessageId = messageId(payload);
    if (!providerMessageId) throw new Error('evolution_go_send_response_invalid');
    return {
      accepted: true,
      providerMessageId,
      provider: this.name,
      acceptedAt: new Date().toISOString(),
    };
  }

  async status(): Promise<EvolutionGoStatus> {
    const payload = await this.request('/instance/status', { method: 'GET' });
    const data = asObject(payload.data);
    return {
      // The 0.7.x Go structs serialize exported fields with their original
      // casing (`Connected`, `LoggedIn`, `Name`); compatible releases use
      // lower camel case. Support both so a successful scan cannot be shown
      // as disconnected merely because of a serialization difference.
      connected: data.connected === true || data.Connected === true,
      loggedIn: data.loggedIn === true || data.LoggedIn === true,
      phone: stringValue(data.myJid ?? data.MyJid ?? data.phone ?? data.Phone),
      name: stringValue(data.name ?? data.Name),
      confirmed: typeof (data.connected ?? data.Connected) === 'boolean' && typeof (data.loggedIn ?? data.LoggedIn) === 'boolean',
    };
  }

  async connect(options: EvolutionGoConnectionOptions): Promise<void> {
    const webhookUrl = safeMediaUrl(options.webhookUrl);
    await this.request('/instance/connect', {
      method: 'POST',
      // v0.7.x validates these identifiers against its Go EventType enum. The
      // older Evolution API names (for example `messages.upsert`) are silently
      // discarded, leaving the remote instance without connection callbacks.
      // Keep the subscription narrowly scoped to the families this CRM uses.
      body: JSON.stringify({
        webhookUrl,
        subscribe: options.subscribe === false ? [] : ['MESSAGE', 'SEND_MESSAGE', 'READ_RECEIPT', 'CONNECTION', 'QRCODE'],
      }),
    });
  }

  async qr(): Promise<EvolutionGoQrCode> {
    // QR codes have a short lifetime. Cache directives prevent a CDN/reverse
    // proxy from returning an expired image. Do not add a cache-busting query
    // parameter here: Evolution GO 0.7.x validates this route strictly and
    // rejects unexpected query parameters with HTTP 400.
    const payload = await this.request('/instance/qr', {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store, no-cache, max-age=0', Pragma: 'no-cache' },
    });
    const data = asObject(payload.data);
    const directQr = stringValue(data.qrcode, 2_000_000);
    const code = stringValue(data.code, 2_000_000);
    const imageDataUrl = (value: string | undefined): string | undefined => {
      if (!value) return undefined;
      if (value.startsWith('data:image/')) return value;
      // Some compatible builds omit the data-URL prefix but retain PNG base64.
      return value.startsWith('iVBORw0KGgo') ? `data:image/png;base64,${value}` : undefined;
    };
    return {
      // Evolution GO returns its renderable image in `code` and the raw QR
      // payload in `qrcode`. Older compatible versions may invert this.
      qrcode: imageDataUrl(code) ?? imageDataUrl(directQr),
      pairingCode: stringValue(data.pairingCode ?? data.PairingCode ?? data.passkeyCode, 120)
        || (code && !code.startsWith('data:image/') ? code.slice(0, 120) : undefined),
      pairingUrl: stringValue(data.passkeyOpenUrl, 2_000),
    };
  }

  async pair(phone: string): Promise<string> {
    const payload = await this.request('/instance/pair', {
      method: 'POST',
      // `subscribe` belongs to /instance/connect. In Evolution GO it is a
      // string array, so the boolean previously sent here made the Go JSON
      // binder reject every pairing-code request with HTTP 400.
      body: JSON.stringify({ phone: safeRecipient(phone) }),
    });
    // Evolution GO returns the eight-character code as `data.code`. Some
    // compatible releases called it `pairingCode` or `passkeyCode`; accepting
    // all documented variants keeps the CRM compatible without ever exposing
    // the instance token to the browser.
    const data = asObject(payload.data);
    const code = stringValue(data.pairingCode ?? data.PairingCode ?? data.code ?? data.Code ?? data.passkeyCode, 120);
    if (!code) throw new Error('evolution_go_pair_response_invalid');
    return code;
  }

  async reconnect(): Promise<void> {
    await this.request('/instance/reconnect', { method: 'POST', body: '{}' });
  }

  async disconnect(): Promise<void> {
    await this.request('/instance/disconnect', { method: 'POST', body: '{}' });
  }

  async logout(): Promise<void> {
    await this.request('/instance/logout', { method: 'DELETE' });
  }
}
