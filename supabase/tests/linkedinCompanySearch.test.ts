import { describe, expect, it } from 'vitest';
import {
  buildLinkedInActorInput,
  dedupeLinkedInCompanies,
  linkedInErrorCode,
  normalizeLinkedInCompany,
  validateLinkedInCredentials,
} from '../functions/_shared/linkedinCompanySearch.ts';

describe('LinkedIn Company Search adapter', () => {
  it('maps reviewed filters without leaking credentials and lets filters win over JSON defaults', () => {
    const input = buildLinkedInActorInput(
      {
        api_token: 'secret-value',
        actor_id: 'taHaRcqil3scbchuI',
        input_json: JSON.stringify({ searchQuery: 'default', maxItems: 999, mode: 'full' }),
      },
      {
        searchQuery: 'fabricantes de borracha',
        locations: ['São Paulo, SP'],
        industryIds: ['25'],
        companySize: ['51-200'],
        maxItems: 20,
        startPage: 2,
        takePages: 1,
        mode: 'short',
      },
    );

    expect(input).toMatchObject({
      searchQuery: 'fabricantes de borracha',
      locations: ['São Paulo, SP'],
      industryIds: ['25'],
      companySize: ['51-200'],
      maxItems: 20,
      startPage: 2,
      takePages: 1,
      mode: 'short',
    });
    expect(JSON.stringify(input)).not.toContain('secret-value');
  });

  it('normalizes optional contact fields without inventing a phone or email', () => {
    expect(normalizeLinkedInCompany({
      name: 'Acme Industrial',
      linkedinUrl: 'https://www.linkedin.com/company/acme-industrial/',
      website: 'https://acme.example',
      phone: null,
      employeeCount: 84,
      locations: [{ parsed: { city: 'São Paulo', state: 'SP', country: 'Brasil' } }],
      industries: ['Manufacturing'],
    })).toEqual(expect.objectContaining({
      name: 'Acme Industrial',
      linkedinUrl: 'https://linkedin.com/company/acme-industrial',
      website: 'https://acme.example',
      phone: null,
      email: null,
      city: 'São Paulo',
      state: 'SP',
      segment: 'Manufacturing',
      size: '84',
    }));
  });

  it('deduplicates by LinkedIn URL, domain, then company and location', () => {
    const result = dedupeLinkedInCompanies([
      { name: 'Acme', linkedinUrl: 'https://linkedin.com/company/acme/', website: 'https://acme.example/', city: 'São Paulo', state: 'SP', phone: null, email: null, segment: '', size: '', sourceUrl: 'https://linkedin.com/company/acme' },
      { name: 'Acme duplicate', linkedinUrl: 'https://www.linkedin.com/company/acme', website: 'https://another.example', city: 'Rio', state: 'RJ', phone: null, email: null, segment: '', size: '', sourceUrl: 'https://linkedin.com/company/acme' },
      { name: 'Beta', linkedinUrl: '', website: 'https://beta.example/path', city: 'São Paulo', state: 'SP', phone: null, email: null, segment: '', size: '', sourceUrl: 'https://linkedin.com/company/beta' },
      { name: 'Beta duplicate', linkedinUrl: '', website: 'https://beta.example/other', city: 'São Paulo', state: 'SP', phone: null, email: null, segment: '', size: '', sourceUrl: 'https://linkedin.com/company/beta-2' },
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.name)).toEqual(['Acme', 'Beta']);
  });

  it('rejects incomplete credentials and classifies provider failures without exposing messages', () => {
    expect(() => validateLinkedInCredentials({ api_token: 'token' })).toThrow('source_credentials_missing');
    expect(linkedInErrorCode(new Error('source_credentials_missing'))).toBe('linkedin_credentials_required');
    expect(linkedInErrorCode(new Error('Request timed out while waiting for Actor'))).toBe('linkedin_provider_timeout');
    expect(linkedInErrorCode({ statusCode: 429 })).toBe('linkedin_rate_limited');
    expect(linkedInErrorCode({ statusCode: 403 })).toBe('linkedin_resource_forbidden');
  });
});
