export type CatalogKnowledgeItemType = 'product' | 'service' | 'catalog' | 'document';
export type CatalogKnowledgeScope = 'products' | 'services' | 'catalogs';
export type CatalogKnowledgeImportShape = 'html_card' | 'page_fallback' | 'spa_bundle' | 'public_snapshot';

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
  category?: string | null;
  applications?: string[];
  imageUrl: string | null;
  attachmentUrl: string | null;
  websiteUrl: string | null;
  sourceUrl: string;
  keywords: string[];
  importShape?: CatalogKnowledgeImportShape;
  sourceAssetUrl?: string | null;
}

interface HtmlLink {
  href: string;
  label: string;
  index: number;
}

interface WayflexSegmentSnapshot {
  name: string;
  description: string;
  imageUrl: string;
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
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
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
    category: definition.scope,
    imageUrl: firstImage(html, definition.url),
    attachmentUrl: null,
    websiteUrl: definition.url,
    sourceUrl: definition.url,
    keywords: uniqueValues([definition.scope, ...title.split(/\s+/), ...paragraphs.slice(0, 1).flatMap((value) => value.split(/\s+/))]),
    importShape: 'page_fallback',
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
      category: 'Catálogo',
      imageUrl: firstImage(context, definition.url),
      attachmentUrl, websiteUrl: definition.url, sourceUrl: definition.url,
      keywords: uniqueValues(['catalogo', 'catálogo', ...name.split(/\s+/), ...description.split(/\s+/)]),
      importShape: 'html_card',
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
      category: definition.scope,
      imageUrl: firstImage(fragment, definition.url), attachmentUrl: null,
      websiteUrl, sourceUrl: definition.url,
      keywords: uniqueValues([definition.scope, ...name.split(/\s+/), ...description.split(/\s+/)]),
      importShape: 'html_card',
    });
    if (items.length >= 60) break;
  }
  return items;
}

function jsString(value: string): string {
  return value.replace(/\\u([0-9a-f]{4})/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/\\(["'\\/bnrt])/g, (_, escaped: string) => ({ b: '\\b', n: '\n', r: '\r', t: '\t' }[escaped] ?? escaped));
}

function spaAssetAliases(bundle: string, definition: CatalogKnowledgeSourceDefinition): Map<string, string> {
  const aliases = new Map<string, string>();
  const matcher = /\b([A-Za-z_$][\w$]*)\s*=\s*["'](\/assets\/[^"']+\.(?:png|jpe?g|webp)(?:\?[^"']*)?)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(bundle))) {
    const url = safeUrl(match[2], definition.url);
    if (url) aliases.set(match[1], url);
  }
  return aliases;
}

/** Extracts same-origin SPA entry scripts. Only direct module assets are accepted. */
export function extractSpaModuleUrls(html: string, pageUrl: string): string[] {
  let origin = '';
  try { origin = new URL(pageUrl).origin; } catch { return []; }
  const urls = new Set<string>();
  const matcher = /<script\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*><\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(html))) {
    const url = safeUrl(match[1] ?? match[2] ?? match[3], pageUrl);
    if (url && new URL(url).origin === origin) urls.add(url);
  }
  return [...urls].slice(0, 3);
}

function spaProducts(bundle: string, definition: CatalogKnowledgeSourceDefinition, aliases: Map<string, string>): ExtractedCatalogKnowledgeItem[] {
  const seen = new Set<string>();
  const items: ExtractedCatalogKnowledgeItem[] = [];
  const matcher = /\{\s*img\s*:\s*([A-Za-z_$][\w$]*)\s*,\s*label\s*:\s*"((?:\\.|[^"])*)"\s*\}/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(bundle))) {
    const imageUrl = aliases.get(match[1]);
    const name = clean(jsString(match[2]), 500);
    if (!imageUrl || !/\/assets\/acessorio-/i.test(imageUrl) || !name) continue;
    const externalKey = `spa:product:${normalize(name)}`;
    if (seen.has(externalKey)) continue;
    seen.add(externalKey);
    items.push({
      type: 'product', name, externalKey,
      shortDescription: name,
      technicalDescription: name,
      category: 'Acessório industrial',
      applications: [],
      imageUrl, attachmentUrl: null, websiteUrl: definition.url, sourceUrl: definition.url,
      keywords: uniqueValues(['produto', 'acessório', ...name.split(/\s+/)]),
      importShape: 'spa_bundle', sourceAssetUrl: imageUrl,
    });
  }
  return items;
}

