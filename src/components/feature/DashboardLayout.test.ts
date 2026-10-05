import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Dashboard seller WhatsApp onboarding', () => {
  it('checks only the authenticated seller account once per session before opening the private QR screen', () => {
    const layout = readFileSync(resolve('src/components/feature/DashboardLayout.tsx'), 'utf8');

    expect(layout).toContain('loadMyEvolutionGoAccount');
    expect(layout).toContain("access?.role === 'vendedor'");
    expect(layout).toContain("['channels.connect_own']");
    expect(layout).toContain('evolutionGoOnboardingSessionKey(user.id)');
    expect(layout).toContain("window.sessionStorage.getItem(sessionKey) === 'shown'");
    expect(layout).toContain("navigate('/dashboard/atendimento', { replace: true })");
  });
});
