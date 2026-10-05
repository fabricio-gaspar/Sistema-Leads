import { describe, expect, it } from 'vitest';
import { podeTransicionar } from './automacao';

describe('transições locais de compatibilidade', () => {
  it('não reabre resultado final no navegador', () => {
    expect(podeTransicionar('Perdido', 'Novo')).toEqual({
      ok: false,
      motivo: 'Transição de "Perdido" para "Novo" não é permitida.',
    });
  });
});
