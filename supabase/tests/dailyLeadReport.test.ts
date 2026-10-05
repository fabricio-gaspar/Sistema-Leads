import { describe, expect, it } from 'vitest';
import {
  dailyLeadReportStage,
  formatDailyLeadReport,
  maskDailyReportPhone,
  normalizeDailyReportPhone,
  validDailyReportTime,
} from '../functions/_shared/dailyLeadReport';

describe('daily lead report contracts', () => {
  it('normalizes a Brazilian recipient to the provider format and masks it for the UI', () => {
    expect(normalizeDailyReportPhone('(11) 99744-1875')).toBe('5511997441875');
    expect(maskDailyReportPhone('(11) 99744-1875')).toBe('••••1875');
    expect(normalizeDailyReportPhone('not-a-phone')).toBeNull();
  });

  it('keeps the daily report schedule bounded to a valid local clock time', () => {
    expect(validDailyReportTime('18:00:00')).toBe('18:00');
    expect(validDailyReportTime('24:00')).toBeNull();
  });

  it('reports canonical stages without including lead names or contact numbers', () => {
    expect(dailyLeadReportStage('Em Qualificação')).toBe('Qualificando');
    const report = formatDailyLeadReport({
      dateLabel: '17/09',
      totalLeads: 4,
      newLeads: 1,
      interactionsToday: 2,
      noInteraction: 1,
      stages: { Novo: 1, Apresentado: 1, Qualificando: 1, Reunião: 0, Orçamento: 1, Ganho: 0, Perdido: 0 },
    });
    expect(report).toContain('Funil: Novo 1 · Apresentado 1 · Qualificando 1');
    expect(report).not.toContain('11997441875');
  });
});
