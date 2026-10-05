import type {
  MessagingProvider,
  ProviderSendRequest,
  ProviderSendResult,
} from './MessagingProvider.ts';

type FetchLike = typeof fetch;
type JsonObject = Record<string, unknown>;

export interface WaAkgProviderOptions {
  baseUrl: string;
  apiKey: string;
  sessionId: string;
  /** Exact HTTPS origins approved by an administrator. Required to prevent SSRF. */
  allowedOrigins: string[];
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

export interface WaAkgSessionStatus {
  connected: boolean;
  state: string;
  phone?: string;
  name?: string;
}

export interface WaAkgQrCode {
  qrcode: string;
}

const object = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value)
  ? value as JsonObject
  : {};
const text = (value: unknown, limit = 1_000): string => typeof value === 'string'
  ? value.trim().slice(0, limit)
  : '';

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

function approvedOrigins(origins: string[]): Set<string> {
  const approved = origins.map((origin) => {
    try {
      const url = new URL(origin.trim());
      return url.protocol === 'https:' && !url.username && !url.password ? url.origin : '';
    } catch {
      return '';
    }
  }).filter(Boolean);
  if (!approved.length) throw new Error('wa_akg_allowed_origins_required');
  return new Set(approved);
}

export function normalizeWaAkgBaseUrl(value: string, allowedOrigins: string[]): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('wa_akg_base_url_invalid');
  }
  if (url.protocol !== 'https:' || url.username || url.password || isPrivateIpv4(url.hostname)) {
    throw new Error('wa_akg_base_url_unsafe');
  }
  if (url.pathname !== '/' || url.search || url.hash || !approvedOrigins(allowedOrigins).has(url.origin)) {
    throw new Error('wa_akg_base_url_not_allowed');
  }
  return url.origin;
}

function sessionId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(normalized)) throw new Error('wa_akg_session_id_invalid');
  return normalized;
}

function recipientJid(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error('wa_akg_recipient_invalid');
  return `${digits}@s.whatsapp.net`;
}

function safeHttpsUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('wa_akg_media_url_invalid');
  }
  if (url.protocol !== 'https:' || url.username || url.password || isPrivateIpv4(url.hostname)) {
    throw new Error('wa_akg_media_url_unsafe');
  }
  return url.toString();
}

function providerMessageId(payload: JsonObject): string {
  const data = object(payload.data);
  const key = object(data.key ?? payload.key);
  return text(key.id ?? data.id ?? payload.id, 300);
}

function outboundMessage(request: ProviderSendRequest): JsonObject {
  if (!request.idempotencyKey.trim() || request.idempotencyKey.length > 180) {
    throw new Error('message_idempotency_key_invalid');
  }
  if (request.kind === 'text') {
    const value = request.text?.trim();
    if (!value || value.length > 4096) throw new Error('wa_akg_text_invalid');
    return { text: value };
  }
  if (!['image', 'audio', 'video', 'document'].includes(request.kind)) {
    throw new Error('wa_akg_message_kind_unsupported');
  }
  const link = request.media?.link ? safeHttpsUrl(request.media.link) : '';
  if (!link) throw new Error('wa_akg_media_url_required');
  const media: JsonObject = { url: link };
  if (request.media?.caption && request.kind !== 'audio') media.caption = request.media.caption.slice(0, 1024);
  if (request.kind === 'document' && request.media?.filename) media.fileName = request.media.filename.slice(0, 240);
  if (request.kind === 'audio') media.ptt = false;
  return { [request.kind]: media };
}

