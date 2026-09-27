import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('gestão definitiva da base de leads', () => {
  it('permanece acessível pelo Funil sem criar uma segunda cópia em Leads', () => {
    const funnelPage = readFileSync(resolve('src/pages/dashboard/funil/page.tsx'), 'utf8');
    const leadsPage = readFileSync(resolve('src/pages/dashboard/leads/page.tsx'), 'utf8');

    expect(funnelPage).toContain("import LeadBaseManager from '../leads/components/LeadBaseManager'");
    expect(funnelPage).toContain('href="#gestao-base-leads"');
    expect(funnelPage).toContain('<LeadBaseManager />');
    expect(leadsPage).not.toContain('<LeadBaseManager />');
  });
});
