import { getConhecimentoSnapshot } from '@/hooks/useConhecimentoStore';
import type { EntradaConhecimento } from '@/mocks/conhecimentoData';
import { gerarResposta } from '@/lib/anaIA';

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const stopWords = new Set([
  'ola', 'oi', 'bom', 'boa', 'dia', 'tarde', 'noite', 'tudo', 'bem', 'obrigado', 'obrigada',
  'quero', 'gostaria', 'pode', 'poderia', 'me', 'voce', 'sua', 'seu', 'com', 'pra', 'para',
  'sobre', 'uma', 'uma', 'um', 'uns', 'de', 'do', 'da', 'das', 'dos', 'que', 'qual', 'quais',
  'como', 'quanto', 'quando', 'onde', 'sim', 'nao', 'seria', 'estou', 'esta', 'ate', 'posso',
]);

export interface RespostaAna {
  texto: string;
  entrada?: EntradaConhecimento;
  origem: 'ia' | 'conhecimento' | 'fallback';
}

export interface ContextoConversa {
  nome?: string;
  empresa?: string;
}

// Fallback determinístico (base de conhecimento + frases genéricas). Mantido
// como plano B quando a IA real está indisponível ou sem chave configurada.
function responderLocal(mensagem: string): RespostaAna {
  const limpo = normalizar(mensagem);
  const tokens = limpo
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !stopWords.has(t));

  let melhor: { entrada: EntradaConhecimento; pontos: number } | null = null;

  for (const entrada of getConhecimentoSnapshot()) {
    if (entrada.status !== 'ativo') continue;

    const termos = [...entrada.palavrasChave, entrada.titulo].map(normalizar);
    let pontos = 0;

    for (const token of tokens) {
      for (const termo of termos) {
        if (termo.includes(token) || token.includes(termo)) {
          pontos += 1;
        }
      }
    }

    if (pontos > 0 && (!melhor || pontos > melhor.pontos)) {
      melhor = { entrada, pontos };
    }
  }

  if (melhor && melhor.pontos >= 2) {
    return {
      texto: melhor.entrada.conteudo,
      entrada: melhor.entrada,
      origem: 'conhecimento',
    };
  }

  const fallbacks = [
    'Entendi! Obrigada pelo contato. Pode me detalhar um pouco mais o que você precisa para eu te ajudar da melhor forma?',
    'Perfeito, registrei sua mensagem. Para te ajudar com precisão, você poderia me contar um pouco mais sobre o seu objetivo?',
    'Obrigada pela mensagem! Estou verificando aqui e já retorno com a informação. Enquanto isso, tem algum detalhe a mais que queira acrescentar?',
  ];
  const indice = limpo.length % fallbacks.length;
  return { texto: fallbacks[indice], origem: 'fallback' };
}

// Resposta da Ana: tenta primeiro a IA real (Claude/Anthropic) e, se falhar,
// cai no fallback determinístico. Nunca lança erro para não quebrar o chat.
export async function responderMensagem(
  mensagem: string,
  contexto: ContextoConversa = {}
): Promise<RespostaAna> {
  const textoIA = await gerarResposta(mensagem, { nome: contexto.nome, empresa: contexto.empresa });
  if (textoIA) {
    return { texto: textoIA, origem: 'ia' };
  }
  return responderLocal(mensagem);
}