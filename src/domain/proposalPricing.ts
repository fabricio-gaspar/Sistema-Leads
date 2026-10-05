import type { Proposta } from '@/mocks/propostasData';

/** A catalog zero is ambiguous; only an explicit human input confirms a free item. */
export function confirmedUnitPrice(catalogPrice: number, input?: string): number | null {
  if (input !== undefined) {
    if (!input.trim()) return null;
    const price = Number(input);
    return Number.isFinite(price) && price >= 0 ? price : null;
  }
  return Number.isFinite(catalogPrice) && catalogPrice > 0 ? catalogPrice : null;
}
export function hasUnconfirmedPrices(proposal: Proposta): boolean {
  return proposal.itens.some((item) => !Number.isFinite(item.preco) || item.preco < 0 || (item.preco === 0 && item.precoConfirmado !== true));
}
