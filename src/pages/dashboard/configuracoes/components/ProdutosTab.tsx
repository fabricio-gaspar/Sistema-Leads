import { useState } from 'react';
import { useCatalogoStore } from '@/hooks/useCatalogoStore';
import type { ProdutoCatalogo } from '@/hooks/useCatalogoStore';
import CsvImportModal from '@/components/feature/CsvImportModal';
import type { CampoImportacao, ResultadoImportacao } from '@/components/feature/CsvImportModal';
import AutocompleteTextarea from '@/components/feature/AutocompleteTextarea';

const categorias = ['Serviço', 'Produto', 'Assinatura', 'Consultoria'];

const camposProduto: CampoImportacao[] = [
  { chave: 'nome', rotulo: 'Nome', obrigatorio: true, aliases: ['produto', 'servico', 'item'] },
  { chave: 'codigo', rotulo: 'Código', aliases: ['sku', 'referencia'] },
  { chave: 'categoria', rotulo: 'Categoria' },
  { chave: 'unidade', rotulo: 'Unidade' },
  { chave: 'descricaoCurta', rotulo: 'Descrição curta', aliases: ['descricao'] },
  { chave: 'descricaoCompleta', rotulo: 'Descrição completa' },
  { chave: 'descontoMaximo', rotulo: 'Desconto máx. (%)' },
  { chave: 'prazoPadrao', rotulo: 'Prazo (dias)' },
  { chave: 'precoBase', rotulo: 'Preço base (R$)', aliases: ['preco', 'valor', 'valorunitario'] },
];

