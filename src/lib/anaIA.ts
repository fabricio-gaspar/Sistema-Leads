import { supabase } from '@/lib/supabase';
import type { AnaliseMensagem } from '@/lib/tipos';

// O browser pode oferecer auxílio de edição sob ação explícita do usuário, mas
// não pode decidir, redigir ou responder automaticamente por uma conversa.
// ana-run é a única autoridade para essas ações no backend.
const TIMEOUT_MS = 9000;

export interface ContextoLead {
  nome?: string;
  empresa?: string;
  segmento?: string;
  servico?: string;
  numero?: string;
  valor?: string;
}

interface RespostaIA {
  ok?: boolean;
  texto?: string;
  analise?: AnaliseMensagem;
  erro?: string;
}

function comTimeout<T>(promessa: Promise<T>): Promise<T | null> {
  return Promise.race([
    promessa,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
  ]);
}

async function invocar(body: Record<string, unknown>): Promise<RespostaIA | null> {
  try {
    const { data, error } = await supabase.functions.invoke('ana-ia', { body });
    if (error) return null;
    return (data as RespostaIA) || null;
  } catch {
    return null;
  }
}

// Contrato legado preservado: o navegador nunca gera uma resposta de conversa.
export async function gerarResposta(_mensagem: string, _contexto: ContextoLead = {}): Promise<string | null> {
  return null;
}

// Contrato legado preservado: a análise que governa um lead só ocorre em ana-run.
export async function analisarComIA(_mensagem: string): Promise<AnaliseMensagem | null> {
  return null;
}

// Contrato legado preservado: follow-ups e propostas automáticas não são
// redigidos pelo cliente nem enviados a partir dele.
export async function redigirTexto(
  _tipo: 'proposta' | 'followup',
  _contexto: ContextoLead = {}
): Promise<string | null> {
  return null;
}

// Autocomplete é uma sugestão para texto já iniciado por uma pessoa. Ele não
// envia nem grava mensagens, e continua sujeito ao fluxo humano da Central.
export async function autocompletarTexto(
  trecho: string,
  contexto: ContextoLead & { tipo?: 'produto' | 'proposta' | 'mensagem' } = {}
): Promise<string | null> {
  if (!trecho.trim()) return null;
  const resposta = await comTimeout(
    invocar({ acao: 'autocompletar', contexto: { ...contexto, trecho } })
  );
  if (!resposta || !resposta.ok || !resposta.texto) return null;
  return resposta.texto;
}
