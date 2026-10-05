import { useEffect, useId, useRef, useState } from 'react';
import { CSV_MAX_BYTES, CsvParseError, parseCsv, detectarMapeamento } from '@/lib/csv';
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
}

interface CsvImportModalProps {
  titulo: string;
  subtitulo: string;
  aviso?: string;
  confirmarLotePendente?: boolean;
  onConfirmarLotePendente?: () => ResultadoImportacao | Promise<ResultadoImportacao>;
  campos: CampoImportacao[];
  onImportar: (linhas: Record<string, string>[]) => ResultadoImportacao | Promise<ResultadoImportacao>;
  onClose: () => void;
}

// Wizard reutilizável de importação CSV: seleciona o arquivo, detecta as
// colunas automaticamente, permite ajustar o mapeamento, mostra uma prévia e
// chama onImportar com as linhas já mapeadas para { chave: valor }.
export default function CsvImportModal({
  titulo,
  subtitulo,
  aviso,
  confirmarLotePendente = false,
  onConfirmarLotePendente,
  campos,
  onImportar,
  onClose,
}: CsvImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const readerRef = useRef<FileReader | null>(null);
  const readGeneration = useRef(0);
  useEffect(() => () => { readGeneration.current += 1; readerRef.current?.abort(); }, []);
  const [arquivoNome, setArquivoNome] = useState('');
  const [cabecalho, setCabecalho] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<string[][]>([]);
  const [mapeamento, setMapeamento] = useState<Record<string, number>>({});
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [importando, setImportando] = useState(false);
  const alteracoesBloqueadas = importando || confirmarLotePendente;

  const aoSelecionar = (arquivo: File) => {
    if (alteracoesBloqueadas) return;
    const generation = ++readGeneration.current;
    readerRef.current?.abort();
    setErro('');
    setResultado(null);
    setArquivoNome('');
    setCabecalho([]);
    setLinhas([]);
    setMapeamento({});
    if (arquivo.size > CSV_MAX_BYTES) { setErro('O arquivo CSV deve ter no máximo 5 MB.'); return; }
    const leitor = new FileReader();
    readerRef.current = leitor;
    leitor.onload = () => {
      if (readGeneration.current !== generation) return;
      try {
        const { cabecalho: cab, linhas: lns } = parseCsv(String(leitor.result || ''));
        if (cab.length === 0 || lns.length === 0) {
          setErro('Arquivo vazio ou sem linhas de dados.');
          setCabecalho([]);
          setLinhas([]);
          return;
        }
        setCabecalho(cab);
        setLinhas(lns);
        setArquivoNome(arquivo.name);
        setMapeamento(detectarMapeamento(cab, campos));
      } catch (error) {
        setErro(error instanceof CsvParseError ? error.message : 'Não foi possível ler o arquivo. Verifique o formato CSV.');
      }
    };
    leitor.onerror = () => { if (readGeneration.current === generation) setErro('Falha ao ler o arquivo.'); };
    leitor.readAsText(arquivo);
  };

  const linhasMapeadas = linhas.map((linha) => {
    const obj: Record<string, string> = {};
    campos.forEach((c) => {
      const idx = mapeamento[c.chave];
      obj[c.chave] = idx !== undefined && linha[idx] !== undefined ? linha[idx] : '';
    });
    return obj;
  });

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
      const result = await onImportar(linhasMapeadas);
      setResultado(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível confirmar a importação.';
      setErro(message || 'Não foi possível confirmar a importação.');
    } finally {
      setImportando(false);
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

  const reiniciar = () => {
    if (alteracoesBloqueadas) return;
    readGeneration.current += 1;
    readerRef.current?.abort();
    setArquivoNome('');
    setCabecalho([]);
    setLinhas([]);
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
              <p className="text-sm text-foreground-700 mb-2">Há um lote CSV aguardando confirmação.</p>
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
                Envie um arquivo CSV. As colunas serão detectadas e mapeadas automaticamente.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) aoSelecionar(arquivo);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={alteracoesBloqueadas}
                className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className="ri-file-upload-line mr-2"></i>
                Selecionar arquivo CSV
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
                {resultado.importados > 0
                  ? `${resultado.importados} registro(s) importado(s)`
                  : 'Nada foi importado'}
              </p>
              <p className="text-sm text-foreground-500 mt-1">
                {resultado.duplicados > 0 ? `${resultado.duplicados} duplicado(s) não foram enviados.` : 'Nenhum duplicado encontrado.'}
                {resultado.invalidos ? ` ${resultado.invalidos} linha(s) inválida(s) não foram enviadas.` : ''}
              </p>
              <div className="mt-5 flex justify-center gap-2">
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
              {importando ? 'Confirmando no banco...' : confirmarLotePendente ? 'Confirmar lote original' : `Importar ${linhas.length} linha(s)`}
            </button>
          </div>
        )}
      </div>
    </AccessibleDialog>
  );
}
