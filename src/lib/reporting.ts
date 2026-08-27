import type { Proposta, Venda } from '@/mocks/propostasData';

// Sales persist the commercial proposal number, while proposal rows use a UUID
// as their primary identifier. Reporting must join by the immutable number.
export function proposalForSale(proposals: Proposta[], sale: Pick<Venda, 'proposta'>): Proposta | undefined {
  return proposals.find((proposal) => proposal.numero === sale.proposta);
}
