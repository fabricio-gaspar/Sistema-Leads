import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Dashboard personal WhatsApp pairing', () => {
  it('checks only the authenticated user account once per session before opening the unified Central', () => {
    const layout = readFileSync(resolve('src/components/feature/DashboardLayout.tsx'), 'utf8');

    expect(layout).toContain('loadMyEvolutionGoAccount');
    expect(layout).toContain('evolutionGoSellerNeedsPairing(status)');
    expect(layout).not.toContain("access?.role === 'vendedor'");
    expect(layout).toContain("['channels.connect_own']");
    expect(layout).toContain('evolutionGoOnboardingSessionKey(user.id)');
    expect(layout).toContain("window.sessionStorage.getItem(sessionKey) === 'shown'");
    expect(layout).toContain("navigate('/dashboard/atendimento', { replace: true })");
    expect(layout).not.toContain('evolutionGoSellerNeedsOnboarding');
  });

  it('keeps the unified Central discoverable through the same own-account permissions', () => {
    const layout = readFileSync(resolve('src/components/feature/DashboardLayout.tsx'), 'utf8');

    expect(layout).toContain("{ label: 'Central de Atendimento', path: '/dashboard/atendimento'");
    expect(layout).toContain("'channels.view_own', 'channels.connect_own'");
    expect(layout).not.toContain("{ label: 'Meu WhatsApp', path: '/dashboard/meu-whatsapp'");
  });

  it('sends the Dashboard WhatsApp shortcut to the personal route without relying on a role name', () => {
    const dashboard = readFileSync(resolve('src/pages/dashboard/page.tsx'), 'utf8');

    expect(dashboard).toContain("const canUseOwnWhatsapp = hasAnyPermission(access, ['channels.view_own', 'channels.connect_own']);");
    expect(dashboard).toContain("const whatsappWorkspaceLink = canUseOwnWhatsapp ? '/dashboard/meu-whatsapp'");
    expect(dashboard).not.toContain("access?.role === 'vendedor'");
  });
});

describe('Dashboard navigation shell', () => {
  it('keeps the canonical page context independent from the screen filter', () => {
    const layout = readFileSync(resolve('src/components/feature/DashboardLayout.tsx'), 'utf8');

    expect(layout).toContain("const currentPage = navItems.find((item) => item.path === location.pathname) ?? navItems[0];");
    expect(layout).toContain('className="wf-global-search relative hidden min-w-[15rem] lg:block"');
    expect(layout).toContain('className="wf-global-search-results"');
    expect(layout).toContain('Nenhuma tela encontrada.');
  });

  it('preserves the existing navigation taxonomy while changing only its presentation', () => {
    const layout = readFileSync(resolve('src/components/feature/DashboardLayout.tsx'), 'utf8');

    expect(layout).toContain("title: 'Atendimento'");
    expect(layout).toContain("{ label: 'Agenda', path: '/dashboard/agenda'");
    expect(layout).toContain("title: 'Comercial'");
    expect(layout).not.toContain("title: 'Conversão'");
  });

  it('keeps Configurações on its compact selector before the two sidebars can compete for width', () => {
    const settings = readFileSync(resolve('src/pages/dashboard/configuracoes/page.tsx'), 'utf8');

    expect(settings).toContain('2xl:flex-row');
    expect(settings).toContain('2xl:block');
    expect(settings).toContain('className="2xl:hidden"');
  });
});
