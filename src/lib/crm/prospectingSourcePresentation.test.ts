import { describe, expect, it } from 'vitest';
import { prospectingSourceDisplayName } from './prospectingSourcePresentation';

describe('prospecting source presentation', () => {
  it('renames legacy configured provider labels without changing their source keys', () => {
    expect(prospectingSourceDisplayName('apify', 'Apify — Google Maps')).toBe('Google Maps');
    expect(prospectingSourceDisplayName('apify', 'Apify / Google Maps')).toBe('Google Maps');
    expect(prospectingSourceDisplayName('google_places', 'Google Places')).toBe('Google');
    expect(prospectingSourceDisplayName('linkedin', 'LinkedIn · Company Search')).toBe('LinkedIn · Company Search');
  });

  it('keeps a custom label for a configured source', () => {
    expect(prospectingSourceDisplayName('apify', 'Mapa industrial prioritário')).toBe('Mapa industrial prioritário');
  });
});
