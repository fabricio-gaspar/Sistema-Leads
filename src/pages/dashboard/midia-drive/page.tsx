import { useState } from 'react';
import { useMidiaDriveStore } from '@/hooks/useMidiaDriveStore';
import type { Arquivo } from '@/mocks/midiaData';

const tipoIcone: Record<string, string> = {
  documento: 'ri-file-text-line text-primary-600',
  imagem: 'ri-image-line text-accent-600',
  planilha: 'ri-file-excel-2-line text-secondary-700',
  apresentacao: 'ri-file-ppt-2-line text-accent-600',
  video: 'ri-video-line text-primary-600',
  outro: 'ri-file-3-line text-foreground-500',
};

function formatarTamanho(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tipoDeFormato(formato: string): Arquivo['tipo'] {
  const f = formato.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(f)) return 'imagem';
  if (['xls', 'xlsx', 'csv'].includes(f)) return 'planilha';
  if (['ppt', 'pptx'].includes(f)) return 'apresentacao';
  if (['mp4', 'mov', 'avi', 'webm'].includes(f)) return 'video';
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(f)) return 'documento';
  return 'outro';
}

export default function MidiaDrive() {
  const {
    pastas,
    arquivos,
    adicionarArquivo,
    adicionarPasta,
    renomearArquivo,
    renomearPasta,
    excluirArquivo,
    excluirPasta,
  } = useMidiaDriveStore();
  const [busca, setBusca] = useState('');
  const [pastaSelecionada, setPastaSelecionada] = useState('Todas');
  const [uploadModal, setUploadModal] = useState(false);
  const [novaPastaModal, setNovaPastaModal] = useState(false);
  const [renomearModal, setRenomearModal] = useState<{ tipo: 'arquivo' | 'pasta'; id: string; nome: string } | null>(null);
  const [toast, setToast] = useState('');

  const [uploadPasta, setUploadPasta] = useState('Materiais de marketing');
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [novaPastaNome, setNovaPastaNome] = useState('');
  const [renomearNome, setRenomearNome] = useState('');

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const filtrados = arquivos.filter((a) => {
    const bateBusca = a.nome.toLowerCase().includes(busca.toLowerCase());
    const batePasta = pastaSelecionada === 'Todas' || a.pasta === pastaSelecionada;
    return bateBusca && batePasta;
  });

  const confirmarUpload = () => {
    if (!arquivoSelecionado) {
      mostrarToast('Selecione um arquivo.');
      return;
    }
    const nome = arquivoSelecionado.name;
    const formato = nome.split('.').pop()?.toUpperCase() || 'OUTRO';
    adicionarArquivo({
      id: `a-${Date.now()}`,
      nome,
      tipo: tipoDeFormato(formato),
      formato,
      tamanho: formatarTamanho(arquivoSelecionado.size),
      pasta: uploadPasta,
      autor: 'Você',
      data: new Date().toISOString().slice(0, 10),
    });
    setUploadModal(false);
    setArquivoSelecionado(null);
    mostrarToast('Arquivo enviado com sucesso!');
  };

  const confirmarNovaPasta = () => {
    if (!novaPastaNome.trim()) {
      mostrarToast('Informe o nome da pasta.');
      return;
    }
    adicionarPasta({
      id: `p-${Date.now()}`,
      nome: novaPastaNome.trim(),
      icone: 'ri-folder-line',
      cor: 'bg-background-100 text-foreground-500',
      arquivos: 0,
    });
    setNovaPastaModal(false);
    setNovaPastaNome('');
    mostrarToast('Pasta criada.');
  };

  const abrirRenomear = (tipo: 'arquivo' | 'pasta', id: string, nome: string) => {
    setRenomearModal({ tipo, id, nome });
    setRenomearNome(nome);
  };

  const confirmarRenomear = () => {
    if (!renomearModal) return;
    if (!renomearNome.trim()) {
      mostrarToast('Informe o novo nome.');
      return;
    }
    if (renomearModal.tipo === 'arquivo') {
      renomearArquivo(renomearModal.id, renomearNome.trim());
    } else {
      renomearPasta(renomearModal.id, renomearNome.trim());
    }
    setRenomearModal(null);
    mostrarToast('Renomeado.');
  };

  const baixarArquivo = (a: Arquivo) => {
    const conteudo = `Wayflex — Mídia Drive\n\nArquivo: ${a.nome}\nFormato: ${a.formato}\nTamanho: ${a.tamanho}\nAutor: ${a.autor}\nData: ${a.data}\n\nEste é um download de demonstração.`;
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = a.nome.replace(/\.[^.]+$/, '') + '.txt';
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
    URL.revokeObjectURL(url);
    mostrarToast(`Baixando ${a.nome}`);
  };

  const contagemPasta = (nome: string) => arquivos.filter((a) => a.pasta === nome).length;

  return (
    <div className="wf-page">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-2">
            Midia Drive
          </h1>
          <p className="text-foreground-600 text-sm">
            Armazene e compartilhe documentos, imagens e arquivos do seu negócio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNovaPastaModal(true)}
            className="inline-flex items-center gap-2 border border-background-300 text-foreground-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-folder-add-line"></i>
            Nova pasta
          </button>
          <button
            onClick={() => setUploadModal(true)}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 px-5 py-2.5 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-upload-2-line"></i>
            Enviar arquivo
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      <div className="mb-6 relative max-w-md">
        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar arquivos..."
          className="w-full pl-9 pr-4 py-2.5 bg-background-50 border border-background-200/70 rounded-lg text-sm text-foreground-800 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400/20"
        />
      </div>

      {/* Pastas */}
      <div className="mb-8">
        <h3 className="font-heading font-bold text-foreground-900 text-sm mb-4">Pastas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <button
            onClick={() => setPastaSelecionada('Todas')}
            className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
              pastaSelecionada === 'Todas'
                ? 'border-primary-400 bg-primary-50'
                : 'border-background-200/70 bg-background-50 hover:border-background-300'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-foreground-100 text-foreground-600 flex items-center justify-center mb-3">
              <i className="ri-stack-line text-lg"></i>
            </div>
            <p className="font-semibold text-foreground-900 text-sm">Todos os arquivos</p>
            <p className="text-xs text-foreground-500 mt-0.5">{arquivos.length} arquivos</p>
          </button>
          {pastas.map((p) => (
            <div key={p.id} className="relative group">
              <button
                onClick={() => setPastaSelecionada(p.nome)}
                className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  pastaSelecionada === p.nome
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-background-200/70 bg-background-50 hover:border-background-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${p.cor}`}>
                  <i className={`${p.icone} text-lg`}></i>
                </div>
                <p className="font-semibold text-foreground-900 text-sm">{p.nome}</p>
                <p className="text-xs text-foreground-500 mt-0.5">{contagemPasta(p.nome)} arquivos</p>
              </button>
              <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1">
                <button
                  onClick={() => abrirRenomear('pasta', p.id, p.nome)}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-500 hover:bg-background-100 cursor-pointer"
                  title="Renomear"
                >
                  <i className="ri-edit-line text-xs"></i>
                </button>
                <button
                  onClick={() => { excluirPasta(p.id); mostrarToast(`Pasta "${p.nome}" excluída.`); }}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-accent-600 hover:bg-accent-50 cursor-pointer"
                  title="Excluir"
                >
                  <i className="ri-delete-bin-6-line text-xs"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de arquivos */}
      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
          <h3 className="font-heading font-bold text-foreground-900 text-sm">Arquivos</h3>
          <span className="text-xs text-foreground-500">{filtrados.length} itens</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Nome</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Formato</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden lg:table-cell">Pasta</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Autor</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs w-28"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-foreground-400 text-sm">
                    Nenhum arquivo encontrado.
                  </td>
                </tr>
              )}
              {filtrados.map((a) => (
                <tr key={a.id} className="border-b border-background-100 hover:bg-background-50/50">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-background-100 flex items-center justify-center flex-shrink-0">
                        <i className={tipoIcone[a.tipo]}></i>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground-900 truncate">{a.nome}</p>
                        <p className="text-xs text-foreground-500">{a.tamanho}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell">{a.formato}</td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden lg:table-cell">{a.pasta}</td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell">{a.autor}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex gap-1">
                      <button onClick={() => baixarArquivo(a)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer" title="Baixar">
                        <i className="ri-download-2-line"></i>
                      </button>
                      <button onClick={() => abrirRenomear('arquivo', a.id, a.nome)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer" title="Renomear">
                        <i className="ri-edit-line"></i>
                      </button>
                      <button onClick={() => { excluirArquivo(a.id); mostrarToast(`Arquivo "${a.nome}" excluído.`); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-accent-50 text-accent-600 cursor-pointer" title="Excluir">
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

      {/* Modal upload */}
      {uploadModal && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setUploadModal(false)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Enviar arquivo</h3>
              <button onClick={() => setUploadModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer"><i className="ri-close-line text-lg"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Pasta de destino</label>
                <select value={uploadPasta} onChange={(e) => setUploadPasta(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  {pastas.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Arquivo</label>
                <input type="file" onChange={(e) => setArquivoSelecionado(e.target.files?.[0] || null)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary-100 file:text-primary-700 file:text-xs file:cursor-pointer cursor-pointer" />
                {arquivoSelecionado && (
                  <p className="text-xs text-foreground-500 mt-1">{arquivoSelecionado.name} · {formatarTamanho(arquivoSelecionado.size)}</p>
                )}
              </div>
              <p className="text-xs text-foreground-500">Formatos aceitos: PDF, DOCX, XLSX, PNG, JPG, MP4. Tamanho máximo: 100 MB.</p>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setUploadModal(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={confirmarUpload} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova pasta */}
      {novaPastaModal && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setNovaPastaModal(false)}>
          <div className="bg-background-50 rounded-xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Nova pasta</h3>
              <button onClick={() => setNovaPastaModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer"><i className="ri-close-line text-lg"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome da pasta</label>
                <input type="text" value={novaPastaNome} onChange={(e) => setNovaPastaNome(e.target.value)} placeholder="Ex.: Relatórios mensais" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setNovaPastaModal(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={confirmarNovaPasta} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal renomear */}
      {renomearModal && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setRenomearModal(null)}>
          <div className="bg-background-50 rounded-xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Renomear</h3>
              <button onClick={() => setRenomearModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer"><i className="ri-close-line text-lg"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Novo nome</label>
                <input type="text" value={renomearNome} onChange={(e) => setRenomearNome(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setRenomearModal(null)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={confirmarRenomear} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
