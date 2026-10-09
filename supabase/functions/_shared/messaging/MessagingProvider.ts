export type MessagingProviderName = 'zapi' | 'meta_cloud' | 'wa_akg';
export type MessageOrigin = 'customer' | 'business_app' | 'panel' | 'ana' | 'template' | 'system';
export type MessageKind = 'text' | 'template' | 'image' | 'audio' | 'video' | 'document';
export type DeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface ProviderSendRequest {
  to: string;
  kind: MessageKind;
  text?: string;
  template?: {
    name: string;
    language: string;
    components?: unknown[];
  };
  media?: {
    id?: string;
    link?: string;
    caption?: string;
    filename?: string;
  };
  idempotencyKey: string;
}

export interface ProviderSendResult {
  accepted: boolean;
  providerMessageId: string;
  provider: MessagingProviderName;
  acceptedAt: string;
}

export interface MessagingProvider {
  readonly name: MessagingProviderName;
  send(request: ProviderSendRequest): Promise<ProviderSendResult>;
}
