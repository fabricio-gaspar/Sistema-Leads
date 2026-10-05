import type {
  MessagingProvider,
  ProviderSendRequest,
  ProviderSendResult,
} from './MessagingProvider.ts';

type FetchLike = typeof fetch;
type ObjectValue = Record<string, unknown>;

export interface MetaCoexistenceProviderOptions {
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion: string;
  fetchImpl?: FetchLike;
}

function asObject(value: unknown): ObjectValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {};
}

function normalizedRecipient(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error('meta_recipient_invalid');
  return digits;
}

function safeGraphVersion(value: string): string {
  const normalized = value.trim();
  if (!/^v\d{1,3}\.\d{1,2}$/.test(normalized)) throw new Error('meta_graph_version_invalid');
  return normalized;
}

function safePhoneNumberId(value: string): string {
  const normalized = value.trim();
  if (!/^\d{5,40}$/.test(normalized)) throw new Error('meta_phone_number_id_invalid');
  return normalized;
}

function messagePayload(request: ProviderSendRequest): ObjectValue {
  if (!request.idempotencyKey.trim()) throw new Error('message_idempotency_key_required');
  if (request.kind === 'text') {
    const body = request.text?.trim();
    if (!body || body.length > 4096) throw new Error('meta_text_invalid');
    return { type: 'text', text: { preview_url: false, body } };
  }
  if (request.kind === 'template') {
    const template = request.template;
    if (!template?.name.trim() || !template.language.trim()) throw new Error('meta_template_invalid');
    return {
      type: 'template',
      template: {
        name: template.name.trim(),
        language: { code: template.language.trim() },
        ...(template.components?.length ? { components: template.components } : {}),
      },
    };
  }
  if (request.kind === 'image' || request.kind === 'document') {
    const media = request.media;
    if (!media?.id && !media?.link) throw new Error('meta_media_reference_required');
    const content: ObjectValue = media.id ? { id: media.id } : { link: media.link };
    if (media.caption) content.caption = media.caption.slice(0, 1024);
    if (request.kind === 'document' && media.filename) content.filename = media.filename.slice(0, 240);
    return { type: request.kind, [request.kind]: content };
  }
  throw new Error('meta_message_kind_unsupported');
}

export class MetaCoexistenceProvider implements MessagingProvider {
  readonly name = 'meta_cloud' as const;
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly graphApiVersion: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: MetaCoexistenceProviderOptions) {
    if (!options.accessToken.trim()) throw new Error('meta_access_token_required');
    this.accessToken = options.accessToken.trim();
    this.phoneNumberId = safePhoneNumberId(options.phoneNumberId);
    this.graphApiVersion = safeGraphVersion(options.graphApiVersion);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(request: ProviderSendRequest): Promise<ProviderSendResult> {
    const response = await this.fetchImpl(
      `https://graph.facebook.com/${this.graphApiVersion}/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: normalizedRecipient(request.to),
          ...messagePayload(request),
        }),
        signal: AbortSignal.timeout(20_000),
        redirect: 'error',
      },
    );
    const payload = asObject(await response.json().catch(() => null));
    if (!response.ok) {
      const error = asObject(payload.error);
      const code = typeof error.code === 'number' || typeof error.code === 'string'
        ? String(error.code).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60)
        : String(response.status);
      throw new Error(`meta_send_rejected_${code}`);
    }
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const providerMessageId = typeof asObject(messages[0]).id === 'string'
      ? String(asObject(messages[0]).id).trim().slice(0, 300)
      : '';
    if (!providerMessageId) throw new Error('meta_send_response_invalid');
    return {
      accepted: true,
      providerMessageId,
      provider: this.name,
      acceptedAt: new Date().toISOString(),
    };
  }
}

