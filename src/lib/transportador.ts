import { supabase } from '@/lib/supabase';
import { getConfigSnapshot } from '@/hooks/useConfiguracaoStore';
import type { ConfiguracaoRuntime, ModoExecucao } from '@/lib/tipos';

// Camada única de saída da Ana. Decide, para cada envio, se a mensagem sai de
// verdade (API real sandbox/produção) ou é apenas simulada localmente, e registra
// a decisão. Substitui a antiga prática de escrever direto na conversa em vários
// pontos espalhados pelo fluxo comercial.

// Normaliza o nome do canal para a chave do módulo de integração.
export function chaveModulo(canal: string): string {
  const c = canal.toLowerCase();
  if (c.includes('email') || c.includes('e-mail')) return 'email';
  return 'whatsapp';
}

export interface ResolucaoTransporte {
  modo: ModoExecucao;
  usarApi: boolean;
  estado: 'DESLIGADO' | 'SANDBOX' | 'ATIVO';
  temCredenciais: boolean;
}

// Decide, para um canal, se o envio deve chamar a API (sandbox ou produção)
// ou ser apenas simulado localmente.
export function resolverTransportador(config: ConfiguracaoRuntime, canal: string): ResolucaoTransporte {
  const chave = chaveModulo(canal);
  const modulo = config.estadosModulos?.[chave] ?? { estado: 'DESLIGADO', temCredenciais: false };
  const modo = config.modoExecucao ?? 'DEMO';
  const usarApi = modo !== 'DEMO' && modulo.estado !== 'DESLIGADO' && modulo.temCredenciais;
  return { modo, usarApi, estado: modulo.estado, temCredenciais: modulo.temCredenciais };
}

// Em SANDBOX, nenhum lead real pode receber mensagem: só contatos marcados
// como "de teste" são liberados (regra de ouro do modo de teste).
export function contatoPermitidoNoSandbox(config: ConfiguracaoRuntime, contato: string): boolean {
  if (config.modoExecucao !== 'SANDBOX') return true;
  const alvo = (contato || '').toLowerCase().trim();
  if (!alvo) return false;
  const teste = (config.contatosTeste || []).map((t) => t.toLowerCase().trim());
  return teste.includes(alvo);
}

export interface ResultadoEnvioApi {
  enviado: boolean;
  id?: string;
  erro?: string;
  detalhe?: string;
  provedor?: string;
}

// Extrai a mensagem real de um erro retornado por `supabase.functions.invoke`.
// Em erros HTTP (non-2xx), o Supabase lança um `FunctionsHttpError` cujo `context`
// é um `Response` com o corpo JSON que a Edge Function devolveu (ex.: o `detalhe`
// do porquê a Z-API recusou). Sem isso, só veríamos a mensagem genérica
// "Edge Function returned a non-2xx status code".
export async function detalheDoErroDeFuncao(error: unknown): Promise<string> {
  const e = error as { context?: Response; message?: string } | null | undefined;
  if (e?.context && typeof e.context.json === 'function') {
    try {
      const corpo = await e.context.json();
      if (corpo && typeof corpo === 'object') {
        const obj = corpo as Record<string, unknown>;
        if (typeof obj.detalhe === 'string' && obj.detalhe) return obj.detalhe;
        if (typeof obj.erro === 'string' && obj.erro) return obj.erro;
        const json = JSON.stringify(corpo);
        if (json && json !== '') return json;
      } else if (typeof corpo === 'string' && corpo.trim()) {
        return corpo;
      }
    } catch {
      // corpo não era JSON ou já foi consumido; cai no fallback abaixo
    }
  }
  return e?.message || 'Falha ao chamar a função de envio.';
}

// Dispara a Edge Function correspondente e devolve o resultado real (sucesso com
// ID retornado pelo provedor, ou o erro/detalhe) para o chamador validar de ponta
// a ponta. O `modo` informa ao backend se deve usar credenciais de sandbox ou
// produção.
export async function enviarViaApi(
  canal: string,
  dados: { para: string; texto: string; assunto?: string; leadId?: string }
): Promise<ResultadoEnvioApi> {
  const fn = chaveModulo(canal) === 'email' ? 'enviar-email' : 'enviar-whatsapp';
  const snapshot = getConfigSnapshot();
  const modo = snapshot.modoExecucao;
  const provedor = snapshot.provedorWhatsapp;

  try {
    const { data, error } = await supabase.functions.invoke(fn, {
      body: { ...dados, modo, provedor },
    });

    if (error) {
      return { enviado: false, erro: await detalheDoErroDeFuncao(error) };
    }

    return {
      enviado: !!data?.enviado,
      id: data?.id,
      erro: data?.erro,
      detalhe: data?.detalhe,
      provedor: data?.provedor,
    };
  } catch (err) {
    return {
      enviado: false,
      erro: err instanceof Error ? err.message : 'erro_interno',
    };
  }
}
