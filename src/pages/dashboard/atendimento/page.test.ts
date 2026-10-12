import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Central de Atendimento WhatsApp entry', () => {
  it('uses one Central entry while keeping connection-only sellers outside the inbox', () => {
    const page = readFileSync(resolve('src/pages/dashboard/atendimento/page.tsx'), 'utf8');
    const entry = readFileSync(resolve('src/pages/dashboard/atendimento/AtendimentoEntry.tsx'), 'utf8');
    const layout = readFileSync(resolve('src/components/feature/DashboardLayout.tsx'), 'utf8');
    const router = readFileSync(resolve('src/router/config.tsx'), 'utf8');

    expect(page).toContain("import WaAkgPanel from '@/components/feature/WaAkgPanel'");
    expect(page).toContain('<WaAkgPanel mode="self-service" surface="central" />');
    expect(entry).toContain('hasAnyPermission(access, conversationPermissions)');
    expect(entry).toContain('<Atendimento />');
    expect(entry).toContain('<WaAkgPanel mode="self-service" surface="central" />');
    expect(layout).not.toContain("{ label: 'Meu WhatsApp'");
    expect(layout).toContain("navigate('/dashboard/atendimento', { replace: true })");
    expect(router).toContain('<AtendimentoEntry />');
    expect(router).toContain('channels.connect_own');
  });

  it('permite enviar produto selecionado ou preparar o produto por arrastar e soltar', () => {
    const page = readFileSync(resolve('src/pages/dashboard/atendimento/page.tsx'), 'utf8');
    const panel = readFileSync(resolve('src/pages/dashboard/atendimento/components/ConversationKnowledgePanel.tsx'), 'utf8');
    const drag = readFileSync(resolve('src/pages/dashboard/atendimento/components/knowledgeDrag.ts'), 'utf8');

    expect(panel).toContain('Enviar produto agora');
    expect(panel).toContain('draggable={item.type === \'product\'}');
    expect(panel).toContain('onSend={onSend');
    expect(drag).toContain('application/x-wayflex-knowledge');
    expect(page).toContain('onDrop={dropKnowledge}');
    expect(page).toContain('onSendKnowledge');
    expect(page).toContain('send({ knowledge: prepared, text: prepared.text, internal: false, proposal: null })');
  });

  it('keeps the conversation fresh when realtime is delayed or the tab returns', () => {
    const page = readFileSync(resolve('src/pages/dashboard/atendimento/page.tsx'), 'utf8');

    expect(page).toContain("realtime === 'live' ? 15_000 : 10_000");
    expect(page).toContain("document.addEventListener('visibilitychange'");
    expect(page).toContain("window.addEventListener('pageshow'");
  });
});
