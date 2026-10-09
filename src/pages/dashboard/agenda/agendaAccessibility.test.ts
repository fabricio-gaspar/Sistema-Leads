import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('Agenda keyboard contract', () => {
  it('uses native controls for appointment actions', () => {
    expect(source).not.toContain('role="button" tabIndex={0}');
    expect(source).not.toContain('<span key={item.id} onClick=');
  });
});