function spaCatalogs(bundle: string, definition: CatalogKnowledgeSourceDefinition, aliases: Map<string, string>): ExtractedCatalogKnowledgeItem[] {
  const seen = new Set<string>();
  const items: ExtractedCatalogKnowledgeItem[] = [];
  const matcher = /\{\s*id\s*:\s*"[^"]+"\s*,\s*title\s*:\s*"((?:\\.|[^"])*)"\s*,\s*category\s*:\s*"((?:\\.|[^"])*)"\s*,\s*cover_url\s*:\s*([A-Za-z_$][\w$]*)\s*,\s*description\s*:\s*"((?:\\.|[^"])*)"\s*,\s*pdf_url\s*:\s*(null|"((?:\\.|[^"])*)")\s*\}/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(bundle))) {
    const name = clean(jsString(match[1]), 500);
    const category = clean(jsString(match[2]), 160);
    const imageUrl = aliases.get(match[3]);
    const description = clean(jsString(match[4]), 1_200);
    const attachmentUrl = match[5] === 'null' ? null : safeUrl(jsString(match[6] || ''), definition.url);
    if (!name || !imageUrl || !description) continue;
    const externalKey = `spa:catalog:${normalize(name)}`;
    if (seen.has(externalKey)) continue;
    seen.add(externalKey);
    items.push({
      type: 'catalog', name, externalKey,
      shortDescription: description,
      technicalDescription: description,
      category: category || 'Catálogo visual',
      applications: [],
      imageUrl, attachmentUrl, websiteUrl: definition.url, sourceUrl: definition.url,
      keywords: uniqueValues(['catalogo', 'catálogo', category, ...name.split(/\s+/), ...description.split(/\s+/)]),
      importShape: 'spa_bundle', sourceAssetUrl: imageUrl,
    });
  }
  return items;
}

/**
 * The public Wayflex pages are SPA shells. Products and visual catalogs are
 * published in the page bundle, so this parser intentionally reads only the
 * known, same-origin fields rather than trying to execute third-party code.
 */
export function extractWayflexSpaBundleItems(bundle: string, definition: CatalogKnowledgeSourceDefinition): ExtractedCatalogKnowledgeItem[] {
  const aliases = spaAssetAliases(bundle, definition);
  if (definition.scope === 'products') return spaProducts(bundle, definition, aliases);
  if (definition.scope === 'catalogs') return spaCatalogs(bundle, definition, aliases);
  return [];
}

