import { useState } from 'react';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';
import { useVariaveisGlobaisStore, type VariavelGlobal } from '@/hooks/useVariaveisGlobaisStore';
import { VARIAVEIS_EMPRESA } from '@/lib/variaveis';

export default function VariaveisGlobaisTab() {
  const { settings } = useEmpresaSettingsStore();
  const { variaveis, adicionar, atualizar, excluir } = useVariaveisGlobaisStore();
  const [toast, setToast] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<VariavelGlobal | null>(null);
  const [form, setForm] = useState({ chave: '', valor: '', descricao: '' });

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm({ chave: '', valor: '', descricao: '' });
    setModalAberto(true);
  };

  const abrirEdicao = (v: VariavelGlobal) => {
    setEditando(v);
    setForm({ chave: v.chave, valor: v.valor, descricao: v.descricao });
    setModalAberto(true);
  };

  const salvar = () => {
    const chave = form.chave.trim().toLowerCase().replace(/\s+/g, '_');
    if (!chave || !form.valor.trim()) {
      mostrarToast('Preencha a chave e o valor da variável.');
      return;
    }
    if (editando) {
      atualizar(editando.id, { chave, valor: form.valor.trim(), descricao: form.descricao.trim() });
      mostrarToast('Variável atualizada.');
    } else {
      adicionar({ id: `vg-${Date.now()}`, chave, valor: form.valor.trim(), descricao: form.descricao.trim() });
      mostrarToast('Variável criada.');
    }
    setModalAberto(false);
  };

  const excluirVariavel = (v: VariavelGlobal) => {
    excluir(v.id);
    mostrarToast(`Variável "{${v.chave}}" excluída.`);
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
          <i className="ri-lightbulb-line"></i>
          Como usar
        </p>
        <p className="mt-1.5 text-primary-700 leading-relaxed">
          Use <code className="bg-background-50 border border-primary-200 px-1.5 py-0.5 rounded text-xs font-mono">{'{empresa_nome}'}</code>,{' '}
          <code className="bg-background-50 border border-primary-200 px-1.5 py-0.5 rounded text-xs font-mono">{'{assinatura}'}</code> ou qualquer
          chave personalizada dentro de templates, respostas rápidas, propostas e e-mails. O sistema troca automaticamente pelo valor real.
        </p>
      </div>

      {/* Variáveis da empresa (fixas) */}
      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70">
          <h3 className="font-heading font-bold text-foreground-900 text-sm">Variáveis da empresa</h3>
          <p className="text-xs text-foreground-500">Preenchidas uma única vez em Empresa → Dados da organização.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2">
          {VARIAVEIS_EMPRESA.map((v) => {
            const valor = settings.organizacao[v.campo];
            const texto = typeof valor === 'string' && valor ? valor : '—';
            return (
              <div
                key={v.chave}
                className="px-6 py-3.5 border-b border-background-100 md:odd:border-r flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground-900">{v.rotulo}</p>
                  <p className="text-xs text-foreground-500 font-mono">{'{'}{v.chave}{'}'}</p>
                </div>
                <p className="text-sm text-foreground-700 truncate max-w-[180px]" title={texto}>{texto}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Variáveis personalizadas */}
      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Variáveis personalizadas</h3>
            <p className="text-xs text-foreground-500">Chaves próprias para reutilizar em qualquer mensagem.</p>
          </div>
          <button
            onClick={abrirNovo}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            Nova variável
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Chave</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Valor</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Descrição</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs w-20"></th>
              </tr>
            </thead>
            <tbody>
              {variaveis.map((v) => (
                <tr key={v.id} className="border-b border-background-100 hover:bg-background-50/50">
                  <td className="px-6 py-3.5">
                    <span className="inline-block px-2 py-1 rounded-md text-xs font-mono font-medium bg-secondary-100 text-secondary-800">
                      {'{'}{v.chave}{'}'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-foreground-700">{v.valor}</td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell">{v.descricao || '—'}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => abrirEdicao(v)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer"
                        title="Editar"
                      >
                        <i className="ri-edit-line"></i>
                      </button>
                      <button
                        onClick={() => excluirVariavel(v)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-accent-50 text-accent-600 cursor-pointer"
                        title="Excluir"
                      >
                        <i className="ri-delete-bin-6-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {variaveis.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-foreground-400 text-sm">
                    Nenhuma variável personalizada ainda.
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
              <h3 className="font-heading font-bold text-foreground-950">{editando ? 'Editar variável' : 'Nova variável'}</h3>
              <button onClick={() => setModalAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Chave</label>
                <input
                  type="text"
                  value={form.chave}
                  onChange={(e) => setForm({ ...form, chave: e.target.value })}
                  placeholder="ex.: link_agendamento"
                  className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
                />
                <p className="text-xs text-foreground-400 mt-1">Sem espaços ou acentos. Será usada como {'{chave}'}.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Valor</label>
                <input
                  type="text"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  placeholder="ex.: https://cal.com/minha-empresa"
                  className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Descrição (opcional)</label>
                <input
                  type="text"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="ex.: Link da agenda"
                  className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setModalAberto(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={salvar} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">
                {editando ? 'Salvar' : 'Criar variável'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}