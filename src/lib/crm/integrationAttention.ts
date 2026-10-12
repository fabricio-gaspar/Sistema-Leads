export const REQUIRED_OPERATIONAL_INTEGRATIONS = ['ai', 'apify'] as const;

type IntegrationStatus = { remoteKey: string; status: string };

export function countRequiredIntegrationAttention(integrations: IntegrationStatus[]): number {
  return integrations.filter((integration) => REQUIRED_OPERATIONAL_INTEGRATIONS.includes(integration.remoteKey as typeof REQUIRED_OPERATIONAL_INTEGRATIONS[number])
    && ['validation_due', 'error', 'not_configured'].includes(integration.status)).length;
}

export function hasOptionalIntegrationAttention(integrations: IntegrationStatus[]): boolean {
  return integrations.some((integration) => !REQUIRED_OPERATIONAL_INTEGRATIONS.includes(integration.remoteKey as typeof REQUIRED_OPERATIONAL_INTEGRATIONS[number])
    && ['validation_due', 'error', 'not_configured'].includes(integration.status));
}