export class WaAkgProvider implements MessagingProvider {
  readonly name = 'wa_akg' as const;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly session: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: WaAkgProviderOptions) {
    this.baseUrl = normalizeWaAkgBaseUrl(options.baseUrl, options.allowedOrigins);
    if (!options.apiKey.trim()) throw new Error('wa_akg_api_key_required');
    this.apiKey = options.apiKey.trim();
    this.session = sessionId(options.sessionId);
    this.timeoutMs = Math.min(Math.max(options.timeoutMs ?? 15_000, 2_000), 30_000);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request(path: string, init: RequestInit, timeoutMs = this.timeoutMs): Promise<JsonObject> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'X-API-Key': this.apiKey,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
    const payload = object(await response.json().catch(() => null));
    if (!response.ok || payload.success === false) {
      console.warn('wa_akg_upstream_rejected', {
        path,
        status: response.status,
        response_keys: Object.keys(payload).sort(),
      });
      throw new Error(`wa_akg_request_rejected_${response.status}`);
    }
    return payload;
  }

  async send(request: ProviderSendRequest): Promise<ProviderSendResult> {
    const jid = encodeURIComponent(recipientJid(request.to));
    // Never retry this POST here. A timeout can still mean the gateway sent it;
    // the CRM outbox keeps the ambiguous delivery in reconciliation_required.
    const payload = await this.request(`/api/messages/${encodeURIComponent(this.session)}/${jid}/send`, {
      method: 'POST',
      body: JSON.stringify({ message: outboundMessage(request) }),
    });
    const id = providerMessageId(payload);
    if (!id) throw new Error('wa_akg_send_response_invalid');
    return { accepted: true, providerMessageId: id, provider: this.name, acceptedAt: new Date().toISOString() };
  }

  async create(name: string): Promise<void> {
    const safeName = name.trim().slice(0, 120);
    if (!safeName) throw new Error('wa_akg_session_name_required');
    await this.request('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ name: safeName, sessionId: this.session }),
    }, 20_000);
  }

  async start(): Promise<void> {
    await this.request(`/api/sessions/${encodeURIComponent(this.session)}/start`, { method: 'POST', body: '{}' }, 20_000);
  }

  async stop(): Promise<void> {
    await this.request(`/api/sessions/${encodeURIComponent(this.session)}/stop`, { method: 'POST', body: '{}' }, 20_000);
  }

  async restart(): Promise<void> {
    await this.request(`/api/sessions/${encodeURIComponent(this.session)}/restart`, { method: 'POST', body: '{}' }, 20_000);
  }

  async logout(): Promise<void> {
    await this.request(`/api/sessions/${encodeURIComponent(this.session)}/logout`, { method: 'POST', body: '{}' }, 20_000);
  }

  async status(): Promise<WaAkgSessionStatus> {
    const payload = await this.request(`/api/sessions/${encodeURIComponent(this.session)}`, { method: 'GET', cache: 'no-store' });
    const data = object(payload.data ?? payload.session);
    const me = object(data.me ?? payload.me);
    const state = text(data.status ?? data.state ?? payload.status, 80).toUpperCase();
    return {
      connected: state === 'CONNECTED' || data.connected === true,
      state: state || 'UNKNOWN',
      phone: text(me.id ?? me.phone ?? data.phone, 120) || undefined,
      name: text(me.name ?? me.notify ?? data.name, 160) || undefined,
    };
  }

  async qr(): Promise<WaAkgQrCode> {
    const payload = await this.request(`/api/sessions/${encodeURIComponent(this.session)}/qr`, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store, no-cache, max-age=0', Pragma: 'no-cache' },
    });
    const data = object(payload.data);
    const raw = text(data.base64 ?? payload.base64 ?? data.qr ?? payload.qr, 2_000_000);
    const qrcode = raw.startsWith('data:image/') ? raw : raw.startsWith('iVBORw0KGgo') ? `data:image/png;base64,${raw}` : '';
    if (!qrcode) throw new Error('wa_akg_qr_unavailable');
    return { qrcode };
  }

  async pair(phone: string): Promise<string> {
    const digits = phone.replace(/\D/g, '');
    if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error('wa_akg_phone_invalid');
    const payload = await this.request(`/api/sessions/${encodeURIComponent(this.session)}/pair`, {
      method: 'POST',
      body: JSON.stringify({ phoneNumber: digits }),
    });
    const data = object(payload.data);
    const code = text(data.code ?? data.pairingCode ?? payload.code ?? payload.pairingCode, 120);
    if (!code) throw new Error('wa_akg_pair_response_invalid');
    return code;
  }

  async configureSafety(): Promise<void> {
    await this.request(`/api/sessions/${encodeURIComponent(this.session)}/bot-config`, {
      method: 'POST',
      body: JSON.stringify({
        enabled: false,
        autoReplyMode: 'DISABLED',
        antiSpamEnabled: true,
        spamLimit: 3,
        spamInterval: 60,
        spamDelayMin: 10_000,
        spamDelayMax: 30_000,
        autoRead: false,
        alwaysOnline: false,
      }),
    });
  }

  async registerWebhook(url: string, secret: string): Promise<void> {
    const webhookUrl = safeHttpsUrl(url);
    if (!secret.trim() || secret.length < 32) throw new Error('wa_akg_webhook_secret_invalid');
    await this.request(`/api/webhooks/${encodeURIComponent(this.session)}`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'WayFlex CRM',
        url: webhookUrl,
        secret,
        events: ['message.received', 'message.sent', 'message.status', 'connection.update'],
      }),
    });
  }
}