// The segment page exposes the entries at runtime rather than in its HTML or
// same-origin bundle. These are the published entries captured from the public
// page on 2026-09-23. They remain traceable to /servicos and never replace a
// future server-side adapter for a structured public source.
const WAYFLEX_SEGMENT_SNAPSHOT: WayflexSegmentSnapshot[] = [
  { name: 'Automotivo Diversos', description: 'Fabricamos uma ampla linha de peças técnicas em borracha e poliuretano para o setor automotivo.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/b8131e0b-91fd-4b3c-9502-bbdc331cd0a4-v2.jpg?v=1779291846746' },
  { name: 'Automotivo – Linha Leve', description: 'Soluções específicas para veículos de passeio e utilitários leves.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/2eecaadf-feb3-4837-a72a-37eba79eeb11-v2.jpg?v=1779291848228' },
  { name: 'Automotivo – Linha Pesada', description: 'Peças robustas para caminhões, ônibus e veículos pesados.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/31d479d7-d7d9-4e05-8108-f13ccab13050-v2.jpg?v=1779291849271' },
  { name: 'Caixilharia', description: 'Perfis e gaxetas de vedação para esquadrias de alumínio, PVC e madeira. Principais Produtos: Acessórios para esquadrias e divisórias. Tarucel, guarnições em EPDM e PVC. Fitas vedadoras, escovas de vedação, espumas de PVC e polietileno expandido.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/02bd139d-baee-4e9c-8919-bda9e700327f-v2.jpg?v=1779291850574' },
  { name: 'Capacete', description: 'Componentes em borracha e espuma para a indústria de capacetes de segurança e motociclísticos.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/a491007d-b0e4-44ec-a1ce-caa20bae635e-v2.jpg?v=1779291852064' },
  { name: 'Cinta para Tanque', description: 'Borrachas e elementos de proteção para cintas de fixação de tanques de combustível.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/49849bf4-442d-4204-bb39-8ba1cdfd6149-v2.jpg?v=1779291853142' },
  { name: 'Container', description: 'Perfis de vedação e gaxetas para containers marítimos, refrigerados e especiais.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/129ee1ad-d574-42af-85ac-1f73253cb1fe-v2.jpg?v=1779291853782' },
  { name: 'Faróis, Lanternas e Luminárias', description: 'Vedações e componentes técnicos em borracha para a indústria de iluminação.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/abc32120-91d7-402f-9f05-2d6ff7f18211-v2.jpg?v=1779291854449' },
  { name: 'Gás e Óleo', description: 'Peças técnicas para a indústria de gás e petróleo.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/4cd3a451-7fd7-4543-886d-55bd704d88e4-v2.jpg?v=1779291855123' },
  { name: 'Implementos Rodoviários', description: 'Componentes em borracha para carretas, semirreboques, baús e implementos rodoviários. Principais Produtos: Juntas de dilatação e batentes para o setor rodoviário. Perfis de borracha para portas de container (modelos WF).', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/e25c66ff-8fc8-472c-905d-d7bd221333de-v2.jpg?v=1779291855721' },
  { name: 'Construção Civil e Infraestrutura', description: 'Soluções em elastômeros para obras de infraestrutura e construção civil. Principais Produtos: Perfis de borracha para formas de pré-moldados (ideais para cantos vivos de pilares, vigas e escadas). Juntas de dilatação e batentes para pontes e viadutos.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/4b6bb646-a2db-48cb-bc5e-606bf6047694-v2.jpg?v=1779291856363' },
  { name: 'Máquinas e Equipamentos', description: 'Peças técnicas sob medida para o setor de máquinas industriais e equipamentos pesados.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/ec148630-4d4c-4e09-b1e6-7ad443a6dd37-v2.jpg?v=1779291857425' },
  { name: 'Mineração', description: 'Componentes de alta resistência para a indústria mineradora. Principais Produtos: Produtos em poliuretano (PU): anéis e coxim para britadores (cônicos, linha HP). Lençóis de borracha para revestimento contra desgaste por abrasão. Perfil de borracha Tipo U para guarnições de longarinas de peneiras.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/edde5d69-d342-44d6-8352-e8254f8c270c-v2.jpg?v=1779291858100' },
  { name: 'Multiuso', description: 'Linha versátil de produtos em borracha para aplicações diversas.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/0bdce942-23c3-4833-bddc-1a650406086d-v2.jpg?v=1779291858728' },
  { name: 'Naval', description: 'Peças e vedações para a indústria naval e offshore.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/e08cf495-d444-4c49-a908-73b422bb0a9f-v2.jpg?v=1779291859336' },
  { name: 'Refrigeração', description: 'Gaxetas e perfis de vedação para equipamentos de refrigeração. Principais Produtos: Borracha de Silicone: vedação para portas de fornos industriais (turbo), estufas e autoclaves. Perfis, guarnições, tubos anti-chamas e peças prensadas com baixa absorção de umidade e alta flexibilidade.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/8379f2d9-06f3-4e77-8522-a66a8301caf0-v2.jpg?v=1779291859943' },
  { name: 'Transformador', description: 'Vedações e componentes em borracha para transformadores de energia elétrica. Principais Produtos: Perfis, arruelas e cordões nitrílicos para transformadores (resistentes a óleo isolante). Perfis de vedação esponjosa para quadros de comando elétrico (resistência à luz solar e calor).', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/df83358d-faf0-4376-abce-b58aa051366f-v2.jpg?v=1779291860567' },
  { name: 'Setor de Energia (Renovável e Hidrelétrica)', description: 'Soluções em borracha, silicone e poliuretano para o setor de energia renovável e hidrelétrica, com peças técnicas de alta durabilidade e desempenho. Principais Produtos: Aquecedor Solar: coletores, mantas de absorção e mangueiras em EPDM (alta durabilidade e eficiência térmica). Energia Fotovoltaica: perfis de vedação específicos para painéis solares. Hidrelétricas: perfis tipo "Nota Musical" para vedação de comportas.', imageUrl: 'https://hthbilcukkuczhxpxxck.supabase.co/storage/v1/object/public/site-images/segments/02ee5c03-a3ff-4411-911b-351b364d2648-v2.jpg?v=1779291861709' },
];

/** See the note above the snapshot: it is used only for the public segments page. */
export function extractWayflexSegmentSnapshotItems(definition: CatalogKnowledgeSourceDefinition): ExtractedCatalogKnowledgeItem[] {
  if (definition.scope !== 'services') return [];
  return WAYFLEX_SEGMENT_SNAPSHOT.map((segment) => ({
    type: 'service',
    name: segment.name,
    externalKey: `public:segment:${normalize(segment.name)}`,
    shortDescription: segment.description,
    technicalDescription: segment.description,
    category: 'Segmento de atuação',
    applications: [],
    imageUrl: segment.imageUrl,
    attachmentUrl: null,
    websiteUrl: definition.url,
    sourceUrl: definition.url,
    keywords: uniqueValues(['segmento', 'aplicação', ...segment.name.split(/\s+/), ...segment.description.split(/\s+/)]),
    importShape: 'public_snapshot',
    sourceAssetUrl: segment.imageUrl,
  }));
}

/**
 * `documents` stores one generated document per source URL. Cards on a single
 * page therefore use a stable fragment for the document trace while the
 * canonical page remains available as `websiteUrl` and source metadata.
 */
export function catalogItemTraceUrl(item: ExtractedCatalogKnowledgeItem, definition: CatalogKnowledgeSourceDefinition): string {
  const page = new URL(item.sourceUrl || definition.url, definition.url);
  page.hash = `knowledge-${encodeURIComponent(item.externalKey).slice(0, 180)}`;
  return page.toString();
}

/** This intentionally uses portable extraction: Supabase Edge runtimes do not expose DOMParser. */
export function extractCatalogKnowledgeItems(html: string, definition: CatalogKnowledgeSourceDefinition): ExtractedCatalogKnowledgeItem[] {
  const extracted = definition.scope === 'catalogs' ? extractCatalogs(html, definition) : extractCards(html, definition);
  return extracted.length ? extracted : [pageFallback(html, definition)];
}
