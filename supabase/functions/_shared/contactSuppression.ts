function normalizedPhone(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

function normalizedEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, '') : '';
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, '0')).join('');
}

export async function suppressionHashes(input: { phone?: unknown; whatsapp?: unknown; email?: unknown }): Promise<string[]> {
  const values = [normalizedPhone(input.phone), normalizedPhone(input.whatsapp), normalizedEmail(input.email)]
    .filter((value) => value.length > 0);
  return Promise.all([...new Set(values)].map((value) => sha256(value)));
}

export function suppressionOrFilter(leadId: string, hashes: string[]): string {
  const safeHashes = hashes.filter((hash) => /^[a-f0-9]{64}$/i.test(hash));
  return [`lead_id.eq.${leadId}`, ...safeHashes.map((hash) => `contact_hash.eq.${hash}`)].join(',');
}
