import { useState } from 'react';
import { useConfiguracaoStore } from '@/hooks/useConfiguracaoStore';
import { useEnvioLogStore } from '@/hooks/useEnvioLogStore';
import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';
import type { ModoExecucao, EstadoModulo, ModuloEstado, ProvedorWhatsapp } from '@/lib/tipos';

const modos: { id: ModoExecucao; label: string; desc: string; icone: string }[] = [
  { id: 'DEMO', label: 'Demo', desc: 'Tudo simulado no navegador', icone: 'ri-flask-line' },
  { id: 'SANDBOX', label: 'Sandbox', desc: 'APIs reais com credenciais de teste', icone: 'ri-test-tube-line' },
  { id: 'PRODUCAO', label: 'Produção', desc: 'Efeitos reais (envia de verdade)', icone: 'ri-rocket-line' },
];

const modulos: { chave: string; nome: string; desc: string; icone: string }[] = [
  { chave: 'whatsapp', nome: 'WhatsApp', desc: 'Mensagens via Z-API ou Meta Cloud API', icone: 'ri-whatsapp-line' },
  { chave: 'email', nome: 'E-mail', desc: 'Envio real de e-mails', icone: 'ri-mail-line' },
  { chave: 'agendamento', nome: 'Agendamento', desc: 'Calendário de reuniões', icone: 'ri-calendar-event-line' },
  { chave: 'ia', nome: 'IA (cérebro da Ana)', desc: 'Respostas geradas por IA real', icone: 'ri-brain-line' },
];

const estados: { id: EstadoModulo; label: string }[] = [
  { id: 'DESLIGADO', label: 'Desligado' },
  { id: 'SANDBOX', label: 'Sandbox' },
  { id: 'ATIVO', label: 'Ativo' },
];

const provedores: { id: ProvedorWhatsapp; label: string; desc: string }[] = [
  { id: 'zapi', label: 'Z-API', desc: 'QR Code + número real' },
  { id: 'meta', label: 'Meta (Cloud API)', desc: 'Número oficial no Meta Business' },
];

const modoCor: Record<ModoExecucao, string> = {
  DEMO: 'bg-secondary-100 text-secondary-800',
  SANDBOX: 'bg-accent-100 text-accent-800',
  PRODUCAO: 'bg-primary-100 text-primary-800',
};

type StatusEfetivo = 'pronto' | 'incompleto' | 'desligado';

const statusMeta: Record<StatusEfetivo, { label: string; cor: string; icone: string }> = {
  pronto: { label: 'Pronto para operar', cor: 'bg-primary-100 text-primary-700', icone: 'ri-checkbox-circle-fill' },
  incompleto: { label: 'Incompleto', cor: 'bg-accent-100 text-accent-700', icone: 'ri-time-line' },
  desligado: { label: 'Desligado', cor: 'bg-background-200 text-foreground-500', icone: 'ri-toggle-line' },
};

// O status efetivo combina os três requisitos: modo global real, módulo ligado
// e credencial configurada. Só quando os três estão atendidos o módulo dispara
// efeito real de verdade.
function statusEfetivo(modo: ModoExecucao, mod: ModuloEstado): StatusEfetivo {
  const gates = [modo !== 'DEMO', mod.estado !== 'DESLIGADO', mod.temCredenciais];
  const atendidos = gates.filter(Boolean).length;
  if (atendidos === 3) return 'pronto';
  if (atendidos === 0) return 'desligado';
  return 'incompleto';
}

