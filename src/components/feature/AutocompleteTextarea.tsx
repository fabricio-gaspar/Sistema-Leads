import { useState } from 'react';
import { autocompletarTexto } from '@/lib/anaIA';

interface AutocompleteTextareaProps {
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  tipo?: 'produto' | 'proposta' | 'mensagem';
  contexto?: Record<string, string>;
}

// Textarea com autocomplete assistido por IA. O botão "Completar com IA" chama
// a Edge Function ana-ia e mostra uma sugestão opcional — nunca trava a
// digitação e cai de forma elegante quando a IA está indisponível.
export default function AutocompleteTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength,
  tipo = 'mensagem',
  contexto = {},
}: AutocompleteTextareaProps) {
  const [gerando, setGerando] = useState(false);
  const [sugestao, setSugestao] = useState('');
  const [erro, setErro] = useState('');

  const gerar = async () => {
    if (!value.trim()) {
      setErro('Digite um trecho para a IA completar.');
      return;
    }
    setGerando(true);
    setErro('');
    setSugestao('');
    const resultado = await autocompletarTexto(value, { ...contexto, tipo });
    setGerando(false);
    if (resultado) {
      setSugestao(resultado);
    } else {
      setErro('IA indisponível no momento. Você pode continuar digitando normalmente.');
    }
  };

  const usarSugestao = () => {
    onChange(sugestao);
    setSugestao('');
  };

  const anexarSugestao = () => {
    const separador = value && !value.endsWith('\n') ? '\n' : '';
    onChange(value + separador + sugestao);
    setSugestao('');
  };

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 resize-none"
      />
      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
        <button
          onClick={gerar}
          disabled={gerando}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary-100 hover:bg-secondary-200 disabled:opacity-60 text-secondary-800 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          {gerando ? (
            <span className="w-3.5 h-3.5 border-2 border-secondary-400/30 border-t-secondary-600 rounded-full animate-spin"></span>
          ) : (
            <i className="ri-sparkling-2-line"></i>
          )}
          {gerando ? 'Gerando...' : 'Completar com IA'}
        </button>
        {erro && <span className="text-xs text-foreground-500">{erro}</span>}
      </div>

      {sugestao && (
        <div className="mt-2 bg-primary-50 border border-primary-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-primary-700 mb-1.5 flex items-center gap-1.5">
            <i className="ri-sparkling-2-line"></i>
            Sugestão da IA
          </p>
          <p className="text-sm text-foreground-700 whitespace-pre-line">{sugestao}</p>
          <div className="mt-2.5 flex gap-2 flex-wrap">
            <button
              onClick={usarSugestao}
              className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Substituir
            </button>
            <button
              onClick={anexarSugestao}
              className="px-3 py-1.5 border border-primary-300 text-primary-700 rounded-md text-xs font-semibold hover:bg-primary-100 cursor-pointer whitespace-nowrap"
            >
              Anexar ao final
            </button>
            <button
              onClick={() => setSugestao('')}
              className="px-3 py-1.5 text-foreground-500 hover:text-foreground-700 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap"
            >
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}