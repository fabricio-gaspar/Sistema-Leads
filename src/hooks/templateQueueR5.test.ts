import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { sessionContext } from '@/lib/sessionContext';
import { useTemplatesPropostaStore, type TemplateProposta } from './useTemplatesPropostaStore';
const remote = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock('@/lib/crm/proposalTemplatesRepository', () => ({ loadProposalTemplates: remote.load, saveProposalTemplates: remote.save }));
const template: TemplateProposta = { id: 'template-A', nome: 'Original', descricao: '', validadePadraoDias: 0, formaPagamento: '', garantia: '', termos: '', ativo: true, padrao: true, blocos: [{ id: 'block', titulo: 'Original', texto: '' }] };
let hook: ReturnType<typeof useTemplatesPropostaStore>;
const render = () => { function Harness() { hook = useTemplatesPropostaStore(); return null; } renderToString(createElement(Harness)); };
beforeEach(async () => {
  vi.resetAllMocks(); sessionContext.confirm(sessionContext.replace('A'), 'A', 'org-A');
  remote.load.mockResolvedValue([structuredClone(template)]); remote.save.mockResolvedValue(undefined); render(); await hook.recarregar(); render();
});
it('T-R5-038: actual template adapter applies queued partial updates to the acknowledged predecessor', async () => {
  let finish!: () => void; remote.save.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const first = hook.atualizar(template.id, { nome: 'Renamed' });
  const second = hook.atualizar(template.id, { descricao: 'New description' });
  for (let i = 0; i < 5; i++) await Promise.resolve(); expect(remote.save).toHaveBeenCalledTimes(1);
  finish(); await first; await second;
  expect(remote.save.mock.calls[1][0][0]).toMatchObject({ nome: 'Renamed', descricao: 'New description' });
  render(); expect(hook.templates[0]).toMatchObject({ nome: 'Renamed', descricao: 'New description' });
});
it('T-R5-039: a removed template cannot be selected as default by an already queued callback', async () => {
  let finish!: () => void; remote.save.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const removing = hook.excluir(template.id); const selecting = hook.definirPadrao(template.id);
  const rejected = expect(selecting).rejects.toThrow('proposal_template_not_available');
  for (let i = 0; i < 5; i++) await Promise.resolve(); finish(); await removing; await rejected;
  expect(remote.save).toHaveBeenCalledTimes(1);
});
