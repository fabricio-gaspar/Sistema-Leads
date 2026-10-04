export const INTEGRATION_VALIDATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export type IntegrationDisplayStatus =
  | 'validated'
  | 'validation_due'
  | 'inactive'
  | 'paused'
  | 'pending'
  | 'error'
  | 'not_configured';

export type SourceDisplayStatus = 'active' | 'paused' | 'error' | 'not_configured';

export type StatusTone = 'positive' | 'attention' | 'critical' | 'neutral';

export interface StatusPresentation<TStatus extends string> {
  status: TStatus;
  label: string;
  tone: StatusTone;
}

export interface IntegrationStatusInput {
  key?: string | null;
  connected: boolean;
  enabled: boolean;
  paused: boolean;
  lastError: string | null;
  lastTestedAt: string | null;
}

export interface SourceStatusInput {
  enabled: boolean;
  connectionStatus: string | null;
  lastError: string | null;
}

const integrationCopy: Record<IntegrationDisplayStatus, Omit<StatusPresentation<IntegrationDisplayStatus>, 'status'>> = {
  validated: { label: 'Validada', tone: 'positive' },
  validation_due: { label: 'Validação vencida', tone: 'attention' },
  inactive: { label: 'Configurada · inativa', tone: 'neutral' },
  paused: { label: 'Pausada', tone: 'attention' },
  pending: { label: 'Entrada pendente', tone: 'attention' },
  error: { label: 'Erro de conexão', tone: 'critical' },
  not_configured: { label: 'Não configurada', tone: 'neutral' },
};

const sourceCopy: Record<SourceDisplayStatus, Omit<StatusPresentation<SourceDisplayStatus>, 'status'>> = {
  active: { label: 'Ativa', tone: 'positive' },
  paused: { label: 'Pausada', tone: 'attention' },
  error: { label: 'Falha na fonte', tone: 'critical' },
  not_configured: { label: 'Não configurada', tone: 'neutral' },
};

export function hasFreshIntegrationValidation(value: string | null, now = Date.now()): boolean {
  if (!value) return false;
  const testedAt = new Date(value).getTime();
  return Number.isFinite(testedAt) && now - testedAt <= INTEGRATION_VALIDATION_WINDOW_MS;
}

/**
 * Converte os campos operacionais do backend em um único estado público.
 * Uma conexão persistida não é apresentada como validada depois de 24 horas
 * sem nova validação; esse é o mesmo prazo usado pelo diagnóstico server-side.
 */
export function integrationDisplayStatus(input: IntegrationStatusInput, now = Date.now()): IntegrationDisplayStatus {
  if (input.key === 'zapi_webhook' && input.enabled && input.lastError === 'lead_not_matched') return 'pending';
  if (input.lastError) return 'error';
  if (input.paused) return 'paused';
  if (!input.connected) return input.key === 'zapi_webhook' && input.enabled ? 'pending' : 'not_configured';
  if (!input.enabled) return 'inactive';
  return hasFreshIntegrationValidation(input.lastTestedAt, now) ? 'validated' : 'validation_due';
}

export function presentIntegrationStatus(input: IntegrationStatusInput, now = Date.now()): StatusPresentation<IntegrationDisplayStatus> {
  const status = integrationDisplayStatus(input, now);
  return { status, ...integrationCopy[status] };
}

/**
 * Evita que um texto histórico do provedor contradiga o selo operacional.
 * Por exemplo, uma mensagem de sucesso gravada no último teste não deve
 * apresentar a integração como atual quando essa validação já venceu.
 */
export function integrationStatusDetail(input: IntegrationStatusInput, fallback: string, now = Date.now()): string {
  switch (integrationDisplayStatus(input, now)) {
    case 'validation_due':
      return 'A configuração está salva, mas a validação venceu. Execute um novo teste antes de considerar esta integração disponível.';
    case 'inactive':
      return 'A configuração está salva, porém o uso operacional desta integração está desativado.';
    case 'paused':
      return 'A configuração está salva, porém esta integração está pausada.';
    case 'not_configured':
      return 'Esta integração ainda não possui uma configuração validada.';
    default:
      return fallback;
  }
}

export function sourceDisplayStatus(input: SourceStatusInput): SourceDisplayStatus {
  if (input.lastError || input.connectionStatus === 'error') return 'error';
  if (input.connectionStatus !== 'connected') return 'not_configured';
  return input.enabled ? 'active' : 'paused';
}

export function presentSourceStatus(input: SourceStatusInput): StatusPresentation<SourceDisplayStatus> {
  const status = sourceDisplayStatus(input);
  return { status, ...sourceCopy[status] };
}

export function operationalIcon(key: string): string {
  const icons: Record<string, string> = {
    whatsapp: 'ri-whatsapp-line',
    whatsapp_evolution_go: 'ri-whatsapp-line',
    whatsapp_zapi: 'ri-whatsapp-line',
    whatsapp_meta: 'ri-meta-line',
    evolution_go_webhook: 'ri-webhook-line',
    zapi_webhook: 'ri-chat-check-line',
    ai: 'ri-brain-line',
    apify: 'ri-map-pin-search-line',
    google_places: 'ri-google-line',
    csv: 'ri-file-upload-line',
    manual: 'ri-edit-2-line',
  };
  return icons[key] || 'ri-plug-2-line';
}

export function operationalIconTone(key: string): string {
  const tones: Record<string, string> = {
    whatsapp: 'bg-[#25D366]/10 text-[#128C3E]',
    whatsapp_evolution_go: 'bg-[#E8F7EF] text-[#168654]',
    whatsapp_zapi: 'bg-[#25D366]/10 text-[#128C3E]',
    whatsapp_meta: 'bg-[#0866FF]/10 text-[#0866FF]',
    evolution_go_webhook: 'bg-[#E8F7EF] text-[#168654]',
    zapi_webhook: 'bg-[#25D366]/10 text-[#128C3E]',
    ai: 'bg-primary-50 text-primary-700',
    apify: 'bg-[#FF6B35]/10 text-[#C2410C]',
    google_places: 'bg-[#4285F4]/10 text-[#2563EB]',
    csv: 'bg-primary-50 text-primary-700',
    manual: 'bg-background-100 text-foreground-600',
  };
  return tones[key] || 'bg-background-100 text-foreground-600';
}

/** Somente caminhos que têm uma tela operacional disponível no CRM atual. */
export const DASHBOARD_CHANNEL_KEYS = ['whatsapp_evolution_go:', 'whatsapp_meta'] as const;
export const DASHBOARD_API_KEYS = ['ai', 'apify', 'google_places'] as const;
export const DASHBOARD_SOURCE_KEYS = ['apify', 'manual', 'csv'] as const;
