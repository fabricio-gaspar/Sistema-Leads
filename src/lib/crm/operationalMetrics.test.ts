import { describe, expect, it } from 'vitest';
import { summarizeOperationalSample } from './operationalMetrics';
describe('R11 observed operational sample (no synthetic success)', () => {
  it('returns unknown rather than zero duration/queue age without observations', () => {
    expect(summarizeOperationalSample([],[],'2026-10-05T12:00Z')).toMatchObject({runCount:0,durationCount:0,p95CompletionMs:null,oldestDueSampleMs:null});
  });
  it('measures elapsed completion, not HTTP200 or the heartbeat', () => {
    const result=summarizeOperationalSample([
      {id:'1',status:'completed',created_at:'2026-10-05T12:00:00Z',completed_at:'2026-10-05T12:00:01Z'},
      {id:'2',status:'failed',created_at:'2026-10-05T12:00:00Z',completed_at:'2026-10-05T12:00:05Z'},
      {id:'3',status:'running',created_at:'2026-10-05T12:00:00Z'},
    ],[],'2026-10-05T12:10Z');
    expect(result).toMatchObject({runCount:3,durationCount:2,p95CompletionMs:5000,failedRuns:1});
  });
  it('ignores malformed/reversed dates and future schedules', () => {
    expect(summarizeOperationalSample([{id:'1',created_at:'invalid',completed_at:'2026-10-05T12:00Z'},
      {id:'2',created_at:'2026-10-05T12:01Z',completed_at:'2026-10-05T12:00Z'}],
      [{id:'q',status:'queued',run_at:'2026-10-05T13:00Z'}],'2026-10-05T12:00Z')).toMatchObject({durationCount:0,p95CompletionMs:null,oldestDueSampleMs:null});
  });
  it('reports oldest due job only in the supplied sample, including reconciliation', () => {
    expect(summarizeOperationalSample([], [{id:'a',status:'processed',run_at:'2026-10-01T12:00Z'},
      {id:'b',status:'queued',run_at:'2026-10-05T11:59Z'}, {id:'c',status:'reconciliation_required',run_at:'2026-10-05T11:50Z'}],
      '2026-10-05T12:00Z')).toMatchObject({jobsSampleCount:3,oldestDueSampleMs:600000});
  });
  it('does not fabricate queue age without a valid server observation time', () => {
    expect(summarizeOperationalSample([],[{id:'1',status:'queued',run_at:'2026-10-05T12:00Z'}],'')).toMatchObject({oldestDueSampleMs:null});
  });
});
