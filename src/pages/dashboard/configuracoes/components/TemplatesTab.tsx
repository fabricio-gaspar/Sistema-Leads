import { useState } from 'react';
import { useTemplatesStore } from '@/hooks/useTemplatesStore';
import type { TemplateMensagem } from '@/hooks/useTemplatesStore';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';
import { useVariaveisGlobaisStore } from '@/hooks/useVariaveisGlobaisStore';
import { montarValoresVariaveis, resolverVariaveis } from '@/lib/variaveis';

const usoCores: Record<string, string> = {
  automático: 'bg-primary-100 text-primary-700',
  manual: 'bg-secondary-100 text-secondary-700',
  ambos: 'bg-accent-100 text-accent-700',
};

const canais = ['WhatsApp', 'E-mail', 'Telefone', 'Instagram'];
const usos = ['automático', 'manual', 'ambos'] as const;
const toms = ['formal', 'consultivo', 'descontraido'];
const tomLabels: Record<string, string> = {
  formal: 'Formal',
  consultivo: 'Consultivo',
  descontraido: 'Descontraído',
};

// Lead fictício usado na pré-visualização para ver como as variáveis ficam
// resolvidas com dados reais.
const leadTeste = {
  nome: 'Mariana Souza',
  empresa: 'Construtora Horizonte',
  oferta: 'plano Pro',
  link: 'https://www.wayflex.ind.br/contato',
  segmento: 'Construção Civil',
};

