export interface ProspectingSearchAdviceInput {
  terms: readonly string[];
  requireSite: boolean;
  requireWhatsApp: boolean;
  requireEmail: boolean;
}

export interface ProspectingSearchAdvice {
  primaryTerm: string;
  removeContactRequirements: boolean;
}

/**
 * The source receives every selected term and then applies the contact
 * requirements as an intersection. Flag combinations with a high chance of
 * yielding an empty review, but never change filters or start a request.
 */
export function adviseProspectingSearch(input: ProspectingSearchAdviceInput): ProspectingSearchAdvice | null {
  const terms = input.terms.map((term) => term.trim()).filter(Boolean);
  const contactRequirements = Number(input.requireWhatsApp) + Number(input.requireEmail);

  if (terms.length < 2 || contactRequirements === 0) return null;

  return {
    primaryTerm: terms[0],
    removeContactRequirements: true,
  };
}
