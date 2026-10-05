import { describe, expect, it } from 'vitest';
import { splitPlaybookLines } from './anaCommercialPlaybook';

describe('playbook comercial da Ana', () => {
  it('normaliza itens sem criar uma lista vazia', () => {
    expect(splitPlaybookLines('Prazo\n; Escopo\n\nUrgência')).toEqual(['Prazo', 'Escopo', 'Urgência']);
  });

  it('usa um padrão seguro quando não há conteúdo', () => {
    expect(splitPlaybookLines('', ['Necessidade'])).toEqual(['Necessidade']);
  });
});
