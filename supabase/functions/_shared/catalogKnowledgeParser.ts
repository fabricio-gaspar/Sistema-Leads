export type CatalogKnowledgeItemType = 'product' | 'service' | 'catalog' | 'document';
export type CatalogKnowledgeScope = 'products' | 'services' | 'catalogs';

export interface CatalogKnowledgeSourceDefinition {
  url: string;
  itemType: CatalogKnowledgeItemType;
  scope: CatalogKnowledgeScope;
  name: string;
}

export interface ExtractedCatalogKnowledgeItem {
  type: CatalogKnowledgeItemType;
  name: string;
  externalKey: string;
  shortDescription: string | null;
  technicalDescription: string | null;
  imageUrl: string | null;
  attachmentUrl: string | null;
  websiteUrl: string | null;
  sourceUrl: string;
  keywords: string[];
}

interface HtmlLink {
  href: string;
  label: string;
  index: number;
}

const clean = (value: unknown, max = 12_000): string => typeof value === 'string'
  ? value.trim().replace(/\s+/g, ' ').slice(0, max)
  : '';

const normalize = (value: string) => clean(value, 800).toLocaleLowerCase('pt-BR').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function htmlText(value: string, max = 12_000): string {
  const withoutUnsafeContent = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  const decoded = withoutUnsafeContent
    .replace(/&#x([0-9a-f]+);/gi, (_, value: string) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/&#(\d+);/g, (_, value: string) => String.fromCodePoint(Number.parseInt(value, 10)))
    .replace(/&(nbsp|#160);/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
  return clean(decoded, max);
}

function safeUrl(value: string | null | undefined, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function linksFromHtml(html: string): HtmlLink[] {
  const links: HtmlLink[] = [];
  const matcher = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(html))) {
    const href = attribute(match[1], 'href');
    if (!href) continue;
    links.push({ href, label: htmlText(match[2], 300), index: match.index });
  }
  return links;
}

function firstImage(html: string, base: string): string | null {
  const match = html.match(/<img\b[^>]*>/i);
  return match ? safeUrl(attribute(match[0], 'src'), base) : null;
}

function firstContentLink(html: string, base: string): string | null {
  const link = linksFromHtml(html).find(({ href }) => href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:'));
  return safeUrl(link?.href, base);
}

function headingsFromHtml(html: string): Array<{ value: string; index: number }> {
  const headings: Array<{ value: string; index: number }> = [];
  const matcher = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(html))) {
    const value = htmlText(match[2], 300);
    if (value) headings.push({ value, index: match.index });
  }
  return headings;
}

function firstHeading(html: string): string {
  return headingsFromHtml(html)[0]?.value || linksFromHtml(html)[0]?.label || '';
}

function paragraphsFromHtml(html: string): string[] {
  const paragraphs: string[] = [];
  const matcher = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(html))) {
    const value = htmlText(match[1], 1_200);
    if (value.length >= 24) paragraphs.push(value);
  }
  return paragraphs;
}

function uniqueValues(values: string[], max = 24): string[] {
  return [...new Set(values.map((value) => clean(value, 80)).filter(Boolean))].slice(0, max);
}

function pageFallback(html: string, definition: CatalogKnowledgeSourceDefinition): ExtractedCatalogKnowledgeItem {
  const title = firstHeading(html) || definition.name;
  const paragraphs = paragraphsFromHtml(html);
  const body = htmlText(html, 10_000);
  return {
    type: definition.itemType,
    name: title,
    externalKey: `page:${normalize(definition.url)}`,
    shortDescription: paragraphs[0] || null,
    technicalDescription: body || null,
    imageUrl: firstImage(html, definition.url),
    attachmentUrl: null,
    websiteUrl: definition.url,
    sourceUrl: definition.url,
    keywords: uniqueValues([definition.scope, ...title.split(/\s+/), ...paragraphs.slice(0, 1).flatMap((value) => value.split(/\s+/))]),
  };
}

