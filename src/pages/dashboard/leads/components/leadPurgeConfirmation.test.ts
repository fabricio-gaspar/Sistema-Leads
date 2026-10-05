import { describe, expect, it } from 'vitest';
import { isLeadPurgeConfirmationValid, leadPurgeConfirmation } from './leadPurgeConfirmation';

describe('leadPurgeConfirmation', () => {
  it('exige a frase exata que o backend valida para a exclusão definitiva', () => {
    expect(leadPurgeConfirmation(2)).toBe('EXCLUIR 2 LEADS');
    expect(isLeadPurgeConfirmationValid('EXCLUIR 2 LEADS', 2)).toBe(true);
    expect(isLeadPurgeConfirmationValid('Excluir 2 leads', 2)).toBe(false);
    expect(isLeadPurgeConfirmationValid('EXCLUIR 1 LEADS', 2)).toBe(false);
  });
});
