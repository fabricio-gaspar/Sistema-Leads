import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('separação entre inteligência comercial e gestão da base', () => {
  it('não exibe exclusão ou gerenciamento de leads dentro do Funil', () => {
    const funnelPage = readFileSync(resolve('src/pages/dashboard/funil/page.tsx'), 'utf8');
    const leadsPage = readFileSync(resolve('src/pages/dashboard/leads/page.tsx'), 'utf8');

    expect(funnelPage).toContain("import FunnelAnalytics from '@/components/feature/FunnelAnalytics'");
    expect(funnelPage).not.toContain('LeadBaseManager');
    expect(funnelPage).not.toContain('Gerenciar base');
    expect(leadsPage).not.toContain('<LeadBaseManager />');
  });
});
