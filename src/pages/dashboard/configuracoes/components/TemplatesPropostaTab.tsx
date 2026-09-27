import { useState } from 'react';
import { useTemplatesPropostaStore, type BlocoProposta, type TemplateProposta } from '@/hooks/useTemplatesPropostaStore';

interface FormState {
  nome: string;
  descricao: string;
  validadePadraoDias: number;
  formaPagamento: string;
  garantia: string;
  termos: string;
  blocos: BlocoProposta[];
  padrao: boolean;
}

const formVazio = (): FormState => ({
  nome: '',
  descricao: '',
  validadePadraoDias: 0,
  formaPagamento: '',
  garantia: '',
  termos: '',
  blocos: [],
  padrao: false,
});

const inputClass = 'w-full rounded-xl border border-background-200 bg-background-100 px-3.5 py-2.5 text-xs text-foreground-950 placeholder:text-foreground-400 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20';

export default function TemplatesPropostaTab() {
  const { templates, loading, saving, error, atualizar, adicionar, duplicar, excluir, definirPadrao, recarregar } = useTemplatesPropostaStore();
  const [toast, setToast] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<TemplateProposta | null>(null);
  const [form, setForm] = useState<FormState>(formVazio());

  const mostrarToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  };

  const executar = async (action: () => Promise<void>, success: string) => {
    try {
      await action();
      mostrarToast(success);
      return true;
    } catch {
      mostrarToast('Não foi possível salvar. Revise sua conexão e tente novamente.');
      return false;
    }
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm(formVazio());
    setModalAberto(true);
  };

  const abrirEdicao = (template: TemplateProposta) => {
    setEditando(template);
    setForm({
      nome: template.nome,
      descricao: template.descricao,
      validadePadraoDias: template.validadePadraoDias,
      formaPagamento: template.formaPagamento,
      garantia: template.garantia,
      termos: template.termos,
      blocos: template.blocos.map((block) => ({ ...block })),
      padrao: template.padrao,
    });
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.nome.trim()) {
      mostrarToast('Informe um nome para o template.');
      return;
    }
    const base = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      validadePadraoDias: Math.max(0, Number(form.validadePadraoDias) || 0),
      formaPagamento: form.formaPagamento.trim(),
      garantia: form.garantia.trim(),
      termos: form.termos.trim(),
      blocos: form.blocos
        .map((block) => ({ ...block, titulo: block.titulo.trim(), texto: block.texto.trim() }))
        .filter((block) => block.titulo || block.texto),
      padrao: form.padrao,
    };
    const ok = editando
      ? await executar(() => atualizar(editando.id, base), 'Template atualizado e salvo no sistema.')
      : await executar(() => adicionar({ id: crypto.randomUUID(), ...base, ativo: true }), 'Template criado e salvo no sistema.');
    if (ok) setModalAberto(false);
  };

  const addBloco = () => setForm((current) => ({
    ...current,
    blocos: [...current.blocos, { id: crypto.randomUUID(), titulo: '', texto: '' }],
  }));

  const editarBloco = (id: string, change: Partial<BlocoProposta>) => setForm((current) => ({
    ...current,
    blocos: current.blocos.map((block) => block.id === id ? { ...block, ...change } : block),
  }));

  const removerBloco = (id: string) => setForm((current) => ({
    ...current,
    blocos: current.blocos.filter((block) => block.id !== id),
  }));

  return (
    <div className="space-y-5">
      {(toast || error) && (
        <div className={`rounded-xl border px-4 py-3 text-xs ${error ? 'border-[#BD3D32]/25 bg-[#BD3D32]/10 text-[#BD3D32]' : 'border-[#168654]/25 bg-[#168654]/10 text-[#116B43]'}`}>
          <i className={`${error ? 'ri-error-warning-line' : 'ri-checkbox-circle-line'} mr-2`} aria-hidden="true" />
          {toast || error}
        </div>
      )}

      <section className="rounded-2xl border border-[#E3E7ED] bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-tight text-[#14151A]">Templates de orçamento</p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[#69717D]">
              Estruturas industriais reutilizáveis. Os exemplos não afirmam preço, prazo, pagamento,
              garantia ou certificação: esses campos permanecem em branco até validação humana.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={loading || saving} onClick={() => void recarregar()} className="rounded-xl border border-[#E3E7ED] bg-[#F2F4F8] px-3 py-2 text-xs font-semibold text-[#14151A] transition hover:bg-[#E3E7ED] disabled:opacity-50">
              <i className="ri-refresh-line mr-1.5" aria-hidden="true" />Atualizar
            </button>
        <button type="button" disabled={loading || saving} onClick={abrirNovo} className="rounded-xl bg-primary-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 active:scale-[0.98] disabled:opacity-50">
              <i className="ri-add-line mr-1.5" aria-hidden="true" />Novo template
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E3E7ED] bg-white shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-12 text-xs text-[#69717D]">
            <i className="ri-loader-4-line animate-spin" aria-hidden="true" />Carregando templates do banco…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E3E7ED] bg-[#F7F8FA] font-mono text-[11px] uppercase text-[#777E89]">
                <tr>
                  <th className="px-5 py-3 font-medium">Modelo</th>
                  <th className="px-5 py-3 font-medium">Validade</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Blocos</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="border-b border-[#E3E7ED] transition last:border-0 hover:bg-[#F2F4F8]/70">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-[#14151A]">{template.nome}</p>
                      <p className="mt-0.5 max-w-md text-[11px] leading-4 text-[#69717D]">{template.descricao || 'Sem descrição.'}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[#69717D]">{template.validadePadraoDias > 0 ? `${template.validadePadraoDias} dias` : 'Definir ao usar'}</td>
                    <td className="hidden px-5 py-3.5 text-[#69717D] md:table-cell">{template.blocos.length}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {template.padrao && <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 font-mono text-[10px] text-primary-800">PADRÃO</span>}
                        <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${template.ativo ? 'border-[#168654]/25 bg-[#168654]/10 text-[#116B43]' : 'border-[#E3E7ED] bg-[#F2F4F8] text-[#777E89]'}`}>{template.ativo ? 'ATIVO' : 'INATIVO'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        {!template.padrao && <button type="button" disabled={saving} onClick={() => void executar(() => definirPadrao(template.id), `“${template.nome}” definido como padrão.`)} className="h-8 rounded-lg px-2 text-foreground-500 transition hover:bg-white hover:text-primary-700" title="Definir como padrão"><i className="ri-star-line" /></button>}
                      <button type="button" disabled={saving} onClick={() => void executar(() => atualizar(template.id, { ativo: !template.ativo }), `Template ${template.ativo ? 'desativado' : 'ativado'}.`)} className="h-8 rounded-lg px-2 text-foreground-500 transition hover:bg-white hover:text-primary-700" title={template.ativo ? 'Desativar' : 'Ativar'}><i className={template.ativo ? 'ri-pause-circle-line' : 'ri-play-circle-line'} /></button>
                      <button type="button" disabled={saving} onClick={() => abrirEdicao(template)} className="h-8 rounded-lg px-2 text-foreground-500 transition hover:bg-white hover:text-primary-700" title="Editar"><i className="ri-edit-line" /></button>
                      <button type="button" disabled={saving} onClick={() => void executar(() => duplicar(template.id), 'Template duplicado e salvo.')} className="h-8 rounded-lg px-2 text-foreground-500 transition hover:bg-white hover:text-primary-700" title="Duplicar"><i className="ri-file-copy-line" /></button>
                        <button type="button" disabled={saving} onClick={() => {
                          if (window.confirm(`Excluir o template “${template.nome}”?`)) void executar(() => excluir(template.id), 'Template excluído.');
                        }} className="h-8 rounded-lg px-2 text-[#69717D] transition hover:bg-[#BD3D32]/10 hover:text-[#BD3D32]" title="Excluir"><i className="ri-delete-bin-6-line" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-xs text-[#777E89]">Nenhum template cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14151A]/40 p-4" onClick={() => !saving && setModalAberto(false)}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#E3E7ED] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E3E7ED] bg-white/95 px-6 py-4 backdrop-blur">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-[#14151A]">{editando ? 'Editar template' : 'Novo template'}</h3>
                <p className="mt-0.5 text-[11px] text-[#69717D]">As alterações serão salvas no banco da empresa ativa.</p>
              </div>
              <button type="button" disabled={saving} onClick={() => setModalAberto(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#69717D] hover:bg-[#F2F4F8]"><i className="ri-close-line text-lg" /></button>
            </header>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px]">
                <label className="text-xs font-medium text-[#14151A]">Nome
                  <input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Ex.: Peça técnica sob medida" className={`${inputClass} mt-1.5`} />
                </label>
                <label className="text-xs font-medium text-[#14151A]">Validade em dias
                  <input type="number" min={0} max={365} value={form.validadePadraoDias} onChange={(event) => setForm({ ...form, validadePadraoDias: Number(event.target.value) })} className={`${inputClass} mt-1.5`} />
                  <span className="mt-1 block text-[10px] font-normal text-[#777E89]">Use 0 para definir em cada orçamento.</span>
                </label>
              </div>
              <label className="block text-xs font-medium text-[#14151A]">Descrição
                <input value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} placeholder="Quando este modelo deve ser usado?" className={`${inputClass} mt-1.5`} />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-xs font-medium text-[#14151A]">Forma de pagamento
                  <input value={form.formaPagamento} onChange={(event) => setForm({ ...form, formaPagamento: event.target.value })} placeholder="Preencher após aprovação humana" className={`${inputClass} mt-1.5`} />
                </label>
                <label className="text-xs font-medium text-[#14151A]">Garantia
                  <input value={form.garantia} onChange={(event) => setForm({ ...form, garantia: event.target.value })} placeholder="Preencher após aprovação humana" className={`${inputClass} mt-1.5`} />
                </label>
              </div>
              <label className="block text-xs font-medium text-[#14151A]">Termos e condições
                <textarea value={form.termos} onChange={(event) => setForm({ ...form, termos: event.target.value })} rows={3} placeholder="Use variáveis como {validade}, {nome} e {empresa}." className={`${inputClass} mt-1.5 resize-y`} />
              </label>

              <div className="rounded-xl border border-[#E3E7ED] bg-[#F7F8FA] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#14151A]">Blocos reutilizáveis</p>
                    <p className="mt-0.5 text-[10px] text-[#777E89]">Adicione somente informações confirmadas.</p>
                  </div>
                  <button type="button" onClick={addBloco} className="rounded-xl border border-[#E3E7ED] bg-white px-3 py-2 text-xs font-semibold text-[#14151A] hover:bg-[#F2F4F8]"><i className="ri-add-line mr-1" />Adicionar bloco</button>
                </div>
                <div className="space-y-3">
                  {form.blocos.map((block) => (
                    <div key={block.id} className="space-y-2 rounded-xl border border-[#E3E7ED] bg-white p-3">
                      <div className="flex gap-2">
                        <input value={block.titulo} onChange={(event) => editarBloco(block.id, { titulo: event.target.value })} placeholder="Título do bloco" className={inputClass} />
                        <button type="button" onClick={() => removerBloco(block.id)} className="h-9 w-9 shrink-0 rounded-lg text-[#BD3D32] hover:bg-[#BD3D32]/10" title="Remover bloco"><i className="ri-delete-bin-6-line" /></button>
                      </div>
                      <textarea value={block.texto} onChange={(event) => editarBloco(block.id, { texto: event.target.value })} rows={2} placeholder="Conteúdo confirmado" className={`${inputClass} resize-y`} />
                    </div>
                  ))}
                  {form.blocos.length === 0 && <p className="py-4 text-center text-[11px] text-[#777E89]">Nenhum bloco adicionado.</p>}
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 text-xs text-[#14151A]">
                <input type="checkbox" checked={form.padrao} onChange={(event) => setForm({ ...form, padrao: event.target.checked })} className="accent-primary-600" />
                Usar como template padrão
              </label>
            </div>

            <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-[#E3E7ED] bg-white/95 px-6 py-4 backdrop-blur">
              <button type="button" disabled={saving} onClick={() => setModalAberto(false)} className="rounded-xl border border-[#E3E7ED] bg-[#F2F4F8] px-4 py-2.5 text-xs font-semibold text-[#14151A] hover:bg-[#E3E7ED] disabled:opacity-50">Cancelar</button>
            <button type="button" disabled={saving} onClick={() => void salvar()} className="rounded-xl bg-primary-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar template'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
