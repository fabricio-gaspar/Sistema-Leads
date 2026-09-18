import { describe, expect, it } from 'vitest';
import { handoffStageReached } from '../functions/_shared/handoffPolicy';

describe('handoff policy contracts', () => {
  it('stops Ana exactly at the configured canonical stage or later', () => {
    expect(handoffStageReached('apresentado', 'apresentado')).toBe(true);
    expect(handoffStageReached('orcamento', 'qualificando')).toBe(true);
    expect(handoffStageReached('novo', 'apresentado')).toBe(false);
  });

  it('fails closed for invalid or terminal handoff configurations', () => {
    expect(handoffStageReached('qualificando', 'fechado')).toBe(false);
    expect(handoffStageReached('qualificando', '')).toBe(false);
    expect(handoffStageReached(null, 'qualificando')).toBe(false);
  });
});
