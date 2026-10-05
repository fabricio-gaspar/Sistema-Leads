import { useState } from 'react';
import { useConfiguracaoStore } from '@/hooks/useConfiguracaoStore';
import type { ConfiguracaoRuntime } from '@/lib/tipos';

export default function AutomacoesTab() {
  const { config: cfg, atualizar: salvar } = useConfiguracaoStore();
  const [toast, setToast] = useState('');

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const atualizar = <K extends keyof ConfiguracaoRuntime>(campo: K, valor: ConfiguracaoRuntime[K]) => {
    salvar({ [campo]: valor } as Partial<ConfiguracaoRuntime>);
  };

  const atualizarFollowup = (chave: 'primeiroFollowup' | 'segundoFollowup' | 'timeout', campo: 'ativo' | 'horas', valor: boolean | number) => {
    salvar({ [chave]: { ...cfg[chave], [campo]: valor } } as Partial<ConfiguracaoRuntime>);
  };

  const toggleGatilho = (id: string) => {
    salvar({ handoffGatilhos: cfg.handoffGatilhos.map((g) => (g.id === id ? { ...g, ativo: !g.ativo } : g)) });
  };

  const ativosHandoff = cfg.handoffGatilhos.filter((g) => g.ativo).length;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      {/* Kill switch global */}
      <section className="bg-accent-500 text-background-50 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-background-50/20 flex items-center justify-center">
              <i className="ri-stop-circle-line text-xl"></i>
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg">Kill switch global da Ana</h3>
              <p className="text-sm text-background-50/80">
                Quando ativado, <strong>todas</strong> as automações, envios e respostas automáticas da Ana são pausadas
                imediatamente em todos os leads e canais.
              </p>
            </div>
          </div>
          <button
            onClick={() => atualizar('killSwitchGlobal', !cfg.killSwitchGlobal)}
            className={`w-14 h-8 rounded-full relative transition-colors cursor-pointer flex-shrink-0 ${cfg.killSwitchGlobal ? 'bg-background-50' : 'bg-background-50/30'}`}
          >
            <span className={`absolute top-1 w-6 h-6 rounded-full transition-all ${cfg.killSwitchGlobal ? 'bg-accent-600 left-7' : 'bg-background-50 left-1'}`}></span>
          </button>
        </div>
        {cfg.killSwitchGlobal && (
          <div className="mt-4 bg-background-50 text-accent-700 rounded-lg p-4 text-sm">
            <p className="font-bold mb-2 flex items-center gap-2">
              <i className="ri-alarm-warning-line"></i>
              Ana pausada globalmente
            </p>
            <input
              type="text"
              value={cfg.killSwitchUltimoMotivo}
              onChange={(e) => atualizar('killSwitchUltimoMotivo', e.target.value)}
              placeholder="Motivo da pausa (obrigatório para auditoria)..."
              className="w-full px-4 py-2.5 bg-background-100 border border-background-300 rounded-lg text-sm text-foreground-900"
            />
          </div>
        )}
      </section>

      {/* Cadências e follow-up */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70">
          <h3 className="font-heading font-bold text-foreground-900 text-sm">Cadências e Follow-up</h3>
          <p className="text-xs text-foreground-500">Sequência de contato automático no modo IA e regras de timeout.</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {(
            [
              { chave: 'primeiroFollowup', label: 'Primeiro follow-up', desc: 'Enviado quando o lead não responde ao primeiro contato.' },
              { chave: 'segundoFollowup', label: 'Segundo follow-up', desc: 'Última tentativa antes do timeout.' },
              { chave: 'timeout', label: 'Timeout sem resposta', desc: 'Após a cadência final, solicita a conclusão como Perdido com motivo auditável.' },
            ] as const
          ).map((item) => (
            <div key={item.chave} className="bg-background-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-foreground-900 text-sm">{item.label}</label>
                <button
                  onClick={() => atualizarFollowup(item.chave, 'ativo', !cfg[item.chave].ativo)}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${cfg[item.chave].ativo ? 'bg-primary-500' : 'bg-background-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${cfg[item.chave].ativo ? 'translate-x-5' : ''}`}></span>
                </button>
              </div>
              <p className="text-xs text-foreground-500 mb-4 min-h-[32px]">{item.desc}</p>
              <div className={`flex items-center gap-2 ${cfg[item.chave].ativo ? '' : 'opacity-50 pointer-events-none'}`}>
                <input
                  type="number"
                  min={1}
                  value={cfg[item.chave].horas}
                  onChange={(e) => atualizarFollowup(item.chave, 'horas', Number(e.target.value))}
                  className="w-20 px-3 py-2 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
                />
                <span className="text-sm text-foreground-600">horas</span>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Motivo de perda ao estourar timeout</label>
            <input
              type="text"
              value={cfg.motivoPerdaTimeout}
              onChange={(e) => atualizar('motivoPerdaTimeout', e.target.value)}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
            />
          </div>
          <div className="flex items-end gap-6">
            <button onClick={() => atualizar('pausarAoResponder', !cfg.pausarAoResponder)} className="flex items-center gap-3 cursor-pointer">
              <span className={`w-10 h-5 rounded-full transition-colors relative ${cfg.pausarAoResponder ? 'bg-primary-500' : 'bg-background-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${cfg.pausarAoResponder ? 'translate-x-5' : ''}`}></span>
              </span>
              <span className="text-sm text-foreground-700">Pausar cadência quando o lead responder</span>
            </button>
            <button onClick={() => atualizar('cancelarEtapaFinal', !cfg.cancelarEtapaFinal)} className="flex items-center gap-3 cursor-pointer">
              <span className={`w-10 h-5 rounded-full transition-colors relative ${cfg.cancelarEtapaFinal ? 'bg-primary-500' : 'bg-background-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${cfg.cancelarEtapaFinal ? 'translate-x-5' : ''}`}></span>
              </span>
              <span className="text-sm text-foreground-700">Cancelar automações em etapas finais</span>
            </button>
          </div>
        </div>
      </section>

      {/* SLA humano */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <h3 className="font-heading font-bold text-foreground-900 text-sm mb-1">SLA humano</h3>
        <p className="text-xs text-foreground-500 mb-5">Regras de responsabilidade e tempo para o atendimento humano.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">SLA para primeiro contato humano</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={cfg.slaPrimeiroContato.horas}
                onChange={(e) => atualizar('slaPrimeiroContato', { ...cfg.slaPrimeiroContato, horas: Number(e.target.value) })}
                className="w-20 px-3 py-2 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
              />
              <span className="text-sm text-foreground-600">horas</span>
            </div>
          </div>
          <div className="space-y-3">
            <button onClick={() => atualizar('notificarResponsavel', !cfg.notificarResponsavel)} className="flex items-center gap-3 cursor-pointer">
              <span className={`w-10 h-5 rounded-full transition-colors relative ${cfg.notificarResponsavel ? 'bg-primary-500' : 'bg-background-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${cfg.notificarResponsavel ? 'translate-x-5' : ''}`}></span>
              </span>
              <span className="text-sm text-foreground-700">Notificar responsável</span>
            </button>
            <button onClick={() => atualizar('notificarGestor', !cfg.notificarGestor)} className="flex items-center gap-3 cursor-pointer">
              <span className={`w-10 h-5 rounded-full transition-colors relative ${cfg.notificarGestor ? 'bg-primary-500' : 'bg-background-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${cfg.notificarGestor ? 'translate-x-5' : ''}`}></span>
              </span>
              <span className="text-sm text-foreground-700">Notificar gestor</span>
            </button>
            <button onClick={() => atualizar('escalarAposSla', !cfg.escalarAposSla)} className="flex items-center gap-3 cursor-pointer">
              <span className={`w-10 h-5 rounded-full transition-colors relative ${cfg.escalarAposSla ? 'bg-primary-500' : 'bg-background-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${cfg.escalarAposSla ? 'translate-x-5' : ''}`}></span>
              </span>
              <span className="text-sm text-foreground-700">Escalar para gestor quando estourar o SLA</span>
            </button>
          </div>
        </div>
      </section>

      {/* Handoff automático */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Handoff automático Ana → Humano</h3>
            <p className="text-xs text-foreground-500">
              Transferência automática ao detectar estas situações. <span className="font-medium text-foreground-700">{ativosHandoff} de {cfg.handoffGatilhos.length} ativos</span>.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          {cfg.handoffGatilhos.map((g) => (
            <button
              key={g.id}
              onClick={() => toggleGatilho(g.id)}
              className={`flex items-center gap-3 p-4 rounded-lg border transition-all cursor-pointer text-left ${
                g.ativo ? 'border-primary-400 bg-primary-50' : 'border-background-200 bg-background-50'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${g.ativo ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-500'}`}>
                <i className={g.ativo ? 'ri-user-shared-line' : 'ri-user-unfollow-line'}></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground-900 text-sm">{g.nome}</p>
                <p className="text-xs text-foreground-500">{g.descricao}</p>
              </div>
              <span className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${g.ativo ? 'bg-primary-500' : 'bg-background-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${g.ativo ? 'translate-x-5' : ''}`}></span>
              </span>
            </button>
          ))}
        </div>
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Confiança mínima da Ana p/ ação automática (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={cfg.limiteConfianca}
              onChange={(e) => atualizar('limiteConfianca', Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
            />
            <p className="text-xs text-foreground-500 mt-1">Abaixo disso, a Ana transfere para humano.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Score mínimo p/ priorizar handoff</label>
            <input
              type="number"
              min={0}
              max={100}
              value={cfg.scoreMinimoHandoff}
              onChange={(e) => atualizar('scoreMinimoHandoff', Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
            />
          </div>
          <div className="flex flex-col justify-end gap-3">
            <button onClick={() => atualizar('pausarAnaHandoff', !cfg.pausarAnaHandoff)} className="flex items-center gap-3 cursor-pointer">
              <span className={`w-10 h-5 rounded-full relative transition-colors ${cfg.pausarAnaHandoff ? 'bg-primary-500' : 'bg-background-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${cfg.pausarAnaHandoff ? 'translate-x-5' : ''}`}></span>
              </span>
              <span className="text-sm text-foreground-700">Pausar Ana no lead após handoff</span>
            </button>
            <button onClick={() => atualizar('criarTarefaHandoff', !cfg.criarTarefaHandoff)} className="flex items-center gap-3 cursor-pointer">
              <span className={`w-10 h-5 rounded-full relative transition-colors ${cfg.criarTarefaHandoff ? 'bg-primary-500' : 'bg-background-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${cfg.criarTarefaHandoff ? 'translate-x-5' : ''}`}></span>
              </span>
              <span className="text-sm text-foreground-700">Criar tarefa para o responsável</span>
            </button>
          </div>
        </div>
      </section>

      {/* Limites e janela comercial */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <h3 className="font-heading font-bold text-foreground-900 text-sm mb-1">Limites e janela comercial</h3>
        <p className="text-xs text-foreground-500 mb-5">Proteções para evitar envio excessivo e mensagens fora de horário.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Mensagens por contato (dia)</label>
            <input
              type="number"
              min={1}
              value={cfg.limiteDiarioPorContato}
              onChange={(e) => atualizar('limiteDiarioPorContato', Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Mensagens totais (dia)</label>
            <input
              type="number"
              min={1}
              value={cfg.limiteDiarioTotal}
              onChange={(e) => atualizar('limiteDiarioTotal', Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
            />
          </div>
          <div className="space-y-3">
            <button onClick={() => atualizar('aguardarResposta', !cfg.aguardarResposta)} className="flex items-center gap-3 cursor-pointer">
              <span className={`w-10 h-5 rounded-full relative transition-colors ${cfg.aguardarResposta ? 'bg-primary-500' : 'bg-background-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${cfg.aguardarResposta ? 'translate-x-5' : ''}`}></span>
              </span>
              <span className="text-sm text-foreground-700">Aguardar resposta antes de novo envio</span>
            </button>
            <button onClick={() => atualizar('horarioComercial', !cfg.horarioComercial)} className="flex items-center gap-3 cursor-pointer">
              <span className={`w-10 h-5 rounded-full relative transition-colors ${cfg.horarioComercial ? 'bg-primary-500' : 'bg-background-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${cfg.horarioComercial ? 'translate-x-5' : ''}`}></span>
              </span>
              <span className="text-sm text-foreground-700">Respeitar horário comercial (aba Horários)</span>
            </button>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={() => mostrarToast('Automações e cadências salvas automaticamente!')}
          className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
        >
          Salvar configurações
        </button>
      </div>
    </div>
  );
}
