import { useState } from 'react';
import type { Documento } from '@/mocks/businessData';
import { useAuth } from '@/hooks/useAuth';
import { useDocumentosStore } from '@/hooks/useDocumentosStore';

const statusDoc: Record<string, string> = {
  rascunho: 'bg-background-200 text-foreground-600',
  processando: 'bg-accent-100 text-accent-700',
  pronto: 'bg-secondary-100 text-secondary-700',
  ativo: 'bg-primary-100 text-primary-700',
  arquivado: 'bg-background-300 text-foreground-500',
  erro: 'bg-accent-500/20 text-accent-600',
};

function formatarTamanho(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentosTab() {
  const { docs, adicionar, excluir } = useDocumentosStore();
  const [toast, setToast] = useState('');
  const [docModal, setDocModal] = useState(false);
  const [docNome, setDocNome] = useState('');
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [detalhe, setDetalhe] = useState<Documento | null>(null);
  const { user } = useAuth();

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const enviarDocumento = () => {
    if (!docNome.trim()) {
      mostrarToast('Dê um nome ao documento.');
      return;
    }
    const nomeArquivo = arquivoSelecionado?.name || `${docNome.trim()}.pdf`;
    const novo: Documento = {
      id: `doc-${Date.now()}`,
      nome: docNome.trim(),
      categoria: 'Manual',
      formato: nomeArquivo.split('.').pop()?.toUpperCase() || 'PDF',
      tamanho: formatarTamanho(arquivoSelecionado?.size || 0),
      versao: 'v1',
      autor: user?.name || 'Você',
      data: new Date().toISOString().slice(0, 10),
      status: 'processando',
      tags: [],
    };
    adicionar(novo);
    setDocModal(false);
    setDocNome('');
    setArquivoSelecionado(null);
    mostrarToast('Documento enviado para processamento!');
  };

  const excluirDocumento = (d: Documento) => {
    excluir(d.id);
    mostrarToast(`Documento "${d.nome}" excluído.`);
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-600">Base de conhecimento usada pela Ana (RAG). Apenas documentos ativos e processados são usados.</p>
        <button onClick={() => setDocModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap">
          <i className="ri-upload-line"></i>
          Enviar documento
        </button>
      </div>

      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Documento</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Formato</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden lg:table-cell">Versão</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Status</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs w-24"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-background-100 hover:bg-background-50/50">
                  <td className="px-6 py-3.5">
                    <p className="font-medium text-foreground-900">{d.nome}</p>
                    <p className="text-foreground-500 text-xs">{d.categoria} · {d.tamanho}</p>
                  </td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell">{d.formato}</td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden lg:table-cell">{d.versao}</td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${statusDoc[d.status]}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex gap-1">
                      <button onClick={() => setDetalhe(d)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer" title="Visualizar">
                        <i className="ri-eye-line"></i>
                      </button>
                      <button onClick={() => excluirDocumento(d)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-accent-50 text-accent-600 cursor-pointer" title="Excluir">
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
          <div className="bg-background-50 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">{detalhe.nome}</h3>
                <p className="text-xs text-foreground-500">{detalhe.formato} · {detalhe.tamanho}</p>
              </div>
              <button onClick={() => setDetalhe(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-foreground-500">Categoria</span><span className="text-foreground-900">{detalhe.categoria}</span></div>
              <div className="flex justify-between"><span className="text-foreground-500">Versão</span><span className="text-foreground-900">{detalhe.versao}</span></div>
              <div className="flex justify-between"><span className="text-foreground-500">Autor</span><span className="text-foreground-900">{detalhe.autor}</span></div>
              <div className="flex justify-between"><span className="text-foreground-500">Data</span><span className="text-foreground-900">{detalhe.data}</span></div>
              <div className="flex justify-between"><span className="text-foreground-500">Status</span><span className="text-foreground-900">{detalhe.status}</span></div>
            </div>
          </div>
        </div>
      )}

      {docModal && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setDocModal(false)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Enviar documento</h3>
              <button onClick={() => setDocModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer"><i className="ri-close-line text-lg"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome do documento</label>
                <input type="text" value={docNome} onChange={(e) => setDocNome(e.target.value)} placeholder="Ex.: Manual de vendas" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Arquivo</label>
                <input type="file" onChange={(e) => setArquivoSelecionado(e.target.files?.[0] || null)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary-100 file:text-primary-700 file:text-xs file:cursor-pointer cursor-pointer" />
                {arquivoSelecionado && (
                  <p className="text-xs text-foreground-500 mt-1">{arquivoSelecionado.name} · {formatarTamanho(arquivoSelecionado.size)}</p>
                )}
              </div>
              <p className="text-xs text-foreground-500">Formatos aceitos: PDF, DOCX, XLSX, MD. O documento será processado pela Ana.</p>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setDocModal(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={enviarDocumento} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}