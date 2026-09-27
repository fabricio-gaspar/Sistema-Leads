import type { AnaliseMensagem, Intencao, ProximaAcao, Sentimento } from '@/lib/tipos';

// Qualificador determinístico (sem LLM externo). Converte a mensagem do lead
// em intenção, sentimento, score, confiança e próxima ação.

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function contem(texto: string, termos: string[]): boolean {
  return termos.some((t) => texto.includes(normalizar(t)));
}

export function analisarMensagemLead(mensagem: string): AnaliseMensagem {
  const m = normalizar(mensagem || '');

  let intencao: Intencao = 'NEUTRO';
  let sentimento: Sentimento = 'NEUTRO';
  let delta = 0;
  let confianca = 70;
  let proximaAcao: ProximaAcao = 'RESPONDER';
  let etapaSugerida: string | undefined;
  let motivoTransferencia: string | undefined;

  // Opt-out / encerramento (máxima prioridade)
  if (contem(m, ['nao quero', 'pare', 'remova', 'nao me chame', 'me esquece', 'sai da lista', 'opt out', 'descadastr', 'nao me mande'])) {
    return {
      intencao: 'OPT_OUT',
      sentimento: 'NEGATIVO',
      scoreInteresse: 0,
      confianca: 100,
      proximaAcao: 'ENCERRAR',
      etapaSugerida: 'Perdido',
      motivoTransferencia: 'Lead solicitou opt-out',
    };
  }

  // Reclamação / insatisfação
  if (contem(m, ['reclamacao', 'reclamo', 'ruim', 'pessimo', 'insatisfeito', 'problema', 'nao gostei', 'horrivel'])) {
    intencao = 'NEGATIVO';
    sentimento = 'NEGATIVO';
    proximaAcao = 'TRANSFERIR_HUMANO';
    motivoTransferencia = 'Reclamação / insatisfação';
  }

  // Agendamento / reunião. A sugestão nunca muda o funil por conta própria:
  // a transição operacional continua exigindo evidência e autorização no backend.
  if (contem(m, ['reuniao', 'ligar', 'agenda', 'call', 'conversa ao vivo', 'encontro', 'agendar', 'liga para mim'])) {
    intencao = intencao === 'NEUTRO' ? 'AGENDAMENTO' : intencao;
    delta += 25;
    confianca = 95;
    proximaAcao = 'AGENDAR';
    etapaSugerida = 'Reunião';
  }

  // Desconto / negociação
  if (contem(m, ['desconto', 'caro', 'melhor preco', 'negociar', 'condicao especial', 'mais barato', 'reduzir', 'abaixar'])) {
    if (intencao === 'NEUTRO') intencao = 'OBJECAO';
    delta += 15;
    sentimento = sentimento === 'NEUTRO' ? 'NEGATIVO' : sentimento;
    proximaAcao = 'TRANSFERIR_HUMANO';
    motivoTransferencia = 'Pedido de desconto / negociação';
  }

  // Orçamento / preço
  if (contem(m, ['orcamento', 'proposta', 'valor', 'preco', 'quanto custa', 'cotacao', 'quanto fica'])) {
    if (intencao === 'NEUTRO') intencao = 'ORCAMENTO';
    delta += 20;
    proximaAcao = 'CRIAR_ORCAMENTO';
    etapaSugerida = 'Orçamento';
  }

  // Interesse
  if (contem(m, ['quero', 'tenho interesse', 'preciso', 'me explica', 'gostaria de saber', 'como funciona', 'interessad', 'me interessa'])) {
    intencao = 'INTERESSE';
    delta += 20;
    sentimento = 'POSITIVO';
    proximaAcao = 'QUALIFICAR';
    etapaSugerida = 'Qualificando';
  }

  // Dúvida
  if (contem(m, ['duvida', 'pergunta', 'nao entendi', 'o que e', 'como faz', 'me tira uma duvida'])) {
    if (intencao === 'NEUTRO') intencao = 'DUVIDA';
    if (proximaAcao === 'RESPONDER') proximaAcao = 'RESPONDER';
  }

  // Urgência
  if (contem(m, ['urgente', 'hoje', 'agora', 'imediatamente', 'pra ontem', 'com urgencia', 'o quanto antes'])) {
    if (intencao === 'NEUTRO') intencao = 'INTERESSE';
    delta += 10;
    proximaAcao = 'TRANSFERIR_HUMANO';
    motivoTransferencia = 'Urgência detectada';
  }

  // Já tem fornecedor / agência
  if (contem(m, ['ja tenho fornecedor', 'ja tenho agencia', 'ja trabalho com', 'tenho fornecedor', 'ja fecho com'])) {
    if (intencao === 'NEUTRO') intencao = 'OBJECAO';
    proximaAcao = 'QUALIFICAR';
    delta += 5;
  }

  if (intencao === 'NEUTRO') {
    confianca = 55; // mensagem desconhecida → baixa confiança
    proximaAcao = 'RESPONDER';
  }

  const scoreInteresse = Math.min(100, Math.max(0, 50 + delta));

  return {
    intencao,
    sentimento,
    scoreInteresse,
    confianca,
    proximaAcao,
    etapaSugerida,
    motivoTransferencia,
  };
}

// Atalho: a análise sugere transferência para humano?
// `ehFallback` indica que a análise veio do qualificador determinístico (a IA real
// falhou/está indisponível). Nesse caso, a "confiança" é um artefato das
// palavras-chave e não deve disparar transferência — o fallback é o plano B e
// deve responder, não transferir mensagens comuns para o humano.
export function deveTransferir(
  analise: AnaliseMensagem,
  limiteConfianca: number,
  scoreMinimoHandoff: number,
  ehFallback = false
): boolean {
  if (analise.proximaAcao === 'TRANSFERIR_HUMANO' || analise.proximaAcao === 'ENCERRAR') return true;
  if (!ehFallback && analise.confianca < limiteConfianca) return true;
  if (analise.scoreInteresse >= scoreMinimoHandoff) return true;
  return false;
}
