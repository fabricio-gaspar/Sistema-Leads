export interface RespostaAna {
  texto: string;
  origem: 'ia' | 'fallback';
}

export interface ContextoConversa {
  nome?: string;
  empresa?: string;
}

// Mantém o contrato usado por clientes legados, sem produzir uma mensagem
// sintética. Quem invocar este helper deve tratar texto vazio como ausência de
// resposta e aguardar ana-run, que é a autoridade automática do sistema.
export async function responderMensagem(
  _mensagem: string,
  _contexto: ContextoConversa = {}
): Promise<RespostaAna> {
  return { texto: '', origem: 'fallback' };
}
