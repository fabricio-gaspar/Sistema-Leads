import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('Dashboard visual contract', () => {
  it('describes polling precisely and does not promise unavailable personalization', () => {
    expect(source).toContain('Atualização automática a cada 60 s');
    expect(source).not.toContain('Operação comercial em tempo real.');
    expect(source).not.toContain('Atualização ao vivo');
    expect(source).not.toContain('Personalizar painel');
  });
});
