/** A LID is opaque. Only a documented phone JID (or explicit phone) is a phone. */
export function phoneFromPersonalJid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^([1-9][0-9]{7,14})(?::[0-9]{1,5})?@(s\.whatsapp\.net|c\.us)$/);
  return match?.[1] ?? null;
}

export type InboundMedia = { kind: 'image' | 'audio' | 'video' | 'document'; url?: string; mimeType?: string; fileName?: string };

/** Preservation only: URLs are never fetched, decrypted, or treated as model text. */
export function inboundMedia(kind: unknown, reference: unknown, mime: unknown, name: unknown): InboundMedia | undefined {
  if (!['image', 'audio', 'video', 'document'].includes(String(kind))) return undefined;
  const result: InboundMedia = { kind: kind as InboundMedia['kind'] };
  if (typeof reference === 'string' && reference.length <= 4096) {
    try {
      const url = new URL(reference);
      if (url.protocol === 'https:' && !url.username && !url.password) result.url = url.toString();
    } catch { /* Keep media identity even when its reference cannot be displayed safely. */ }
  }
  if (typeof mime === 'string') result.mimeType = mime.slice(0, 120);
  if (typeof name === 'string') result.fileName = name.slice(0, 240);
  return result;
}
