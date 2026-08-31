import { useState } from 'react';
import type { Integracao, CampoIntegracao } from '@/mocks/businessData';
import { useIntegracoesStore } from '@/hooks/useIntegracoesStore';
import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

const statusMeta: Record<string, { cor: string; label: string }> = {
  conectado: { cor: 'bg-primary-100 text-primary-700', label: 'Conectado' },
  pendente: { cor: 'bg-accent-100 text-accent-700', label: 'Pendente' },
  sandbox: { cor: 'bg-secondary-100 text-secondary-700', label: 'Sandbox' },
  erro: { cor: 'bg-accent-500/20 text-accent-600', label: 'Erro' },
};

function getStatusMeta(status?: string) {
  return statusMeta[status ?? 'pendente'] ?? statusMeta['pendente'];
}

interface ConfigurarModalProps {
  integracao: Integracao;
  onFechar: () => void;
  onSalvar: (id: string, credenciais: Record<string, string>) => Promise<void>;
}

function CampoCredencial({ campo, valor, aoMudar }: {
  campo: CampoIntegracao;
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const base =
    'w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors';

  if (campo.tipo === 'selecao') {
    return (
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className={`${base} cursor-pointer`}
      >
        <option value="">Selecione…</option>
        {(campo.opcoes ?? []).map((op) => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>
    );
  }

  if (campo.tipo === 'senha') {
    return (
      <div className="relative">
        <input
          type={mostrarSenha ? 'text' : 'password'}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          placeholder={campo.placeholder}
          className={`${base} pr-11`}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setMostrarSenha((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-foreground-400 hover:text-foreground-700 cursor-pointer"
          title={mostrarSenha ? 'Ocultar' : 'Mostrar'}
        >
          <i className={mostrarSenha ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
        </button>
      </div>
    );
  }

  return (
    <input
      type="text"
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      placeholder={campo.placeholder}
      className={base}
      autoComplete="off"
    />
  );
}

function ConfigurarModal({ integracao, onFechar, onSalvar }: ConfigurarModalProps) {
  const [valores, setValores] = useState<Record<string, string>>(integracao.credenciais ?? {});
  const [erro, setErro] = useState('');
  const campos = integracao.campos ?? [];

  const aoMudar = (campoId: string, valor: string) => {
    setValores((prev) => ({ ...prev, [campoId]: valor }));
  };

  const salvar = async () => {
    const faltando = campos
      .filter((c) => c.obrigatorio && !(valores[c.id] ?? '').trim())
      .map((c) => c.rotulo);

    if (faltando.length > 0) {
      setErro(`Preencha os campos obrigatórios: ${faltando.join(', ')}.`);
      return;
    }

    try { await onSalvar(integracao.id, valores); onFechar(); } catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível salvar as credenciais.'); }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4"
      onClick={onFechar}
    >
      <div
        className="bg-background-50 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between sticky top-0 bg-background-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <i className={`${integracao.icone} text-primary-600 text-lg`}></i>
            </div>
            <div>
              <h3 className="font-heading font-bold text-foreground-950">Configurar {integracao.nome}</h3>
              <p className="text-xs text-foreground-500">{integracao.categoria}</p>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-foreground-600">{integracao.descricao}</p>

          {erro && (
            <div className="bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <i className="ri-error-warning-line mt-0.5"></i>
              {erro}
            </div>
          )}

          <div className="space-y-4">
            {campos.map((campo) => (
              <div key={campo.id}>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                  {campo.rotulo}
                  {campo.obrigatorio && <span className="text-accent-600 ml-0.5">*</span>}
                </label>
                <CampoCredencial
                  campo={campo}
                  valor={valores[campo.id] ?? ''}
                  aoMudar={(v) => aoMudar(campo.id, v)}
                />
                {campo.ajuda && (
                  <p className="text-xs text-foreground-400 mt-1.5">{campo.ajuda}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2 sticky bottom-0 bg-background-50">
          <button
            onClick={onFechar}
            className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            onClick={() => void salvar()}
            className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-save-line mr-1.5"></i>
            Salvar credenciais
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IntegracoesTab() {
  const { integracoes, conectar, desconectar, salvarCredenciais } = useIntegracoesStore();
  const [configurando, setConfigurando] = useState<Integracao | null>(null);
  const [toast, setToast] = useState('');
  const [testeZapi, setTesteZapi] = useState<{
    aberto: boolean;
    status: 'idle' | 'enviando' | 'ok' | 'erro';
    msg: string;
  }>({ aberto: false, status: 'idle', msg: '' });

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const testarZapi = async () => {
    setTesteZapi((s) => ({ ...s, status: 'enviando', msg: '' }));

    const { data, error } = await supabase.functions.invoke('testar-integracao', {
      body: { canal: 'whatsapp' },
    });

    if (error) {
      const detalhe = await detalheDoErroDeFuncao(error);
      setTesteZapi((s) => ({ ...s, status: 'erro', msg: detalhe }));
      return;
    }

    if (data?.pronto) {
      setTesteZapi((s) => ({ ...s, status: 'ok', msg: `Conexão válida com ${data.provedor ?? 'o provedor'}. Nenhuma mensagem foi transmitida.` }));
    } else {
      setTesteZapi((s) => ({ ...s, status: 'erro', msg: data?.detalhe || data?.erro || 'Integração não está pronta.' }));
    }
  };

  const temCredenciais = (it: Integracao) => {
    const campos = it.campos ?? [];
    const obrigatorios = campos.filter((c) => c.obrigatorio);
    if (obrigatorios.length === 0) return false;
    return obrigatorios.every((c) => (it.credenciais?.[c.id] ?? '').trim() !== '');
  };

  const testar = (it: Integracao) => {
    if (!temCredenciais(it)) {
      setConfigurando(it);
      return;
    }
    mostrarToast(`${it.nome}: credenciais presentes. O teste real será ativado ao conectar o provedor.`);
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      <div className="bg-secondary-50 border border-secondary-200 text-secondary-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
        <i className="ri-information-line mt-0.5"></i>
        <span>
          <strong>Conexões reais.</strong> Clique em <strong>Configurar</strong> e preencha as credenciais de cada
          provedor. Elas ficam salvas na sua conta no Backend e são usadas nas conexões de verdade.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integracoes.map((it) => {
          const meta = getStatusMeta(it.status);
          return (
            <div key={it.id} className="bg-background-50 border border-background-200/70 rounded-xl p-5 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <i className={`${it.icone} text-primary-600 text-lg`}></i>
                </div>
                <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${meta.cor}`}>
                  {meta.label}
                </span>
              </div>

              <h4 className="font-heading font-bold text-foreground-900 mb-1">{it.nome}</h4>
              <p className="text-xs text-foreground-500 mb-3">{it.descricao}</p>

              <div className="flex items-center gap-2 mb-4 text-xs">
                <span className="text-foreground-400">Último teste: {it.ultimoTeste}</span>
                {temCredenciais(it) && (
                  <span className="inline-flex items-center gap-1 text-primary-700 font-medium">
                    <i className="ri-checkbox-circle-fill"></i>
                    credenciais salvas
                  </span>
                )}
              </div>

              <div className="mt-auto space-y-2">
                <button
                  onClick={() => setConfigurando(it)}
                  className="w-full px-3 py-2 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-settings-3-line mr-1.5"></i>
                  Configurar
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => testar(it)}
                    className="flex-1 px-3 py-2 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Testar
                  </button>
                  {it.status === 'conectado' ? (
                    <button
                      onClick={() => { desconectar(it.id); mostrarToast(`${it.nome} desconectada.`); }}
                      className="flex-1 px-3 py-2 bg-accent-100 hover:bg-accent-200 text-accent-800 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Desconectar
                    </button>
                  ) : (
                    <button
                      onClick={() => { conectar(it.id); mostrarToast(`${it.nome} conectada.`); }}
                      className="flex-1 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Conectar
                    </button>
                  )}
                </div>

                {it.id === 'int-1' && (
                  <div className="border-t border-background-200/70 pt-3">
                    <button
                      onClick={() => setTesteZapi((s) => ({ ...s, aberto: !s.aberto, status: 'idle', msg: '' }))}
                      className="w-full px-3 py-2 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-send-plane-line mr-1.5"></i>
                      Testar conexão
                    </button>

                    {testeZapi.aberto && (
                      <div className="mt-3 space-y-2">
                        <button
                          onClick={testarZapi}
                          disabled={testeZapi.status === 'enviando'}
                          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-background-50 rounded-md text-sm font-semibold cursor-pointer whitespace-nowrap"
                        >
                          {testeZapi.status === 'enviando' ? 'Validando...' : 'Validar conexão'}
                        </button>
                        {testeZapi.status === 'ok' && (
                          <p className="text-xs text-primary-700 flex items-center gap-1.5">
                            <i className="ri-checkbox-circle-fill"></i>
                            {testeZapi.msg}
                          </p>
                        )}
                        {testeZapi.status === 'erro' && (
                          <p className="text-xs text-accent-700 flex items-start gap-1.5">
                            <i className="ri-error-warning-line mt-0.5"></i>
                            {testeZapi.msg}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {configurando && (
        <ConfigurarModal
          integracao={configurando}
          onFechar={() => setConfigurando(null)}
          onSalvar={async (id, credenciais) => {
            if (id !== 'int-1') throw new Error('A conexão segura deste provedor ainda não está disponível.');
            const { data, error } = await supabase.functions.invoke('configurar-integracao', { body: { canal: 'whatsapp', credenciais } });
            if (error || !data?.ok) throw new Error(data?.erro ?? await detalheDoErroDeFuncao(error));
            salvarCredenciais(id, credenciais);
            mostrarToast(
              'Credenciais guardadas no cofre seguro. Agora use “Testar conexão”.',
            );
          }}
        />
      )}
    </div>
  );
}
