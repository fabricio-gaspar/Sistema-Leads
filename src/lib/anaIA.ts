import { supabase } from '@/lib/supabase';
import type { AnaliseMensagem } from '@/lib/tipos';

// Cliente das sugestões auxiliares da Ana. A execução comercial é centralizada
// em `ana-run`, no backend; estas chamadas nunca expõem chave de IA no browser.

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

// Gera a resposta de conversa da Ana para a mensagem do lead.
export async function gerarResposta(mensagem: string, contexto: ContextoLead = {}): Promise<string | null> {
  if (!mensagem.trim()) return null;
  const resposta = await comTimeout(
    invocar({ acao: 'responder', mensagem, contexto })
  );
  if (!resposta || !resposta.ok || !resposta.texto) return null;
  return resposta.texto;
}

// Analisa a intenção/sentimento da mensagem do lead usando a IA.
export async function analisarComIA(mensagem: string): Promise<AnaliseMensagem | null> {
  if (!mensagem.trim()) return null;
  const resposta = await comTimeout(invocar({ acao: 'analisar', mensagem }));
  if (!resposta || !resposta.ok || !resposta.analise) return null;
  return resposta.analise;
}

// Redige textos de proposta/follow-up personalizados pela IA.
export async function redigirTexto(tipo: 'proposta' | 'followup', contexto: ContextoLead = {}): Promise<string | null> {
  const resposta = await comTimeout(invocar({ acao: 'redigir', contexto: { ...contexto, tipo } }));
  if (!resposta || !resposta.ok || !resposta.texto) return null;
  return resposta.texto;
}

// Autocomplete assistido por IA: completa um trecho já digitado (descrição de
// produto, texto de proposta ou mensagem) sem nunca bloquear a digitação.
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
