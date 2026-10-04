import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Meu WhatsApp Evolution GO', () => {
  it('mounts the panel in self-service mode instead of the legacy provider workspace', () => {
    const page = readFileSync(resolve('src/pages/dashboard/meu-whatsapp/page.tsx'), 'utf8');
    const panel = readFileSync(resolve('src/components/feature/EvolutionGoPanel.tsx'), 'utf8');

    expect(page).toContain("import EvolutionGoPanel from '@/components/feature/EvolutionGoPanel'");
    expect(page).toContain('<EvolutionGoPanel mode="self-service" />');
    expect(page).not.toContain('WhatsappChannelsWorkspace');
    expect(panel).toContain('loadMyEvolutionGoAccount');
    expect(panel).toContain("mode === 'self-service'");
    expect(panel).toContain("id={selfService ? 'my-evolution-go-account' : 'evolution-go-configuration'}");
  });
});
