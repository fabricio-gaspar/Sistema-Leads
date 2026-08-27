import { useState } from 'react';
import AutocompleteTextarea from '@/components/feature/AutocompleteTextarea';
import { useRespostasRapidasStore, type RespostaRapida } from '@/hooks/useRespostasRapidasStore';

export default function RespostasRapidasTab() {
  const { respostas, adicionar, atualizar, excluir } = useRespostasRapidasStore();
  const [toast, setToast] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<RespostaRapida | null>(null);
  const [form, setForm] = useState({ atalho: '', texto: '', categoria: '' });

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm({ atalho: '', texto: '', categoria: '' });
    setModalAberto(true);
  };

  const abrirEdicao = (r: RespostaRapida) => {
    setEditando(r);
    setForm({ atalho: r.atalho, texto: r.texto, categoria: r.categoria });
    setModalAberto(true);
  };

  const salvar = () => {
    const atalho = form.atalho.trim().toLowerCase().replace(/\s+/g, '_');
    if (!atalho || !form.texto.trim()) {
      mostrarToast('Preencha o atalho e o texto da resposta.');
      return;
    }
    if (editando) {
      atualizar(editando.id, { atalho, texto: form.texto.trim(), categoria: form.categoria.trim() || 'Geral' });
      mostrarToast('Resposta atualizada.');
    } else {
      adicionar({ id: `rr-${Date.now()}`, atalho, texto: form.texto.trim(), categoria: form.categoria.trim() || 'Geral' });
      mostrarToast('Resposta criada.');
    }
    setModalAberto(false);
  };

  const excluirResposta = (r: RespostaRapida) => {
    excluir(r.id);
    mostrarToast(`Resposta "/${r.atalho}" excluída.`);
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
          <i className="ri-flashlight-line"></i>
          Atalhos no chat
        </p>
        <p className="mt-1.5 text-primary-700 leading-relaxed">
          Na Central de Atendimento, digite <code className="bg-background-50 border border-primary-200 px-1.5 py-0.5 rounded text-xs font-mono">/atalho</code>{' '}
          para inserir a resposta na hora. Você também pode usar variáveis como{' '}
          <code className="bg-background-50 border border-primary-200 px-1.5 py-0.5 rounded text-xs font-mono">{'{nome}'}</code>.
        </p>
      </div>

      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Respostas rápidas</h3>
            <p className="text-xs text-foreground-500">Frases prontas para agilizar o atendimento.</p>
          </div>
          <button
            onClick={abrirNovo}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            Nova resposta
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Atalho</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Texto</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Categoria</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs w-20"></th>
              </tr>
            </thead>
            <tbody>
              {respostas.map((r) => (
                <tr key={r.id} className="border-b border-background-100 hover:bg-background-50/50">
                  <td className="px-6 py-3.5">
                    <span className="inline-block px-2 py-1 rounded-md text-xs font-mono font-semibold bg-accent-100 text-accent-700 whitespace-nowrap">
                      /{r.atalho}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-foreground-700 max-w-md">{r.texto}</td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell">{r.categoria}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => abrirEdicao(r)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer"
                        title="Editar"
                      >
                        <i className="ri-edit-line"></i>
                      </button>
                      <button
                        onClick={() => excluirResposta(r)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-accent-50 text-accent-600 cursor-pointer"
                        title="Excluir"
                      >
                        <i className="ri-delete-bin-6-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {respostas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-foreground-400 text-sm">
                    Nenhuma resposta rápida ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setModalAberto(false)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">{editando ? 'Editar resposta' : 'Nova resposta'}</h3>
              <button onClick={() => setModalAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Atalho</label>
                <input
                  type="text"
                  value={form.atalho}
                  onChange={(e) => setForm({ ...form, atalho: e.target.value })}
                  placeholder="ex.: saudacao"
                  className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
                />
                <p className="text-xs text-foreground-400 mt-1">Será digitado como /atalho no chat.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Texto</label>
                <AutocompleteTextarea
                  value={form.texto}
                  onChange={(v) => setForm({ ...form, texto: v })}
                  rows={3}
                  tipo="mensagem"
                  placeholder="Use {nome} para inserir dados dinâmicos..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Categoria</label>
                <input
                  type="text"
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  placeholder="ex.: Venda"
                  className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setModalAberto(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={salvar} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">
                {editando ? 'Salvar' : 'Criar resposta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}