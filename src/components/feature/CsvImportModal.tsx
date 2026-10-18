import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { detectarMapeamento } from '@/lib/csv';
import {
  detectLeadImportFormat,
  LeadImportParseError,
  parseLeadImportFile,
  type LeadImportFormat,
} from '@/lib/leadImportFile';
import AccessibleDialog from './AccessibleDialog';

export interface CampoImportacao {
  chave: string;
  rotulo: string;
  obrigatorio?: boolean;
  aliases?: string[];
}

export interface ResultadoImportacao {
  importados: number;
  duplicados: number;
  invalidos?: number;
  listId?: string;
  listIds?: string[];
  listName?: string;
  recovered?: boolean;
  refreshPending?: boolean;
}

interface CsvImportModalProps {
  titulo: string;
  subtitulo: string;
  aviso?: string;
  confirmarLotePendente?: boolean;
  onConfirmarLotePendente?: () => ResultadoImportacao | Promise<ResultadoImportacao>;
  selectedFile?: File | null;
  selectionRevision?: number;
  onRequestFile?: () => void;
  onRecuperarImportacao?: () => ResultadoImportacao | Promise<ResultadoImportacao>;
  onAbrirLeadsImportados?: (resultado: ResultadoImportacao) => void;
  campos: CampoImportacao[];
  acceptedFormats?: LeadImportFormat[];
  onImportar: (linhas: Record<string, string>[], metadata: {
    format: LeadImportFormat;
    fileName: string;
    onProgress: (current: number, total: number) => void;
  }) => ResultadoImportacao | Promise<ResultadoImportacao>;
  onClose: () => void;
}

