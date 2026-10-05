import { useState } from 'react';
import {
  categoriasConhecimento,
  type EntradaConhecimento,
  type CategoriaConhecimento,
} from '@/mocks/conhecimentoData';
import { useAuth } from '@/hooks/useAuth';
import { useConhecimentoStore } from '@/hooks/useConhecimentoStore';

const statusCor: Record<string, string> = {
  ativo: 'bg-secondary-100 text-secondary-700',
  rascunho: 'bg-background-200 text-foreground-600',
};

export default function BaseConhecimentoTab() {
  const { entradas, carregando, erro: erroCarregamento, adicionar, atualizar, excluir, alternarStatus, recarregar } = useConhecimentoStore();
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<CategoriaConhecimento | 'todas'>('todas');
  const [apenasAtivas, setApenasAtivas] = useState(false);
  const [toast, setToast] = useState('');
  const [selecionada, setSelecionada] = useState<EntradaConhecimento | null>(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<EntradaConhecimento | null>(null);
  const { user } = useAuth();

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const contagemCategoria = (id: CategoriaConhecimento) => entradas.filter((e) => e.categoria === id).length;
  const ativas = entradas.filter((e) => e.status === 'ativo').length;

  const filtradas = entradas.filter((e) => {
    const bateCategoria = categoria === 'todas' || e.categoria === categoria;
    const bateStatus = !apenasAtivas || e.status === 'ativo';
    const termo = busca.trim().toLowerCase();
    const bateBusca =
      !termo ||
      e.titulo.toLowerCase().includes(termo) ||
      e.pergunta?.toLowerCase().includes(termo) ||
      e.conteudo.toLowerCase().includes(termo) ||
      e.palavrasChave.some((p) => p.toLowerCase().includes(termo));
    return bateCategoria && bateStatus && bateBusca;
  });

  const nomeCategoria = (id: CategoriaConhecimento) =>
    categoriasConhecimento.find((c) => c.id === id)?.nome || id;

  const iconeCategoria = (id: CategoriaConhecimento) =>
    categoriasConhecimento.find((c) => c.id === id)?.icone || 'ri-bookmark-line';

  const novaEntrada = async (entrada: EntradaConhecimento) => {
    try {
      await adicionar(entrada);
      setModal(false);
      mostrarToast('Entrada salva. A Ana já pode consultar este conteúdo.');
    } catch {
      mostrarToast('Não foi possível salvar a entrada. Tente novamente.');
    }
  };

  const salvarEdicao = async (entrada: EntradaConhecimento) => {
    try {
      await atualizar(entrada.id, entrada);
      setEditando(null);
      mostrarToast('Entrada atualizada. A Ana usará a versão nova.');
    } catch {
      mostrarToast('Não foi possível atualizar a entrada.');
    }
  };

  const excluirEntrada = async (id: string) => {
    try {
      await excluir(id);
      setSelecionada(null);
      mostrarToast('Entrada excluída da base.');
    } catch {
      mostrarToast('Não foi possível excluir a entrada.');
    }
  };

  const alternarStatusEntrada = async (entrada: EntradaConhecimento) => {
    try {
      await alternarStatus(entrada.id);
      setSelecionada(null);
      mostrarToast(entrada.status === 'ativo' ? 'Entrada pausada — Ana não usará mais.' : 'Entrada ativada — Ana passará a usar.');
    } catch {
      mostrarToast('Não foi possível alterar o status da entrada.');
    }
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      {erroCarregamento && (
        <div className="bg-accent-100 border border-accent-300 text-accent-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-3">
          <span>Não foi possível carregar a base aprovada da Ana.</span>
          <button onClick={() => void recarregar()} className="font-semibold underline cursor-pointer">Tentar novamente</button>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="text-sm text-foreground-600">
          {carregando ? 'Carregando a memória aprovada da Ana…' : `${ativas} de ${entradas.length} entradas ativas alimentando a Ana.`}
        </p>
        <button
          onClick={() => setModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line"></i>
          Nova entrada
        </button>
      </div>

      {/* Cards de categorias */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <button
          onClick={() => setCategoria('todas')}
          className={`text-left bg-background-50 border rounded-xl p-4 transition-all cursor-pointer ${
            categoria === 'todas' ? 'border-primary-300 ring-2 ring-primary-400/20' : 'border-background-200/70 hover:border-background-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
              <i className="ri-book-open-line text-primary-600"></i>
            </div>
            <span className="text-2xl font-heading font-extrabold text-foreground-950">{entradas.length}</span>
          </div>
          <p className="font-medium text-foreground-900 text-sm">Todas</p>
          <p className="text-xs text-foreground-500">Entradas na base</p>
        </button>
        {categoriasConhecimento.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoria(categoria === c.id ? 'todas' : c.id)}
            className={`text-left bg-background-50 border rounded-xl p-4 transition-all cursor-pointer ${
              categoria === c.id ? 'border-primary-300 ring-2 ring-primary-400/20' : 'border-background-200/70 hover:border-background-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.cor}`}>
                <i className={c.icone}></i>
              </div>
              <span className="text-2xl font-heading font-extrabold text-foreground-950">{contagemCategoria(c.id)}</span>
            </div>
            <p className="font-medium text-foreground-900 text-sm">{c.nome}</p>
            <p className="text-xs text-foreground-500 line-clamp-2">{c.descricao}</p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na base de conhecimento..."
            className="w-full pl-10 pr-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-foreground-700 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={apenasAtivas}
            onChange={(e) => setApenasAtivas(e.target.checked)}
            className="w-4 h-4 accent-primary-500 cursor-pointer"
          />
          Apenas ativas
        </label>
      </div>

      {/* Lista */}
      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Categoria</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Entrada</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden lg:table-cell">Status</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Usos</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((e) => (
                <tr key={e.id} className="border-b border-background-100 hover:bg-background-50/50 cursor-pointer" onClick={() => setSelecionada(e)}>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${categoriasConhecimento.find((c) => c.id === e.categoria)?.cor}`}>
                      <i className={iconeCategoria(e.categoria)}></i>
                      {nomeCategoria(e.categoria)}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <p className="font-medium text-foreground-900">{e.titulo}</p>
                    {e.pergunta && <p className="text-foreground-500 text-xs">{e.pergunta}</p>}
                  </td>
                  <td className="px-6 py-3.5 hidden lg:table-cell">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${statusCor[e.status]}`}>{e.status}</span>
                  </td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell">{e.usos}</td>
                  <td className="px-6 py-3.5 text-right">
                    <span className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer">
                      <i className="ri-eye-line"></i>
                    </span>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-foreground-500">
                    <i className="ri-inbox-line text-3xl mb-2 block"></i>
                    Nenhuma entrada encontrada com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer de detalhe */}
      {selecionada && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex justify-end" onClick={() => setSelecionada(null)}>
          <div className="bg-background-50 w-full max-w-lg h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-background-200/70 flex items-start justify-between gap-4 sticky top-0 bg-background-50">
              <div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium mb-2 ${categoriasConhecimento.find((c) => c.id === selecionada.categoria)?.cor}`}>
                  <i className={iconeCategoria(selecionada.categoria)}></i>
                  {nomeCategoria(selecionada.categoria)}
                </span>
                <h3 className="font-heading font-bold text-foreground-950 text-lg">{selecionada.titulo}</h3>
                {selecionada.pergunta && <p className="text-foreground-500 text-sm mt-1">"{selecionada.pergunta}"</p>}
              </div>
              <button onClick={() => setSelecionada(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div>
                <p className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-2">Resposta da Ana</p>
                <div className="bg-background-100/70 border border-background-200/70 rounded-lg p-4 text-sm text-foreground-800 leading-relaxed whitespace-pre-line">
                  {selecionada.conteudo}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-2">Palavras-chave</p>
                <div className="flex flex-wrap gap-2">
                  {selecionada.palavrasChave.map((p) => (
                    <span key={p} className="inline-block px-2.5 py-1 bg-secondary-100 text-secondary-800 rounded-full text-xs">{p}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-background-50 border border-background-200/70 rounded-lg p-3">
                  <p className="text-foreground-500 text-xs">Status</p>
                  <span className={`inline-block mt-1 px-2.5 py-1 rounded-md text-xs font-medium ${statusCor[selecionada.status]}`}>{selecionada.status}</span>
                </div>
                <div className="bg-background-50 border border-background-200/70 rounded-lg p-3">
                  <p className="text-foreground-500 text-xs">Usos</p>
                  <p className="font-heading font-bold text-foreground-950 mt-1">{selecionada.usos}</p>
                </div>
                <div className="bg-background-50 border border-background-200/70 rounded-lg p-3">
                  <p className="text-foreground-500 text-xs">Autor</p>
                  <p className="font-medium text-foreground-900 mt-1">{selecionada.autor}</p>
                </div>
                <div className="bg-background-50 border border-background-200/70 rounded-lg p-3">
                  <p className="text-foreground-500 text-xs">Atualizado</p>
                  <p className="font-medium text-foreground-900 mt-1">{selecionada.data}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setEditando(selecionada); setSelecionada(null); }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-edit-line"></i>
                  Editar
                </button>
                <button
                  onClick={() => alternarStatusEntrada(selecionada)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary-500 hover:bg-secondary-600 text-background-50 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
                >
                  <i className={selecionada.status === 'ativo' ? 'ri-pause-circle-line' : 'ri-play-circle-line'}></i>
                  {selecionada.status === 'ativo' ? 'Pausar' : 'Ativar'}
                </button>
                <button
                  onClick={() => excluirEntrada(selecionada.id)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-accent-600 hover:bg-accent-50 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-delete-bin-6-line"></i>
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova entrada */}
      {modal && (
        <EntradaModal onClose={() => setModal(false)} onSalvar={novaEntrada} autor={user?.name || 'Você'} />
      )}

      {/* Modal editar entrada */}
      {editando && (
        <EntradaModal onClose={() => setEditando(null)} onSalvar={salvarEdicao} autor={user?.name || 'Você'} inicial={editando} />
      )}
    </div>
  );
}

function EntradaModal({
  onClose,
  onSalvar,
  autor,
  inicial,
}: {
  onClose: () => void;
  onSalvar: (entrada: EntradaConhecimento) => void;
  autor: string;
  inicial?: EntradaConhecimento;
}) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [pergunta, setPergunta] = useState(inicial?.pergunta ?? '');
  const [categoria, setCategoria] = useState<CategoriaConhecimento>(inicial?.categoria ?? 'faq');
  const [conteudo, setConteudo] = useState(inicial?.conteudo ?? '');
  const [palavrasChave, setPalavrasChave] = useState(inicial?.palavrasChave.join(', ') ?? '');
  const [erro, setErro] = useState('');

  const salvar = () => {
    if (!titulo.trim() || !conteudo.trim()) {
      setErro('Preencha o título e o conteúdo da resposta.');
      return;
    }
    onSalvar({
      ...(inicial || {}),
      id: inicial?.id ?? `con-${Date.now()}`,
      categoria,
      titulo: titulo.trim(),
      pergunta: pergunta.trim() || undefined,
      conteudo: conteudo.trim(),
      palavrasChave: palavrasChave.split(',').map((p) => p.trim()).filter(Boolean),
      status: inicial?.status ?? 'ativo',
      autor: inicial?.autor ?? autor,
      data: new Date().toISOString().slice(0, 10),
      usos: inicial?.usos ?? 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background-50 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between sticky top-0 bg-background-50">
          <h3 className="font-heading font-bold text-foreground-950">
            {inicial ? 'Editar entrada' : 'Nova entrada na base de conhecimento'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>
        <div className="p-6 space-y-4">
          {erro && (
            <div className="bg-accent-100 border border-accent-300 text-accent-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <i className="ri-error-warning-line"></i>
              {erro}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Categoria</label>
            <div className="flex flex-wrap gap-2">
              {categoriasConhecimento.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoria(c.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border cursor-pointer whitespace-nowrap ${
                    categoria === c.id ? `${c.cor} border-transparent` : 'bg-background-50 border-background-300 text-foreground-600 hover:bg-background-100'
                  }`}
                >
                  <i className={c.icone}></i>
                  {c.nome}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Qual material é indicado para esta aplicação?"
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Pergunta do lead (opcional)</label>
            <input
              type="text"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="A pergunta exata que o lead costuma fazer"
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Resposta da Ana</label>
            <textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              rows={5}
              maxLength={500}
              placeholder="Escreva a resposta completa que a Ana deve dar..."
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 resize-none"
            />
            <p className="text-xs text-foreground-500 mt-1 text-right">{conteudo.length}/500</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Palavras-chave (separadas por vírgula)</label>
            <input
              type="text"
              value={palavrasChave}
              onChange={(e) => setPalavrasChave(e.target.value)}
              placeholder="custo, preço, orçamento, investimento"
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2 sticky bottom-0 bg-background-50">
          <button onClick={onClose} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">
            Cancelar
          </button>
          <button onClick={salvar} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">
            {inicial ? 'Salvar alterações' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
}
