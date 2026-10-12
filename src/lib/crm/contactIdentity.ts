export type ContactIdentityFields = {
  nome?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  empresa?: string | null;
};

const PLACEHOLDER_NAMES = new Set([
  'contato não identificado',
  'contato nao identificado',
  'contato não informado',
  'contato nao informado',
  'sem nome',
  'desconhecido',
  'unknown',
]);

function clean(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isPlaceholderContactName(value: string | null | undefined): boolean {
  const normalized = clean(value).toLocaleLowerCase('pt-BR');
  return !normalized || PLACEHOLDER_NAMES.has(normalized);
}

/** Returns only identity data supplied by the CRM or channel; it never invents a name. */
export function factualLeadDisplayName(contact: ContactIdentityFields): string {
  const name = clean(contact.nome);
  if (!isPlaceholderContactName(name)) return name;

  const phone = clean(contact.whatsapp) || clean(contact.telefone);
  if (phone) return phone;

  const company = clean(contact.empresa);
  return company || 'Contato sem nome';
}

export function factualLeadCompany(contact: ContactIdentityFields, displayName = factualLeadDisplayName(contact)): string {
  const company = clean(contact.empresa);
  return company && company !== displayName ? company : '';
}
