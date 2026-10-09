import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('Kanban visual contract', () => {
  it('uses the shared toolbar and declares the board as horizontally scrollable', () => {
    expect(source).toContain('wf-surface wf-kanban-toolbar');
    expect(source).toMatch(/wf-kanban-board[^"']*overflow-x-auto/);
  });
});