function extractCatalogs(html: string, definition: CatalogKnowledgeSourceDefinition): ExtractedCatalogKnowledgeItem[] {
  const seen = new Set<string>();
  const items: ExtractedCatalogKnowledgeItem[] = [];
  const pageTitle = firstHeading(html);
  for (const link of linksFromHtml(html)) {
    const attachmentUrl = safeUrl(link.href, definition.url);
    if (!attachmentUrl || !/\.pdf(?:$|[?#])/i.test(attachmentUrl)) continue;
    const key = `pdf:${normalize(attachmentUrl)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const context = html.slice(Math.max(0, link.index - 900), Math.min(html.length, link.index + 1_800));
    const description = paragraphsFromHtml(context)[0] || '';
    const name = link.label || firstHeading(context) || pageTitle || 'Catálogo Wayflex';
    items.push({
      type: 'catalog', name, externalKey: key,
      shortDescription: description || null,
      technicalDescription: description || null,
      imageUrl: firstImage(context, definition.url),
      attachmentUrl, websiteUrl: definition.url, sourceUrl: attachmentUrl,
      keywords: uniqueValues(['catalogo', 'catálogo', ...name.split(/\s+/), ...description.split(/\s+/)]),
    });
  }
  return items;
}

function isUsefulName(name: string, definition: CatalogKnowledgeSourceDefinition): boolean {
  if (name.length < 3 || /^(menu|inicio|home|contato|saiba mais|ler mais)$/i.test(name)) return false;
  const normalized = normalize(name);
  return normalized !== normalize(definition.name)
    && normalized !== 'servicos'
    && normalized !== 'produtos'
    && normalized !== 'produtos-e-acessorios';
}

function cardFragments(html: string): string[] {
  const fragments: string[] = [];
  const headings = headingsFromHtml(html);
  headings.forEach((heading, index) => {
    const next = headings[index + 1]?.index ?? Math.min(html.length, heading.index + 6_000);
    fragments.push(html.slice(heading.index, Math.min(next, heading.index + 6_000)));
  });
  const cardMatcher = /<(?:article|section|div|li)\b[^>]*\bclass\s*=\s*(?:"[^"]*(?:product|produto|service|servic|card)[^"]*"|'[^']*(?:product|produto|service|servic|card)[^']*')[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = cardMatcher.exec(html))) fragments.push(html.slice(match.index, Math.min(html.length, match.index + 6_000)));
  return fragments;
}

function extractCards(html: string, definition: CatalogKnowledgeSourceDefinition): ExtractedCatalogKnowledgeItem[] {
  const seen = new Set<string>();
  const items: ExtractedCatalogKnowledgeItem[] = [];
  for (const fragment of cardFragments(html)) {
    const name = firstHeading(fragment);
    if (!isUsefulName(name, definition)) continue;
    const paragraphs = paragraphsFromHtml(fragment);
    const description = paragraphs[0] || htmlText(fragment, 2_000);
    if (description.length < 16) continue;
    const websiteUrl = firstContentLink(fragment, definition.url) || definition.url;
    const key = `${normalize(name)}:${normalize(websiteUrl)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push({
      type: definition.itemType, name, externalKey: key,
      shortDescription: description.slice(0, 500) || null,
      technicalDescription: description || null,
      imageUrl: firstImage(fragment, definition.url), attachmentUrl: null,
      websiteUrl, sourceUrl: websiteUrl,
      keywords: uniqueValues([definition.scope, ...name.split(/\s+/), ...description.split(/\s+/)]),
    });
    if (items.length >= 60) break;
  }
  return items;
}

/** This intentionally uses portable HTML extraction: Supabase Edge runtimes do not expose DOMParser. */
export function extractCatalogKnowledgeItems(html: string, definition: CatalogKnowledgeSourceDefinition): ExtractedCatalogKnowledgeItem[] {
  const extracted = definition.scope === 'catalogs' ? extractCatalogs(html, definition) : extractCards(html, definition);
  return extracted.length ? extracted : [pageFallback(html, definition)];
}
