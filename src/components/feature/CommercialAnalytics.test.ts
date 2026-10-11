import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('CommercialAnalytics dashboard focus', () => {
  it('uses four operational KPIs and keeps message activity in the period chart', () => {
    const source = readFileSync('src/components/feature/CommercialAnalytics.tsx', 'utf8');
    const dashboardMetrics = source.match(/const metrics = mode === 'overview' \? \[([\s\S]*?)\] : \[/)?.[1] ?? '';
    const titles = [...dashboardMetrics.matchAll(/title: '([^']+)'/g)].map(([, title]) => title);

    expect(titles).toEqual(['Novos leads', 'Na carteira', 'Orçamentos abertos', 'Conversão']);
    expect(source).toContain("series === 'contacts' ? 'Atividade de contato'");
    expect(source).not.toContain("title: 'Mensagens hoje'");
  });
});
