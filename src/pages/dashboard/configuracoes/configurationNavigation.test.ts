import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('Configuration navigation layout', () => {
  it('keeps grouped navigation visible from the desktop breakpoint', () => {
    expect(source).toContain('xl:flex-row');
    expect(source).toContain('xl:block');
    expect(source).toContain('xl:hidden');
    expect(source).not.toContain('2xl:flex-row');
  });
});