export default function ProdutosTab() {
  const { produtos, atualizar, adicionar, excluir } = useCatalogoStore();
  const [toast, setToast] = useState('');
  const [detalhe, setDetalhe] = useState<ProdutoCatalogo | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [csvModal, setCsvModal] = useState(false);
  const [editando, setEditando] = useState<ProdutoCatalogo | null>(null);
  const [form, setForm] = useState({
    nome: '',
    codigo: '',
    categoria: 'Serviço',
    unidade: 'Projeto',
    descricaoCurta: '',
    descricaoCompleta: '',
    descontoMaximo: 10,
    prazoPadrao: 30,
    precoBase: 0,
    podeOrcamento: true,
  });

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const toggleAtivo = (id: string) => {
    const p = produtos.find((x) => x.id === id);
    if (p) atualizar(id, { ativo: !p.ativo });
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm({ nome: '', codigo: '', categoria: 'Serviço', unidade: 'Projeto', descricaoCurta: '', descricaoCompleta: '', descontoMaximo: 10, prazoPadrao: 30, precoBase: 0, podeOrcamento: true });
    setModalAberto(true);
  };

  const abrirEdicao = (p: ProdutoCatalogo) => {
    setEditando(p);
    setForm({
      nome: p.nome,
      codigo: p.codigo,
      categoria: p.categoria,
      unidade: p.unidade,
      descricaoCurta: p.descricaoCurta,
      descricaoCompleta: p.descricaoCompleta,
      descontoMaximo: p.descontoMaximo,
      prazoPadrao: p.prazoPadrao,
      precoBase: p.precoBase,
      podeOrcamento: p.podeOrcamento,
    });
    setModalAberto(true);
  };

  const salvar = () => {
    if (!form.nome.trim()) {
      mostrarToast('Informe o nome do produto.');
      return;
    }
    if (editando) {
      atualizar(editando.id, form);
      mostrarToast('Produto atualizado.');
    } else {
      adicionar({
        ...form,
        id: crypto.randomUUID(),
        codigo: form.codigo.trim() || `P-${String(produtos.length + 1).padStart(3, '0')}`,
        ativo: true,
      });
      mostrarToast('Produto criado.');
    }
    setModalAberto(false);
  };

  const excluirProduto = (p: ProdutoCatalogo) => {
    excluir(p.id);
    mostrarToast(`Produto "${p.nome}" excluído.`);
  };

  const importarProdutos = (linhas: Record<string, string>[]): ResultadoImportacao => {
    const normalizar = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existentes = new Set(produtos.map((p) => normalizar(p.codigo || p.nome)));
    let importados = 0;
    let duplicados = 0;

    linhas.forEach((l) => {
      const nome = (l.nome || '').trim();
      if (!nome) return;
      const codigo = (l.codigo || '').trim() || `P-${String(produtos.length + importados + 1).padStart(3, '0')}`;
      const chave = normalizar(codigo || nome);
      if (existentes.has(chave)) {
        duplicados += 1;
        return;
      }
      existentes.add(chave);
      adicionar({
        id: crypto.randomUUID(),
        nome,
        codigo,
        categoria: (l.categoria || '').trim() || 'Serviço',
        unidade: (l.unidade || '').trim() || 'Projeto',
        descricaoCurta: (l.descricaoCurta || '').trim(),
        descricaoCompleta: (l.descricaoCompleta || '').trim(),
        descontoMaximo: Math.min(100, Math.max(0, Number(l.descontoMaximo) || 10)),
        prazoPadrao: Math.max(0, Number(l.prazoPadrao) || 30),
        precoBase: Math.max(0, Number(l.precoBase) || 0),
        ativo: true,
        podeOrcamento: true,
      });
      importados += 1;
    });

    return { importados, duplicados };
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
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Produtos e Catálogo</h3>
            <p className="text-xs text-foreground-500">Serviços disponíveis para orçamento e abordagem da Ana.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCsvModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-background-300 text-foreground-700 hover:bg-background-100 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <i className="ri-file-upload-line"></i>
              Importar CSV
            </button>
            <button
              onClick={abrirNovo}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line"></i>
              Novo produto
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Produto</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Categoria</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Unidade</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden lg:table-cell">Prazo padrão</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Ativo</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs w-20"></th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id} className="border-b border-background-100 hover:bg-background-50/50">
                  <td className="px-6 py-3.5">
                    <p className="font-medium text-foreground-900">{p.nome}</p>
                    <p className="text-xs text-foreground-500">{p.codigo}</p>
                  </td>
                  <td className="px-6 py-3.5 text-foreground-700">{p.categoria}</td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell">{p.unidade}</td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden lg:table-cell">{p.prazoPadrao} dias</td>
                  <td className="px-6 py-3.5">
                    <button
                      onClick={() => toggleAtivo(p.id)}
                      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${p.ativo ? 'bg-primary-500' : 'bg-background-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${p.ativo ? 'translate-x-5' : ''}`}></span>
                    </button>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setDetalhe(p)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer"
                        title="Detalhes"
                      >
                        <i className="ri-eye-line"></i>
                      </button>
                      <button
                        onClick={() => abrirEdicao(p)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer"
                        title="Editar"
                      >
                        <i className="ri-edit-line"></i>
                      </button>
                      <button
                        onClick={() => excluirProduto(p)}
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

      {detalhe && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setDetalhe(null)}>
          <div className="bg-background-50 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">{detalhe.nome}</h3>
                <p className="text-xs text-foreground-500">{detalhe.codigo} · {detalhe.categoria}</p>
              </div>
              <button onClick={() => setDetalhe(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-foreground-500 text-xs mb-1">Descrição curta</p>
                <p className="text-sm text-foreground-800">{detalhe.descricaoCurta}</p>
              </div>
              <div>
                <p className="text-foreground-500 text-xs mb-1">Descrição completa</p>
                <p className="text-sm text-foreground-700 bg-background-100 rounded-lg p-3">{detalhe.descricaoCompleta}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-foreground-500 text-xs">Unidade</p>
                  <p className="text-foreground-900">{detalhe.unidade}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Prazo padrão</p>
                  <p className="text-foreground-900">{detalhe.prazoPadrao} dias</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Desconto máximo</p>
                  <p className="text-foreground-900">{detalhe.descontoMaximo}%</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Preço base</p>
                  <p className="text-foreground-900">{detalhe.precoBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Orçamento</p>
                  <p className="text-foreground-900">{detalhe.podeOrcamento ? 'Permitido' : 'Não permitido'}</p>
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

      {/* Modal novo/editar produto */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setModalAberto(false)}>
          <div className="bg-background-50 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">{editando ? 'Editar produto' : 'Novo produto'}</h3>
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
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Código</label>
                  <input type="text" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="MK-002" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Categoria</label>
                  <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                    {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Unidade</label>
                  <select value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                    {['Projeto', 'Mensal', 'Hora', 'Unidade'].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Desconto máx. (%)</label>
                  <input type="number" min={0} max={100} value={form.descontoMaximo} onChange={(e) => setForm({ ...form, descontoMaximo: Math.min(100, Math.max(0, Number(e.target.value))) })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Prazo (dias)</label>
                  <input type="number" min={0} value={form.prazoPadrao} onChange={(e) => setForm({ ...form, prazoPadrao: Math.max(0, Number(e.target.value)) })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Preço base (R$)</label>
                  <input type="number" min={0} step="0.01" value={form.precoBase} onChange={(e) => setForm({ ...form, precoBase: Math.max(0, Number(e.target.value)) })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Descrição curta</label>
                <input type="text" value={form.descricaoCurta} onChange={(e) => setForm({ ...form, descricaoCurta: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Descrição completa</label>
                <AutocompleteTextarea
                  value={form.descricaoCompleta}
                  onChange={(v) => setForm({ ...form, descricaoCompleta: v })}
                  rows={3}
                  tipo="produto"
                  placeholder="Descreva o produto/serviço... (use o botão Completar com IA)"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground-700 cursor-pointer">
                <input type="checkbox" checked={form.podeOrcamento} onChange={(e) => setForm({ ...form, podeOrcamento: e.target.checked })} className="w-4 h-4 accent-primary-500 cursor-pointer" />
                Pode ser usado em orçamento
              </label>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setModalAberto(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={salvar} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">
                {editando ? 'Salvar' : 'Criar produto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {csvModal && (
        <CsvImportModal
          titulo="Importar produtos por CSV"
          subtitulo="Mapeie as colunas do arquivo e importe vários produtos de uma vez."
          campos={camposProduto}
          onImportar={importarProdutos}
          onClose={() => setCsvModal(false)}
        />
      )}
    </div>
  );
}
