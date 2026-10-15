// The two tables intentionally use different persisted vocabularies.
// Keep the values centralized so a new source cannot write an invalid
// `integrations.mode` value and fail before its credentials reach the Vault.
export const integrationRuntimeMode = 'real' as const;
export const leadSourceRuntimeMode = 'production' as const;
