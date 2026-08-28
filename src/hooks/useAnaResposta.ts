import { gerarResposta } from '@/lib/anaIA';

export interface RespostaAna { texto: string; origem: 'ia' | 'fallback'; }
export interface ContextoConversa { nome?: string; empresa?: string; }

// Nunca reutiliza conhecimento de outra empresa como fallback. A resposta
// definitiva vem da configuração publicada da Ana no servidor; se ela estiver
// indisponível, apenas coleta contexto sem afirmar fatos comerciais.
function responderLocal(mensagem: string): RespostaAna {
  const prompts = [
    'Entendi. Para eu preparar um orçamento adequado, pode me informar a necessidade, o prazo e a quantidade ou escopo desejado?',
    'Perfeito. Vou organizar o contexto para o time. Qual resultado você espera alcançar e qual o prazo ideal?',
    'Obrigada pela mensagem. Pode detalhar o objetivo para que eu encaminhe a melhor próxima etapa?',
  ];
  return { texto: prompts[mensagem.trim().length % prompts.length], origem: 'fallback' };
}

export async function responderMensagem(mensagem: string, contexto: ContextoConversa = {}): Promise<RespostaAna> {
  const textoIA = await gerarResposta(mensagem, { nome: contexto.nome, empresa: contexto.empresa });
  return textoIA ? { texto: textoIA, origem: 'ia' } : responderLocal(mensagem);
}