export default function TemplatesTab() {
  const { templates, atualizar, adicionar, excluir } = useTemplatesStore();
  const { settings } = useEmpresaSettingsStore();
  const { variaveis } = useVariaveisGlobaisStore();
  const [toast, setToast] = useState('');
  const [detalhe, setDetalhe] = useState<TemplateMensagem | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<TemplateMensagem | null>(null);
  const [form, setForm] = useState({
    nome: '',
    canal: 'WhatsApp',
    categoria: 'Primeiro contato',
    conteudo: '',
    variaveis: '',
    uso: 'manual' as TemplateMensagem['uso'],
    tom: 'consultivo',
  });

  const resolverPreview = (t: TemplateMensagem): string => {
    const valores = montarValoresVariaveis({
      lead: leadTeste,
      organizacao: settings.organizacao,
      customVars: variaveis,
    });
    return resolverVariaveis(t.conteudo, valores);
  };

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const toggleAtivo = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (t) atualizar(id, { ativo: !t.ativo });
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm({ nome: '', canal: 'WhatsApp', categoria: 'Primeiro contato', conteudo: '', variaveis: '', uso: 'manual', tom: 'consultivo' });
    setModalAberto(true);
  };

  const abrirEdicao = (t: TemplateMensagem) => {
    setEditando(t);
    setForm({
      nome: t.nome,
      canal: t.canal,
      categoria: t.categoria,
      conteudo: t.conteudo,
      variaveis: t.variaveis.join(', '),
      uso: t.uso,
      tom: t.tom || 'consultivo',
    });
    setModalAberto(true);
  };

  const salvar = () => {
    if (!form.nome.trim() || !form.conteudo.trim()) {
      mostrarToast('Preencha nome e conteúdo do template.');
      return;
    }
    const variaveis = form.variaveis.split(',').map((v) => v.trim()).filter(Boolean);
    if (editando) {
      atualizar(editando.id, {
        nome: form.nome.trim(),
        canal: form.canal,
        categoria: form.categoria,
        conteudo: form.conteudo.trim(),
        variaveis,
        uso: form.uso,
        tom: form.tom,
        dataRevisao: new Date().toISOString().slice(0, 10),
      });
      mostrarToast('Template atualizado.');
    } else {
      adicionar({
        id: `tm-${Date.now()}`,
        nome: form.nome.trim(),
        canal: form.canal,
        categoria: form.categoria,
        conteudo: form.conteudo.trim(),
        variaveis,
        uso: form.uso,
        tom: form.tom,
        ativo: true,
        versao: 1,
        aprovador: 'Você',
        dataRevisao: new Date().toISOString().slice(0, 10),
      });
      mostrarToast('Template criado.');
    }
    setModalAberto(false);
  };

  const excluirTemplate = (t: TemplateMensagem) => {
    excluir(t.id);
    mostrarToast(`Template "${t.nome}" excluído.`);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Templates e Respostas</h3>
            <p className="text-xs text-foreground-500">Mensagens predefinidas para a Ana e equipe.</p>
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
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Canal</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Categoria</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Uso</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Versão</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Ativo</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs w-24"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-background-100 hover:bg-background-50/50">
                  <td className="px-6 py-3.5">
                    <p className="font-medium text-foreground-900">{t.nome}</p>
                    <p className="text-xs text-foreground-500">Aprovado por {t.aprovador}</p>
                  </td>
                  <td className="px-6 py-3.5 text-foreground-700">{t.canal}</td>
                  <td className="px-6 py-3.5 text-foreground-700">{t.categoria}</td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${usoCores[t.uso]}`}>
                      {t.uso === 'automático' ? 'Auto' : t.uso === 'manual' ? 'Manual' : 'Ambos'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell">v{t.versao}</td>
                  <td className="px-6 py-3.5">
                    <button
                      onClick={() => toggleAtivo(t.id)}
                      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${t.ativo ? 'bg-primary-500' : 'bg-background-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${t.ativo ? 'translate-x-5' : ''}`}></span>
                    </button>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setDetalhe(t)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer"
                        title="Ver"
                      >
                        <i className="ri-eye-line"></i>
                      </button>
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
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal detalhe */}
      {detalhe && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setDetalhe(null)}>
          <div className="bg-background-50 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">{detalhe.nome}</h3>
                <p className="text-xs text-foreground-500">{detalhe.canal} · {detalhe.categoria}</p>
              </div>
              <button onClick={() => setDetalhe(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-background-100 rounded-lg p-4 text-sm text-foreground-800 whitespace-pre-line">
                {detalhe.conteudo}
              </div>
              <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-secondary-800 mb-1.5 flex items-center gap-1.5">
                  <i className="ri-eye-line"></i>
                  Pré-visualização (lead de teste)
                </p>
                <div className="text-sm text-foreground-800 whitespace-pre-line">{resolverPreview(detalhe)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {detalhe.variaveis.map((v) => (
                  <span key={v} className="px-2.5 py-1 rounded-md text-xs bg-secondary-100 text-secondary-800">
                    {'{'}{v}{'}'}
                  </span>
                ))}
                {detalhe.variaveis.length === 0 && (
                  <span className="text-xs text-foreground-400">Sem variáveis</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-foreground-500 text-xs">Uso</p>
                  <p className="text-foreground-900">{detalhe.uso}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Tom</p>
                  <p className="text-foreground-900">{tomLabels[detalhe.tom] || 'Consultivo'}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Versão</p>
                  <p className="text-foreground-900">v{detalhe.versao}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Aprovador</p>
                  <p className="text-foreground-900">{detalhe.aprovador}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Revisado em</p>
                  <p className="text-foreground-900">{detalhe.dataRevisao}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-background-200/70 flex justify-end gap-2">
                <button onClick={() => { setDetalhe(null); abrirEdicao(detalhe); }} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">
                  Editar
                </button>
                <button onClick={() => setDetalhe(null)} className="px-4 py-2.5 bg-background-100 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-200 cursor-pointer whitespace-nowrap">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo/editar template */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setModalAberto(false)}>
          <div className="bg-background-50 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">{editando ? 'Editar template' : 'Novo template'}</h3>
              <button onClick={() => setModalAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome</label>
                <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Canal</label>
                  <select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                    {canais.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Categoria</label>
                  <input type="text" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Conteúdo</label>
                <textarea value={form.conteudo} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} rows={5} placeholder="Use {variável} para inserir dados dinâmicos..." className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Variáveis (separadas por vírgula)</label>
                <input type="text" value={form.variaveis} onChange={(e) => setForm({ ...form, variaveis: e.target.value })} placeholder="nome, empresa, oferta" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Uso</label>
                <select value={form.uso} onChange={(e) => setForm({ ...form, uso: e.target.value as TemplateMensagem['uso'] })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  {usos.map((u) => <option key={u} value={u}>{u === 'automático' ? 'Automático' : u === 'manual' ? 'Manual' : 'Ambos'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Tom</label>
                <select value={form.tom} onChange={(e) => setForm({ ...form, tom: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  {toms.map((t) => <option key={t} value={t}>{tomLabels[t]}</option>)}
                </select>
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