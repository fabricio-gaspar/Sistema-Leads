const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface LeadListMembership {
  id: string;
  leadIds: readonly string[];
}

/** Opens a durable list identity, never an ambiguous display name. */
export function importedLeadListHref(listId: string): string | null {
  return UUID.test(listId) ? `/dashboard/leads?listaId=${encodeURIComponent(listId)}` : null;
}

/** A lead may belong to more than one saved list, so preserve every membership. */
export function indexLeadListMemberships(lists: readonly LeadListMembership[]): Map<string, Set<string>> {
  const memberships = new Map<string, Set<string>>();
  for (const list of lists) {
    for (const leadId of list.leadIds) {
      const listIds = memberships.get(leadId) ?? new Set<string>();
      listIds.add(list.id);
      memberships.set(leadId, listIds);
    }
  }
  return memberships;
}

export function leadMatchesExactList(memberships: ReadonlyMap<string, ReadonlySet<string>>, leadId: string, listId: string): boolean {
  return Boolean(listId) && memberships.get(leadId)?.has(listId) === true;
}
