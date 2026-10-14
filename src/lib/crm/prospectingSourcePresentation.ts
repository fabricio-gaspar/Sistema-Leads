const LEGACY_LABELS: Record<string, ReadonlySet<string>> = {
  apify: new Set(['Apify — Google Maps', 'Apify / Google Maps']),
  google_places: new Set(['Google Places']),
  linkedin: new Set(['LinkedIn', 'LinkedIn · Company Search', 'Apify / LinkedIn']),
};

const DISPLAY_NAMES: Record<string, string> = {
  apify: 'Google Maps',
  google_places: 'Google',
  linkedin: 'LinkedIn · Company Search',
};

/**
 * Keeps source keys and custom organization labels intact while presenting the
 * approved product names for the two prospecting connectors.
 */
export function prospectingSourceDisplayName(sourceKey?: string | null, label?: string | null): string {
  const key = sourceKey?.trim() || '';
  const normalizedLabel = label?.trim() || '';
  const displayName = DISPLAY_NAMES[key];

  if (displayName && (!normalizedLabel || LEGACY_LABELS[key]?.has(normalizedLabel))) return displayName;
  return normalizedLabel || displayName || 'Fonte de busca';
}
