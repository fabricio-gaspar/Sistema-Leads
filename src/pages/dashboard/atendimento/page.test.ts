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

  it('prioritizes the conversation and leaves channel and agenda tools compact until needed', () => {
    const page = readFileSync(resolve('src/pages/dashboard/atendimento/page.tsx'), 'utf8');
    const panel = readFileSync(resolve('src/components/feature/WaAkgPanel.tsx'), 'utf8');
    const directory = readFileSync(resolve('src/pages/dashboard/atendimento/components/WaAkgContactDirectory.tsx'), 'utf8');
    const styles = readFileSync(resolve('src/components/feature/wayflex-redesign.css'), 'utf8');

    expect(styles).toContain('grid-template-columns:18rem minmax(0,1fr) !important');
    expect(styles).toContain('grid-template-columns:18rem minmax(480px,1fr) 19rem !important');
    expect(styles).toContain('position:relative');
    expect(styles).toContain('height:max(620px,calc(100dvh - 14rem)) !important');
    expect(styles).toContain("button[aria-label='Abrir contexto']");
    expect(page).toContain('Abrir contexto');
    expect(page).toContain('aria-controls="central-lead-context"');
    expect(page).toContain('aria-expanded={contextOpen}');
    expect(page).toContain('id="central-lead-context"');
    expect(page).toContain("event.key === 'Escape'");
    expect(page).toContain("setAttribute('aria-label', 'Fechar contexto')");
    expect(panel).toContain('Status do meu canal');
    expect(panel).toContain('Gerenciar conexão');
    expect(panel).toContain('aria-expanded={centralDetailsVisible}');
    expect(panel).toContain('centralChannelState(selected, statusUnconfirmed)');
    expect(panel).toContain('aria-label="Telefone para gerar código de pareamento"');
    expect(panel).toContain('aspect-square w-64 max-w-full object-contain');
    expect(directory).toContain('Agenda do WhatsApp');
    expect(directory).toContain('Mostrar contatos');
    expect(directory).toContain('aria-expanded={expanded}');
    expect(directory).toContain('tabIndex={0}');
    expect(directory).toContain('overflow-x-auto');
  });
});
