import { useState } from 'react';
import { camposDisponiveis } from '@/lib/promptBusca';
import {
  useBibliotecaPromptsStore,
  PRESETS_PROMPT,
  type BibliotecaPrompt,
} from '@/hooks/useBibliotecaPromptsStore';

export default function BibliotecaPromptsTab() {
  const { prompts, atualizar, adicionar, excluir } = useBibliotecaPromptsStore();
  const [toast, setToast] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<BibliotecaPrompt | null>(null);
  const [form, setForm] = useState({
    titulo: '',
    objetivo: '',
    criterios: '',
    campos: [] as string[],
    preset: 'Prospecção',
  });

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const toggleCampo = (id: string) => {
    setForm((prev) => ({
      ...prev,
      campos: prev.campos.includes(id) ? prev.campos.filter((c) => c !== id) : [...prev.campos, id],
    }));
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm({ titulo: '', objetivo: '', criterios: '', campos: [], preset: 'Prospecção' });
    setModalAberto(true);
  };

  const abrirEdicao = (p: BibliotecaPrompt) => {
    setEditando(p);
    setForm({
      titulo: p.titulo,
      objetivo: p.objetivo,
      criterios: p.criterios,
      campos: p.campos,
      preset: p.preset,
    });
    setModalAberto(true);
  };

  const salvar = () => {
    if (!form.titulo.trim() || !form.criterios.trim()) {
      mostrarToast('Preencha o título e os critérios do prompt.');
      return;
    }
    if (editando) {
      atualizar(editando.id, {
        titulo: form.titulo.trim(),
        objetivo: form.objetivo.trim(),
        criterios: form.criterios.trim(),
        campos: form.campos,
        preset: form.preset,
      });
      mostrarToast('Prompt atualizado.');
    } else {
      adicionar({
        id: `bp-${Date.now()}`,
        titulo: form.titulo.trim(),
        objetivo: form.objetivo.trim(),
        criterios: form.criterios.trim(),
        campos: form.campos,
        preset: form.preset,
        ativo: true,
      });
      mostrarToast('Prompt criado.');
    }
    setModalAberto(false);
  };

  const toggleAtivo = (p: BibliotecaPrompt) => {
    atualizar(p.id, { ativo: !p.ativo });
  };

  const excluirPrompt = (p: BibliotecaPrompt) => {
    excluir(p.id);
    mostrarToast(`Prompt "${p.titulo}" excluído.`);
  };

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
          <i className="ri-sparkling-2-line"></i>
          Biblioteca de prompts do Agente
        </p>
        <p className="mt-1.5 text-primary-700 leading-relaxed">
          Esses prompts alimentam o gerador em Busca de Leads. Prompts desativados não aparecem lá.
          Você também pode favoritar e reutilizar os últimos usados direto na tela de geração.
        </p>
      </div>

      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Prompts</h3>
            <p className="text-xs text-foreground-500">Modelos editáveis de busca, qualificação, atendimento e follow-up.</p>
          </div>
          <button
            onClick={abrirNovo}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            Novo prompt
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Título</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Preset</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Campos</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Ativo</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs w-24"></th>
              </tr>
            </thead>
            <tbody>
              {prompts.map((p) => (
                <tr key={p.id} className="border-b border-background-100 hover:bg-background-50/50">
                  <td className="px-6 py-3.5">
                    <p className="font-medium text-foreground-900">{p.titulo}</p>
                    <p className="text-xs text-foreground-500 max-w-sm">{p.objetivo}</p>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="inline-block px-2.5 py-1 rounded-md text-xs font-medium bg-secondary-100 text-secondary-800">
                      {p.preset}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell">
                    <span className="text-xs">{p.campos.length} campos</span>
                  </td>
                  <td className="px-6 py-3.5">
                    <button
                      onClick={() => toggleAtivo(p)}
                      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${p.ativo ? 'bg-primary-500' : 'bg-background-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${p.ativo ? 'translate-x-5' : ''}`}></span>
                    </button>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => abrirEdicao(p)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer"
                        title="Editar"
                      >
                        <i className="ri-edit-line"></i>
                      </button>
                      <button
                        onClick={() => excluirPrompt(p)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-accent-50 text-accent-600 cursor-pointer"
                        title="Excluir"
                      >
                        <i className="ri-delete-bin-6-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {prompts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-foreground-400 text-sm">
                    Nenhum prompt cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setModalAberto(false)}>
          <div className="bg-background-50 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">{editando ? 'Editar prompt' : 'Novo prompt'}</h3>
              <button onClick={() => setModalAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Título</label>
                <input type="text" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="ex.: Prospecção local B2B" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Objetivo (descrição curta)</label>
                <input type="text" value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} placeholder="ex.: Empresas de um segmento numa cidade" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Critérios / instruções</label>
                <textarea value={form.criterios} onChange={(e) => setForm({ ...form, criterios: e.target.value })} rows={4} placeholder="Descreva os critérios da busca..." className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Preset</label>
                <select value={form.preset} onChange={(e) => setForm({ ...form, preset: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  {PRESETS_PROMPT.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Campos a retornar</label>
                <div className="flex flex-wrap gap-2">
                  {camposDisponiveis.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => toggleCampo(c.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                        form.campos.includes(c.id)
                          ? 'bg-primary-500 text-background-50'
                          : 'bg-background-100 text-foreground-600 hover:bg-background-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setModalAberto(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={salvar} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">
                {editando ? 'Salvar' : 'Criar prompt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
