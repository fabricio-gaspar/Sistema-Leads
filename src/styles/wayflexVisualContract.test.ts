import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('WayFlex visual contract', () => {
  it('declares shared geometry, elevation, and focus tokens', () => {
    expect(css).toContain('--wf-radius-control: .5rem');
    expect(css).toContain('--wf-radius-surface: .75rem');
    expect(css).toContain('--wf-shadow-surface:');
    expect(css).toContain('--wf-focus-ring:');
  });

  it('uses explicit transitions for the shared interactive primitives', () => {
    expect(css).toMatch(/\.wf-btn-primary[\s\S]*transition-property:/);
    expect(css).toMatch(/\.wf-btn-secondary[\s\S]*transition-property:/);
    expect(css).toMatch(/\.wf-icon-button[\s\S]*transition-property:/);
  });
});
