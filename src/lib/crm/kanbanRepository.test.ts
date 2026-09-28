import { describe, expect, it } from 'vitest';
import {
  initialKanbanPortfolioFilters,
  kanbanPortfolioRequestPayload,
  mapKanbanPortfolioResponse,
} from './kanbanRepository';

describe('kanban operational portfolio contract', () => {
  it('serializes the URL-backed filters for the one server-side query', () => {
    const request = kanbanPortfolioRequestPayload({
      ...initialKanbanPortfolioFilters,
      query: '  São Paulo  ',
      ownerId: 'owner-1',
      scoreMin: '80',
      contact: 'whatsapp',
      nextAction: 'overdue',
      duplicatesOnly: true,
      showClosed: true,
      sort: 'fit',
    });

    expect(request).toMatchObject({
      query: 'São Paulo', owner_id: 'owner-1', score_min: '80', contact: 'whatsapp',
      next_action: 'overdue', duplicates: true, show_closed: true, sort: 'fit',
    });
    expect(request.origin).toBeNull();
  });

  it('normalizes counters and preserves only real portfolio fields from the RPC', () => {
    const portfolio = mapKanbanPortfolioResponse({
      total: 1.9,
      stage_counts: { apresentado: 1.8, reuniao: -4 },
      quick_counts: { high_fit: 1.7, overdue: -1 },
    });

    expect(portfolio.items).toEqual([]);
    expect(portfolio.total).toBe(1);
    expect(portfolio.stageCounts.apresentado).toBe(1);
    expect(portfolio.stageCounts.reuniao).toBe(0);
    expect(portfolio.quickCounts.high_fit).toBe(1);
    expect(portfolio.quickCounts.overdue).toBe(0);
  });
});
