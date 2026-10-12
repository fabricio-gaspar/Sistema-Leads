import { describe, expect, it } from 'vitest';
import { adviseProspectingSearch } from './prospectingSearchAdvisor';

describe('orientação de abrangência da busca de leads', () => {
  it('sugere ampliar uma combinação de muitos termos e contatos obrigatórios', () => {
    expect(adviseProspectingSearch({
      terms: ['artefatos de borracha', 'perfis de borracha', 'guarnições de borracha'],
      requireSite: true,
      requireWhatsApp: true,
      requireEmail: false,
    })).toEqual({
      primaryTerm: 'artefatos de borracha',
      removeContactRequirements: true,
    });
  });

  it('não interfere em uma busca simples já compatível com a cobertura da fonte', () => {
    expect(adviseProspectingSearch({
      terms: ['artefatos de borracha'],
      requireSite: true,
      requireWhatsApp: false,
      requireEmail: false,
    })).toBeNull();
  });
});
