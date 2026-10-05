export type CatalogImageMediaRequest = {
  type: 'image';
  catalogItemId: string;
};

export type CatalogImageCandidate = {
  id: string;
  itemType: 'product' | 'service' | 'catalog' | 'document';
  name: string;
  shortDescription?: string | null;
  technicalDescription?: string | null;
  category?: string | null;
  material?: string | null;
  applications?: unknown;
  keywords?: unknown;
  imageUrl?: string | null;
};

const isObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const text = (value: unknown, max = 4_000): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const normalize = (value: unknown): string =>
  text(value, 12_000)
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const list = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : [];

const stopWords = new Set([
  'para', 'com', 'sem', 'uma', 'que', 'isso', 'como', 'qual', 'quais',
  'voces', 'sobre', 'essa', 'esse', 'esta', 'estao', 'tem', 'tenho', 'por',
  'nos', 'dos', 'das', 'sao', 'ser', 'mais', 'quero', 'preciso', 'gostaria',
]);

function variants(term: string): string[] {
  const values = [term];
  if (term.endsWith('oes') && term.length > 4) values.push(`${term.slice(0, -3)}ao`);
  if (term.endsWith('es') && term.length > 4) values.push(term.slice(0, -2));
  if (term.endsWith('s') && term.length > 3) values.push(term.slice(0, -1));
  return [...new Set(values.filter((item) => item.length >= 3))];
}

/**
 * The provider fetches this URL itself. Keep only public HTTPS URLs, with no
 * credentials or literal/private-host forms, before an item can reach Z-API.
 */
export function safePublicImageUrl(value: unknown): string | null {
  const candidate = text(value, 2_000);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase();
    const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    const numericHost = /^\d+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      (url.port && url.port !== '443') ||
      !hostname ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.includes(':') ||
      ipv4 ||
      numericHost
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function readCatalogImageMedia(value: unknown): CatalogImageMediaRequest | null {
  if (value === undefined || value === null) return null;
  const media = isObject(value);
  const type = text(media.type, 24).toLowerCase();
  const catalogItemId = text(media.catalog_item_id, 80);
  if (type !== 'image' || !isUuid(catalogItemId)) {
    throw new Error('catalog_media_payload_invalid');
  }
  return { type: 'image', catalogItemId };
}

/**
 * Image selection is deterministic and intentionally conservative. A generic
 * greeting must never select an arbitrary catalog card for an automatic send.
 */
export function selectCatalogImageCandidate(input: {
  enabled: boolean;
  channel: string;
  event: string;
  intent: string;
  question: unknown;
  candidates: CatalogImageCandidate[];
}): CatalogImageCandidate | null {
  if (!input.enabled || input.channel !== 'whatsapp' || input.event !== 'message.received') return null;
  if (!['produto', 'servico', 'catalogo', 'duvida_tecnica'].includes(input.intent)) return null;
  const terms = normalize(input.question)
    .split(' ')
    .filter((term) => term.length >= 3 && !stopWords.has(term));
  if (!terms.length) return null;

  const ranked = input.candidates
    .filter((item) => ['product', 'service', 'catalog'].includes(item.itemType) && Boolean(safePublicImageUrl(item.imageUrl)))
    .map((item) => {
      const name = normalize(item.name);
      const labels = normalize([item.category, item.material, ...list(item.keywords)].filter(Boolean).join(' '));
      const details = normalize([item.shortDescription, item.technicalDescription, ...list(item.applications)].filter(Boolean).join(' '));
      const score = terms.reduce((total, term) => {
        const matches = variants(term);
        if (matches.some((match) => name.includes(match))) return total + 3;
        if (matches.some((match) => labels.includes(match))) return total + 2;
        if (matches.some((match) => details.includes(match))) return total + 1;
        return total;
      }, 0);
      return { item, score };
    })
    .filter(({ score }) => score >= 3)
    .sort((left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name, 'pt-BR'));

  return ranked[0]?.item ?? null;
}
