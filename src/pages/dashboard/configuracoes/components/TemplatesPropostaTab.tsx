import { useState } from 'react';
import { useTemplatesPropostaStore, type TemplateProposta, type BlocoProposta } from '@/hooks/useTemplatesPropostaStore';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';
import { useVariaveisGlobaisStore } from '@/hooks/useVariaveisGlobaisStore';
import { montarValoresVariaveis, resolverVariaveis } from '@/lib/variaveis';
import AutocompleteTextarea from '@/components/feature/AutocompleteTextarea';

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
  validadePadraoDias: 15,
  formaPagamento: '',
  garantia: '',
  termos: '',
  blocos: [],
  padrao: false,
});

export default function TemplatesPropostaTab() {
  const { templates, atualizar, adicionar, excluir, definirPadrao } = useTemplatesPropostaStore();
  const { settings: { organizacao } } = useEmpresaSettingsStore();
  const { variaveis } = useVariaveisGlobaisStore();
  const [toast, setToast] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<TemplateProposta | null>(null);
  const [form, setForm] = useState<FormState>(formVazio());

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm(formVazio());
    setModalAberto(true);
  };

  const abrirEdicao = (t: TemplateProposta) => {
    setEditando(t);
    setForm({
      nome: t.nome,
      descricao: t.descricao,
      validadePadraoDias: t.validadePadraoDias,
      formaPagamento: t.formaPagamento,
      garantia: t.garantia,
      termos: t.termos,
      blocos: t.blocos,
      padrao: t.padrao,
    });
    setModalAberto(true);
  };

  const salvar = () => {
    if (!form.nome.trim()) {
      mostrarToast('Dê um nome ao template.');
      return;
    }
    const base = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      validadePadraoDias: Math.max(1, Number(form.validadePadraoDias) || 15),
      formaPagamento: form.formaPagamento.trim(),
      garantia: form.garantia.trim(),
      termos: form.termos.trim(),
      blocos: form.blocos,
      padrao: form.padrao,
    };
    if (editando) {
      atualizar(editando.id, base);
      mostrarToast('Template atualizado.');
    } else {
      adicionar({ id: `tp-${Date.now()}`, ...base, ativo: true });
      mostrarToast('Template criado.');
    }
    setModalAberto(false);
  };

  const toggleAtivo = (t: TemplateProposta) => {
    atualizar(t.id, { ativo: !t.ativo });
  };

  const excluirTemplate = (t: TemplateProposta) => {
    excluir(t.id);
    mostrarToast(`Template "${t.nome}" excluído.`);
  };

  const addBloco = () => {
    setForm((prev) => ({
      ...prev,
      blocos: [...prev.blocos, { id: `bl-${Date.now()}`, titulo: '', texto: '' }],
    }));
  };

  const editarBloco = (id: string, mudanca: Partial<BlocoProposta>) => {
    setForm((prev) => ({
      ...prev,
      blocos: prev.blocos.map((b) => (b.id === id ? { ...b, ...mudanca } : b)),
    }));
  };

  const removerBloco = (id: string) => {
    setForm((prev) => ({ ...prev, blocos: prev.blocos.filter((b) => b.id !== id) }));
  };

  // Pré-visualização com lead de teste + dados da empresa + variáveis globais.
  const valores = montarValoresVariaveis({
    lead: { nome: 'Carlos Mendes', empresa: 'Tech Solutions Ltda' },
    organizacao,
    customVars: variaveis,
  });
  valores.validade = '30/09/2026';
  valores.forma_pagamento = form.formaPagamento || '—';
  valores.garantia = form.garantia || '—';
  const previaTermos = resolverVariaveis(form.termos || 'Nenhum termo definido.', valores);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-sm">
        <p className="font-semibold text-primary-800 flex items-center gap-2">
          <i className="ri-file-text-line"></i>
          Templates de proposta / orçamento
        </p>
        <p className="mt-1.5 text-primary-700 leading-relaxed">
          Estruturas prontas de orçamento com validade, forma de pagamento, garantia, termos e blocos
          reutilizáveis. Ao gerar uma proposta em Orçamentos, você escolhe o template — a Ana usa o
          marcado como <b>padrão</b>. Variáveis como <code className="bg-background-50 border border-primary-200 px-1.5 py-0.5 rounded text-xs font-mono">{'{validade}'}</code> são resolvidas automaticamente.
        </p>
      </div>

      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Templates</h3>
            <p className="text-xs text-foreground-500">Modelos de orçamento reutilizáveis.</p>
          </div>
          <button
            onClick={abrirNovo}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            Novo template
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Nome</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Validade</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Blocos</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Padrão</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Ativo</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs w-28"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-background-100 hover:bg-background-50/50">
                  <td className="px-6 py-3.5">
                    <p className="font-medium text-foreground-900">{t.nome}</p>
                    <p className="text-xs text-foreground-500 max-w-sm">{t.descricao}</p>
                  </td>
                  <td className="px-6 py-3.5 text-foreground-600">{t.validadePadraoDias} dias</td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell">{t.blocos.length} blocos</td>
                  <td className="px-6 py-3.5">
                    <button
                      onClick={() => { definirPadrao(t.id); mostrarToast(`"${t.nome}" agora é o padrão.`); }}
                      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${t.padrao ? 'bg-secondary-500' : 'bg-background-300'}`}
                      title="Definir como padrão"
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${t.padrao ? 'translate-x-5' : ''}`}></span>
                    </button>
                  </td>
                  <td className="px-6 py-3.5">
                    <button
                      onClick={() => toggleAtivo(t)}
                      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${t.ativo ? 'bg-primary-500' : 'bg-background-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${t.ativo ? 'translate-x-5' : ''}`}></span>
                    </button>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => abrirEdicao(t)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer"
                        title="Editar"
                      >
                        <i className="ri-edit-line"></i>
                      </button>
                      <button
                        onClick={() => excluirTemplate(t)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-accent-50 text-accent-600 cursor-pointer"
                        title="Excluir"
                      >
                        <i className="ri-delete-bin-6-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-foreground-400 text-sm">
                    Nenhum template de proposta ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setModalAberto(false)}>
          <div className="bg-background-50 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between sticky top-0 bg-background-50 z-10">
              <h3 className="font-heading font-bold text-foreground-950">{editando ? 'Editar template' : 'Novo template'}</h3>
              <button onClick={() => setModalAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome</label>
                  <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="ex.: Projeto sob medida" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Validade padrão (dias)</label>
                  <input type="number" min={1} max={365} value={form.validadePadraoDias} onChange={(e) => setForm({ ...form, validadePadraoDias: Number(e.target.value) })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Descrição</label>
                <input type="text" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Para que serve este template?" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Forma de pagamento</label>
                <input type="text" value={form.formaPagamento} onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })} placeholder="ex.: 50% na assinatura e 50% na entrega" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Garantia</label>
                <input type="text" value={form.garantia} onChange={(e) => setForm({ ...form, garantia: e.target.value })} placeholder="ex.: Garantia de 90 dias sobre as entregas" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Termos e condições</label>
                <AutocompleteTextarea
                  value={form.termos}
                  onChange={(v) => setForm({ ...form, termos: v })}
                  rows={3}
                  tipo="proposta"
                  placeholder="Use {validade}, {nome}, {empresa}... (ou complete com IA)"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground-800">Blocos reutilizáveis</label>
                  <button onClick={addBloco} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary-500 hover:bg-secondary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap">
                    <i className="ri-add-line"></i>
                    Adicionar bloco
                  </button>
                </div>
                <div className="space-y-2">
                  {form.blocos.map((b) => (
                    <div key={b.id} className="bg-background-100 rounded-lg p-3 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={b.titulo}
                          onChange={(e) => editarBloco(b.id, { titulo: e.target.value })}
                          placeholder="Título do bloco"
                          className="flex-1 px-3 py-2 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
                        />
                        <button onClick={() => removerBloco(b.id)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-50 hover:bg-accent-50 text-accent-600 cursor-pointer" title="Remover bloco">
                          <i className="ri-close-line"></i>
                        </button>
                      </div>
                      <textarea
                        value={b.texto}
                        onChange={(e) => editarBloco(b.id, { texto: e.target.value })}
                        rows={2}
                        placeholder="Conteúdo do bloco"
                        className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 resize-none"
                      />
                    </div>
                  ))}
                  {form.blocos.length === 0 && (
                    <p className="text-xs text-foreground-400">Nenhum bloco. Adicione cláusulas, condições ou rodapé.</p>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2.5 text-sm text-foreground-700 cursor-pointer">
                <input type="checkbox" checked={form.padrao} onChange={(e) => setForm({ ...form, padrao: e.target.checked })} className="accent-[oklch(var(--secondary-500))] cursor-pointer" />
                Usar como template padrão
              </label>

              <div className="bg-background-100/70 border border-background-200/70 rounded-lg p-4">
                <p className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-2">Pré-visualização (lead de teste)</p>
                <p className="text-sm text-foreground-800 leading-relaxed whitespace-pre-line">{previaTermos}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setModalAberto(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={salvar} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">
                {editando ? 'Salvar' : 'Criar template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