function Gate({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-4 h-4 flex items-center justify-center ${ok ? 'text-primary-600' : 'text-foreground-300'}`}>
        <i className={ok ? 'ri-checkbox-circle-fill text-sm' : 'ri-checkbox-blank-circle-line text-sm'}></i>
      </span>
      <span className={`text-[11px] ${ok ? 'text-foreground-700' : 'text-foreground-400'}`}>{label}</span>
    </div>
  );
}

export default function AmbienteTab() {
  const { config: cfg, atualizar } = useConfiguracaoStore();
  const { registros, limpar } = useEnvioLogStore();
  const [toast, setToast] = useState('');
  const [pendingModo, setPendingModo] = useState<ModoExecucao | null>(null);
  const [contatos, setContatos] = useState(cfg.contatosTeste.join('\n'));
  const [testeWhatsapp, setTesteWhatsapp] = useState<{
    aberto: boolean;
    numero: string;
    status: 'idle' | 'enviando' | 'ok' | 'erro';
    msg: string;
  }>({ aberto: false, numero: '', status: 'idle', msg: '' });

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const aplicarModo = (modo: ModoExecucao) => {
    atualizar({ modoExecucao: modo });
    setPendingModo(null);
    mostrarToast(`Modo alterado para ${modo}.`);
  };

  const selecionarModo = (modo: ModoExecucao) => {
    if (modo === cfg.modoExecucao) return;
    if (cfg.modoExecucao === 'DEMO' && modo !== 'DEMO') {
      setPendingModo(modo);
      return;
    }
    aplicarModo(modo);
  };

  const setEstadoModulo = (chave: string, estado: EstadoModulo) => {
    const atual = cfg.estadosModulos[chave] ?? { estado: 'DESLIGADO', temCredenciais: false };
    atualizar({ estadosModulos: { ...cfg.estadosModulos, [chave]: { ...atual, estado } } });
  };

  const toggleCredencial = (chave: string) => {
    const atual = cfg.estadosModulos[chave] ?? { estado: 'DESLIGADO', temCredenciais: false };
    atualizar({ estadosModulos: { ...cfg.estadosModulos, [chave]: { ...atual, temCredenciais: !atual.temCredenciais } } });
  };

  const salvarContatos = () => {
    const lista = contatos
      .split(/[\n,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    atualizar({ contatosTeste: lista });
    mostrarToast('Contatos de teste salvos.');
  };

  // Valida o estado da integração no servidor; não transmite uma mensagem de teste.
  const testarWhatsapp = async () => {
    setTesteWhatsapp((s) => ({ ...s, status: 'enviando', msg: '' }));

    const { data, error } = await supabase.functions.invoke('testar-integracao', {
      body: { canal: 'whatsapp' },
    });

    if (error) {
      const detalhe = await detalheDoErroDeFuncao(error);
      setTesteWhatsapp((s) => ({ ...s, status: 'erro', msg: detalhe }));
      return;
    }

    if (data?.pronto) {
      setTesteWhatsapp((s) => ({ ...s, status: 'ok', msg: `Conexão válida com ${data.provedor === 'zapi' ? 'Z-API' : 'Meta'}. Nenhuma mensagem foi transmitida.` }));
    } else {
      setTesteWhatsapp((s) => ({ ...s, status: 'erro', msg: data?.detalhe || data?.erro || 'Integração não está pronta.' }));
    }
  };

  const prontos = modulos.filter((m) => {
    const mod = cfg.estadosModulos[m.chave] ?? { estado: 'DESLIGADO', temCredenciais: false };
    return statusEfetivo(cfg.modoExecucao, mod) === 'pronto';
  }).length;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      {/* Resumo de prontidão */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
            <i className="ri-rocket-2-line text-primary-600 text-xl"></i>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-foreground-900 text-sm">
              Ativação do sistema — {prontos} de {modulos.length} módulos prontos
            </h3>
            <p className="text-xs text-foreground-500 mt-0.5">
              Um módulo só opera de verdade quando os <strong>três requisitos</strong> estão atendidos:
              modo real (Sandbox ou Produção), módulo ligado e credencial configurada.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${modoCor[cfg.modoExecucao]}`}>
              <i className="ri-earth-line"></i>
              {cfg.modoExecucao === 'DEMO' ? 'Demo' : cfg.modoExecucao === 'SANDBOX' ? 'Sandbox' : 'Produção'}
            </span>
          </div>
        </div>

        {/* barra de progresso de prontidão */}
        <div className="mt-5 h-2 bg-background-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all"
            style={{ width: `${(prontos / modulos.length) * 100}%` }}
          />
        </div>
      </section>

      {/* Modo de execução global */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <i className="ri-earth-line text-primary-600 text-lg"></i>
          </div>
          <div>
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Modo de execução</h3>
            <p className="text-xs text-foreground-500">Em que “mundo” o sistema está rodando.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
          {modos.map((m) => (
            <button
              key={m.id}
              onClick={() => selecionarModo(m.id)}
              className={`flex items-start gap-3 p-4 rounded-lg border text-left cursor-pointer transition-all ${
                cfg.modoExecucao === m.id
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-background-200 bg-background-50 hover:bg-background-100'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${modoCor[m.id]}`}>
                <i className={m.icone}></i>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground-900 text-sm flex items-center gap-2">
                  {m.label}
                  {cfg.modoExecucao === m.id && (
                    <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                  )}
                </p>
                <p className="text-xs text-foreground-500 mt-0.5">{m.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {cfg.modoExecucao !== 'PRODUCAO' && (
          <div className={`mt-4 px-4 py-3 rounded-lg text-sm flex items-start gap-2 ${cfg.modoExecucao === 'DEMO' ? 'bg-secondary-50 border border-secondary-200 text-secondary-800' : 'bg-accent-50 border border-accent-200 text-accent-800'}`}>
            <i className={cfg.modoExecucao === 'DEMO' ? 'ri-flask-line mt-0.5' : 'ri-test-tube-line mt-0.5'}></i>
            <span>
              {cfg.modoExecucao === 'DEMO'
                ? 'MODO DEMO — nada sai do navegador. Todos os envios são simulados.'
                : 'MODO SANDBOX — mensagens só saem para contatos de teste, usando credenciais de teste.'}
            </span>
          </div>
        )}

        {pendingModo && (
          <div className="mt-4 bg-accent-50 border border-accent-300 rounded-lg p-4">
            <p className="text-sm text-foreground-800">
              Você está saindo do modo <strong>Demo</strong> para <strong>{pendingModo}</strong>. A partir daqui,
              com os módulos ativos e credenciais configuradas, os envios podem ter efeito real. Confirmar?
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => aplicarModo(pendingModo)}
                className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-background-50 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
              >
                Confirmar
              </button>
              <button
                onClick={() => setPendingModo(null)}
                className="px-4 py-2 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Estado dos módulos */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <h3 className="font-heading font-bold text-foreground-900 text-sm mb-1">Módulos do sistema</h3>
        <p className="text-xs text-foreground-500 mb-5">
          Ative cada braço individualmente. O status à direita mostra se ele já está pronto para operar.
        </p>

        <div className="grid grid-cols-1 gap-3">
          {modulos.map((mod) => {
            const estadoAtual = cfg.estadosModulos[mod.chave] ?? { estado: 'DESLIGADO', temCredenciais: false };
            const status = statusEfetivo(cfg.modoExecucao, estadoAtual);
            const meta = statusMeta[status];
            return (
              <div key={mod.chave} className="p-4 border border-background-200/70 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className={`${mod.icone} text-primary-600 text-lg`}></i>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground-900 text-sm">{mod.nome}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.cor}`}>
                        <i className={meta.icone}></i>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xs text-foreground-500 mt-0.5">{mod.desc}</p>

                    {/* requisitos */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      <Gate ok={cfg.modoExecucao !== 'DEMO'} label="Modo real" />
                      <Gate ok={estadoAtual.estado !== 'DESLIGADO'} label="Módulo ligado" />
                      <Gate ok={estadoAtual.temCredenciais} label="Credencial" />
                    </div>

                    {mod.chave === 'whatsapp' && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-foreground-600 mb-1.5">Provedor de envio</p>
                        <div className="flex flex-wrap gap-1 p-1 bg-background-100 rounded-full w-fit">
                          {provedores.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => atualizar({ provedorWhatsapp: p.id })}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                                cfg.provedorWhatsapp === p.id
                                  ? 'bg-foreground-900 text-background-50'
                                  : 'text-foreground-500 hover:text-foreground-800'
                              }`}
                              title={p.desc}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[11px] text-foreground-400 mt-1.5">
                          {cfg.provedorWhatsapp === 'zapi'
                            ? 'Z-API: conecta por QR Code a um número real. Requer Instance ID, Token e Client Token nos secrets do Backend.'
                            : 'Meta: número oficial da WhatsApp Cloud API. Requer WHATSAPP_TOKEN e WHATSAPP_PHONE_ID nos secrets do Backend.'}
                        </p>

                        <div className="mt-3 border-t border-background-200/70 pt-3">
                          <button
                            onClick={() => setTesteWhatsapp((s) => ({ ...s, aberto: !s.aberto, status: 'idle', msg: '' }))}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-send-plane-line"></i> Testar conexão
                          </button>

                          {testeWhatsapp.aberto && (
                            <div className="mt-3 space-y-2">
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  type="text"
                                  value={testeWhatsapp.numero}
                                  onChange={(e) => setTesteWhatsapp((s) => ({ ...s, numero: e.target.value }))}
                                  placeholder="Número com DDI (ex.: 5511999999999)"
                                  className="flex-1 px-3 py-2 bg-background-100 border border-background-200 rounded-md text-sm text-foreground-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
                                />
                                <button
                                  onClick={testarWhatsapp}
                                  disabled={testeWhatsapp.status === 'enviando'}
                                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-background-50 rounded-md text-sm font-semibold cursor-pointer whitespace-nowrap"
                                >
                                  {testeWhatsapp.status === 'enviando' ? 'Enviando...' : 'Enviar teste'}
                                </button>
                              </div>
                              {testeWhatsapp.status === 'ok' && (
                                <p className="text-xs text-primary-700 flex items-center gap-1.5">
                                  <i className="ri-checkbox-circle-fill"></i>
                                  {testeWhatsapp.msg}
                                </p>
                              )}
                              {testeWhatsapp.status === 'erro' && (
                                <p className="text-xs text-accent-700 flex items-start gap-1.5">
                                  <i className="ri-error-warning-line mt-0.5"></i>
                                  {testeWhatsapp.msg}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleCredencial(mod.chave)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap ${
                        estadoAtual.temCredenciais ? 'bg-primary-100 text-primary-700' : 'bg-background-100 text-foreground-500'
                      }`}
                      title="Indica se a credencial deste módulo está configurada no backend"
                    >
                      <i className={estadoAtual.temCredenciais ? 'ri-key-2-fill' : 'ri-key-2-line'}></i>
                      {estadoAtual.temCredenciais ? 'Com credencial' : 'Sem credencial'}
                    </button>

                    <div className="flex gap-1 p-1 bg-background-100 rounded-full">
                      {estados.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => setEstadoModulo(mod.chave, e.id)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                            estadoAtual.estado === e.id
                              ? e.id === 'ATIVO'
                                ? 'bg-primary-500 text-background-50'
                                : e.id === 'SANDBOX'
                                  ? 'bg-accent-500 text-background-50'
                                  : 'bg-background-50 text-foreground-700 shadow-sm'
                              : 'text-foreground-500 hover:text-foreground-700'
                          }`}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Contatos de teste */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <h3 className="font-heading font-bold text-foreground-900 text-sm mb-1">Contatos de teste (sandbox)</h3>
        <p className="text-xs text-foreground-500 mb-4">
          Em Sandbox, apenas estes contatos podem receber envio. Separe por linha ou vírgula (e-mail ou telefone).
        </p>
        <textarea
          value={contatos}
          onChange={(e) => setContatos(e.target.value)}
          rows={3}
          placeholder={'seu-email@teste.com\n(11) 90000-0000'}
          className="w-full px-4 py-3 bg-background-100 border border-background-200/70 rounded-lg text-sm text-foreground-800 focus:outline-none focus:border-primary-400 resize-y"
        />
        <button
          onClick={salvarContatos}
          className="mt-3 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
        >
          Salvar contatos
        </button>
      </section>

      {/* Registro de envios */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Registro de envios</h3>
            <p className="text-xs text-foreground-500">O que a Ana tentou enviar, para quem, por qual canal e por que foi simulado.</p>
          </div>
          {registros.length > 0 && (
            <button
              onClick={limpar}
              className="px-3 py-2 bg-background-100 hover:bg-background-200 text-foreground-600 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Limpar
            </button>
          )}
        </div>
        {registros.length === 0 ? (
          <div className="px-6 py-10 text-center text-foreground-400 text-sm">
            <i className="ri-inbox-line text-2xl mb-2 block"></i>
            Nenhum envio registrado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-background-200/70 bg-background-100/50">
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Data</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Contato</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Canal</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Tipo</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Modo</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className="border-b border-background-100 hover:bg-background-50/50">
                    <td className="px-6 py-3.5 text-foreground-500 text-xs whitespace-nowrap">{r.data}</td>
                    <td className="px-6 py-3.5 text-foreground-700 font-medium">{r.contato}</td>
                    <td className="px-6 py-3.5 text-foreground-700">{r.canal}</td>
                    <td className="px-6 py-3.5 text-foreground-600 text-xs">{r.tipo}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${modoCor[r.modo]}`}>
                        {r.modo}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        r.bloqueadoSandbox
                          ? 'bg-accent-100 text-accent-700'
                          : r.simulado
                            ? 'bg-secondary-100 text-secondary-800'
                            : r.resultado === 'erro'
                              ? 'bg-accent-100 text-accent-700'
                              : r.resultado === 'ok'
                                ? 'bg-primary-100 text-primary-700'
                                : 'bg-background-200 text-foreground-500'
                      }`}>
                        {r.bloqueadoSandbox
                          ? 'Bloqueado (não é teste)'
                          : r.simulado
                            ? 'Simulado'
                            : r.resultado === 'erro'
                              ? 'Falhou'
                              : r.resultado === 'ok'
                                ? 'Enviado'
                                : 'Enviando...'}
                      </span>
                      {!r.simulado && r.respostaApi && (
                        <p className={`mt-1 text-[11px] ${r.resultado === 'erro' ? 'text-accent-700' : 'text-foreground-500'} max-w-[220px] break-words`}>
                          {r.respostaApi}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