// Wizard reutilizável de importação tabular: seleciona o arquivo, detecta as
// colunas automaticamente, permite ajustar o mapeamento, mostra uma prévia e
// chama onImportar com as linhas já mapeadas para { chave: valor }.
export default function CsvImportModal({
  titulo,
  subtitulo,
  aviso,
  confirmarLotePendente = false,
  onConfirmarLotePendente,
  selectedFile = null,
  selectionRevision = 0,
  onRequestFile,
  onRecuperarImportacao,
  onAbrirLeadsImportados,
  campos,
  acceptedFormats = ['csv'],
  onImportar,
  onClose,
}: CsvImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const readGeneration = useRef(0);
  const externalSelectionRevision = useRef(0);
  useEffect(() => () => { readGeneration.current += 1; }, []);
  const [arquivoNome, setArquivoNome] = useState('');
  const [cabecalho, setCabecalho] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<string[][]>([]);
  const [formato, setFormato] = useState<LeadImportFormat>('csv');
  const [avisosArquivo, setAvisosArquivo] = useState<string[]>([]);
  const [mapeamento, setMapeamento] = useState<Record<string, number>>({});
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState<{ current: number; total: number } | null>(null);
  const alteracoesBloqueadas = importando || confirmarLotePendente;

  const aoSelecionar = useCallback(async (arquivo: File) => {
    if (alteracoesBloqueadas) return;
    const generation = ++readGeneration.current;
    setErro('');
    setResultado(null);
    setArquivoNome('');
    setCabecalho([]);
    setLinhas([]);
    setAvisosArquivo([]);
    setMapeamento({});
    try {
      const detectedFormat = detectLeadImportFormat(arquivo);
      if (!acceptedFormats.includes(detectedFormat)) {
        throw new LeadImportParseError('Este importador aceita somente arquivos CSV.');
      }
      const { cabecalho: cab, linhas: lns, format, warnings } = await parseLeadImportFile(arquivo);
      if (readGeneration.current !== generation) return;
      if (cab.length === 0 || lns.length === 0) throw new LeadImportParseError('Arquivo vazio ou sem linhas de dados.');
      setCabecalho(cab);
      setLinhas(lns);
      setFormato(format);
      setAvisosArquivo(warnings);
      setArquivoNome(arquivo.name);
      setMapeamento(detectarMapeamento(cab, campos));
    } catch (error) {
      if (readGeneration.current !== generation) return;
      setErro(error instanceof Error ? error.message : 'Não foi possível ler o arquivo. Verifique o formato.');
    }
  }, [acceptedFormats, alteracoesBloqueadas, campos]);

  useEffect(() => {
    // A confirmação pendente deve reenviar o lote original. Nunca releia o
    // arquivo externo nesse estado: ele poderia ocultar a ação de recuperação.
    if (confirmarLotePendente || !selectedFile || selectionRevision <= 0 || selectionRevision === externalSelectionRevision.current) return;
    externalSelectionRevision.current = selectionRevision;
    void aoSelecionar(selectedFile);
  }, [aoSelecionar, confirmarLotePendente, selectedFile, selectionRevision]);

  const linhasMapeadas = useMemo(() => linhas.map((linha) => {
    const obj: Record<string, string> = {};
    campos.forEach((c) => {
      const idx = mapeamento[c.chave];
      obj[c.chave] = idx !== undefined && linha[idx] !== undefined ? linha[idx] : '';
    });
    return obj;
  }), [campos, linhas, mapeamento]);

  const obrigatoriasFaltando = campos.filter(
    (c) => c.obrigatorio && mapeamento[c.chave] === undefined
  );

  const importar = async () => {
    if (importando) return;
    if (obrigatoriasFaltando.length > 0) {
      setErro(`Mapeie as colunas obrigatórias: ${obrigatoriasFaltando.map((c) => c.rotulo).join(', ')}.`);
      return;
    }
    setErro('');
    setImportando(true);
    try {
      const result = await onImportar(linhasMapeadas, {
        format: formato,
        fileName: arquivoNome,
        onProgress: (current, total) => setProgresso({ current, total }),
      });
      setResultado(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível confirmar a importação.';
      setErro(message || 'Não foi possível confirmar a importação.');
    } finally {
      setImportando(false);
      setProgresso(null);
    }
  };

  const confirmarPendente = async () => {
    if (importando || !onConfirmarLotePendente) return;
    setErro('');
    setImportando(true);
    try {
      setResultado(await onConfirmarLotePendente());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível confirmar a importação.';
      setErro(message || 'Não foi possível confirmar a importação.');
    } finally {
      setImportando(false);
    }
  };

  const recuperarImportacao = async () => {
    if (importando || !onRecuperarImportacao) return;
    setErro('');
    setImportando(true);
    try {
      setResultado(await onRecuperarImportacao());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível atualizar os dados importados.';
      setErro(message || 'Não foi possível atualizar os dados importados.');
    } finally {
      setImportando(false);
    }
  };

  const solicitarArquivo = () => {
    if (alteracoesBloqueadas) return;
    if (onRequestFile) {
      onRequestFile?.();
      return;
    }
    fileRef.current?.click();
  };

  const reiniciar = () => {
    if (alteracoesBloqueadas) return;
    readGeneration.current += 1;
    setArquivoNome('');
    setCabecalho([]);
    setLinhas([]);
    setAvisosArquivo([]);
    setMapeamento({});
    setResultado(null);
    setErro('');
  };

  return (
    <AccessibleDialog title={titulo} onClose={() => { if (!importando) onClose(); }} className="w-full max-w-2xl">
      <div className="bg-background-50 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between sticky top-0 bg-background-50 z-10">
          <div>
            <h3 className="font-heading font-bold text-foreground-950">{titulo}</h3>
            <p className="text-xs text-foreground-500">{subtitulo}</p>
          </div>
          <button onClick={onClose} disabled={importando} aria-label="Fechar importação" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {aviso && (
            <div className="flex items-start gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5 text-xs text-primary-800">
              <i className="ri-shield-check-line mt-0.5" aria-hidden="true" />
              <span>{aviso}</span>
            </div>
          )}
          {confirmarLotePendente && !resultado && (
            <div className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2.5 text-xs text-accent-800">
              <i className="ri-time-line mt-0.5" aria-hidden="true" />
              <span>Há um lote sem confirmação. Este botão reenviará exatamente o lote original, sem criar outro.</span>
            </div>
          )}
          {!cabecalho.length && confirmarLotePendente && onConfirmarLotePendente ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-time-line text-accent-700 text-2xl" aria-hidden="true"></i>
              </div>
              <p className="text-sm text-foreground-700 mb-2">Há um lote de importação aguardando confirmação.</p>
              <p className="text-xs text-foreground-500 mb-4">A confirmação usa exatamente o lote já preparado nesta página; nenhum novo arquivo ou lote será criado.</p>
              <button
                onClick={confirmarPendente}
                disabled={importando}
                className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importando ? <i className="ri-loader-4-line mr-1.5 animate-spin" /> : <i className="ri-shield-check-line mr-1.5" />}
                {importando ? 'Confirmando no banco...' : 'Confirmar lote original'}
              </button>
            </div>
          ) : !cabecalho.length && (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-background-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-file-upload-line text-foreground-400 text-2xl"></i>
              </div>
              <p className="text-sm text-foreground-600 mb-4">
                Envie {acceptedFormats.includes('xlsx') ? 'um arquivo CSV ou Excel (.xlsx)' : 'um arquivo CSV'}. As colunas serão detectadas e mapeadas automaticamente.
              </p>
              {!onRequestFile && <input
                ref={fileRef}
                type="file"
                accept={acceptedFormats.includes('xlsx') ? '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : '.csv,text/csv'}
                className="hidden"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) void aoSelecionar(arquivo);
                  e.target.value = '';
                }}
              />}
              <button
                onClick={solicitarArquivo}
                disabled={alteracoesBloqueadas}
                className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className="ri-file-upload-line mr-2"></i>
                Selecionar arquivo {acceptedFormats.includes('xlsx') ? 'CSV ou Excel' : 'CSV'}
              </button>
            </div>
          )}

          {cabecalho.length > 0 && !resultado && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground-700 flex items-center gap-2">
                  <i className="ri-file-list-3-line text-primary-600"></i>
                  {arquivoNome}
                </span>
                <button onClick={reiniciar} disabled={alteracoesBloqueadas} className="text-xs font-medium text-foreground-500 hover:text-foreground-700 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50">
                  <i className="ri-refresh-line mr-1"></i>Trocar arquivo
                </button>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-foreground-800 mb-2">Mapeamento de colunas</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {campos.map((c) => (
                    <div key={c.chave} className="flex items-center gap-2">
                      <label htmlFor={`${fieldId}-${c.chave}`} className="w-32 flex-shrink-0 text-sm text-foreground-700">
                        {c.rotulo}
                        {c.obrigatorio && <span className="text-accent-600"> *</span>}
                      </label>
                      <select
                        id={`${fieldId}-${c.chave}`}
                        value={mapeamento[c.chave] !== undefined ? String(mapeamento[c.chave]) : ''}
                        onChange={(e) =>
                          setMapeamento((prev) => ({
                            ...prev,
                            [c.chave]: e.target.value === '' ? undefined : Number(e.target.value),
                          }))
                        }
                        disabled={alteracoesBloqueadas}
                        className={`flex-1 px-3 py-2 bg-background-50 border rounded-lg text-sm cursor-pointer ${
                          c.obrigatorio && mapeamento[c.chave] === undefined
                            ? 'border-accent-400'
                            : 'border-background-300'
                        } text-foreground-900`}
                      >
                        <option value="">— não importar —</option>
                        {cabecalho.map((col, i) => (
                          <option key={i} value={i}>{col || `(coluna ${i + 1})`}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-foreground-800">Prévia</h4>
                  <span className="text-xs text-foreground-500">{linhas.length} linha(s) no total</span>
                </div>
                <div className="border border-background-200/70 rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-background-100/50 border-b border-background-200/70">
                        {campos.map((c) => (
                          <th key={c.chave} className="text-left px-3 py-2 text-foreground-500 font-medium whitespace-nowrap">
                            {c.rotulo}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {linhasMapeadas.slice(0, 5).map((l, i) => (
                        <tr key={i} className="border-b border-background-100 last:border-0">
                          {campos.map((c) => (
                            <td key={c.chave} className="px-3 py-2 text-foreground-700 whitespace-nowrap max-w-[160px] truncate">
                              {l[c.chave] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-foreground-400 mt-1.5">Exibindo as 5 primeiras linhas.</p>
              </div>
            </>
          )}

          {resultado && (
            <div className="text-center py-6">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${resultado.importados > 0 ? 'bg-primary-100' : 'bg-accent-100'}`}>
                <i className={`text-2xl ${resultado.importados > 0 ? 'ri-check-line text-primary-600' : 'ri-information-line text-accent-600'}`}></i>
              </div>
              <p className="text-base font-semibold text-foreground-900">
                {resultado.refreshPending
                  ? 'Lote confirmado; atualização pendente'
                  : resultado.recovered
                    ? 'Lote confirmado'
                    : resultado.importados > 0
                      ? `${resultado.importados} registro(s) importado(s)`
                  : 'Nada foi importado'}
              </p>
              <p className="text-sm text-foreground-500 mt-1">
                {resultado.refreshPending
                  ? 'Os dados foram gravados, mas a carteira ainda não pôde ser atualizada nesta tela. Atualize antes de abrir os leads.'
                  : resultado.duplicados > 0 ? `${resultado.duplicados} duplicado(s) não foram enviados.` : 'Nenhum duplicado encontrado.'}
                {resultado.invalidos ? ` ${resultado.invalidos} linha(s) inválida(s) não foram enviadas.` : ''}
              </p>
              <div className="mt-5 flex justify-center gap-2">
                {resultado.refreshPending && onRecuperarImportacao && <button onClick={() => void recuperarImportacao()} disabled={importando} className="px-4 py-2.5 border border-primary-300 bg-primary-50 text-primary-800 rounded-lg text-sm font-semibold hover:bg-primary-100 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50">
                  {importando ? 'Atualizando…' : 'Atualizar dados'}
                </button>}
                {!resultado.refreshPending && (resultado.listId || resultado.listIds?.length) && onAbrirLeadsImportados && <button onClick={() => onAbrirLeadsImportados(resultado)} disabled={importando} className="px-4 py-2.5 border border-primary-300 bg-primary-50 text-primary-800 rounded-lg text-sm font-semibold hover:bg-primary-100 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50">
                  Ver leads importados
                </button>}
                <button onClick={reiniciar} disabled={importando} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50">
                  Importar outro
                </button>
                <button onClick={onClose} disabled={importando} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50">
                  Concluir
                </button>
              </div>
            </div>
          )}

          {erro && (
            <div className="bg-accent-50 border border-accent-200 text-accent-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <i className="ri-error-warning-line"></i>
              {erro}
            </div>
          )}
          {!erro && avisosArquivo.map((aviso) => (
            <div key={aviso} role="status" className="bg-accent-50 border border-accent-200 text-accent-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <i className="ri-alert-line mt-0.5" aria-hidden="true"></i>
              <span>{aviso}</span>
            </div>
          ))}
        </div>

        {cabecalho.length > 0 && !resultado && (
          <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
            <button onClick={onClose} disabled={importando} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50">
              Cancelar
            </button>
            <button
              onClick={importar}
              disabled={linhas.length === 0 || importando || obrigatoriasFaltando.length > 0}
              className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
            >
              {importando ? <i className="ri-loader-4-line mr-1.5 animate-spin"></i> : <i className="ri-download-2-line mr-1.5"></i>}
              {importando
                ? progresso ? `Importando lote ${progresso.current} de ${progresso.total}...` : 'Confirmando no banco...'
                : confirmarLotePendente ? 'Confirmar lote original' : `Importar ${linhas.length} linha(s)`}
            </button>
          </div>
        )}
      </div>
    </AccessibleDialog>
  );
}
