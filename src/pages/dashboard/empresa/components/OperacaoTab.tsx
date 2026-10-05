import { useState } from 'react';
import { controleAna } from '@/mocks/anaComercial';
import { metasProspeccao, complianceLgpd } from '@/mocks/empresaExtra';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';

export default function OperacaoTab() {
  const { settings, salvar: salvarConfig } = useEmpresaSettingsStore();
  const [saved, setSaved] = useState(false);
  const [horario, setHorario] = useState(settings.horario || '');
  const [limiteMensagens, setLimiteMensagens] = useState(settings.limiteMensagens || 0);
  const [consentimento, setConsentimento] = useState(settings.consentimento || '');
  const [handoff, setHandoff] = useState((settings.handoff || []).map((r) => ({ ...r })));

  const salvar = () => {
    salvarConfig({ horario, limiteMensagens, handoff, consentimento });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const toggleHandoff = (gatilho: string) => {
    setHandoff((prev) =>
      prev.map((r) => (r.gatilho === gatilho ? { ...r, status: r.status === 'ativo' ? 'rascunho' : 'ativo' } : r))
    );
  };

  const pct = (atual: number, alvo: number) => Math.min(100, Math.round((atual / alvo) * 100));

  return (
    <div className="space-y-6">
      {/* Regras e limites */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
            <i className="ri-settings-3-line text-primary-600"></i>
          </div>
          <div>
            <h3 className="font-heading font-bold text-foreground-900">Regras de negócio e limites</h3>
            <p className="text-sm text-foreground-500">Até onde a Ana pode ir sozinha e quando ela transfere para um humano.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Horário de atendimento</label>
            <input
              type="text"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Máx. mensagens por lead/dia</label>
            <input
              type="number"
              value={limiteMensagens}
              onChange={(e) => setLimiteMensagens(Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Modo padrão</label>
            <div className="px-4 py-2.5 bg-background-100/70 border border-background-200/70 rounded-lg text-sm text-foreground-700 capitalize">
              {controleAna.modoPadrao}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-background-100/50 border border-background-200/70 rounded-lg p-3">
            <p className="text-xs text-foreground-500">Follow-up 1</p>
            <p className="font-heading font-bold text-foreground-950 text-lg">{controleAna.followUp1Horas}h</p>
          </div>
          <div className="bg-background-100/50 border border-background-200/70 rounded-lg p-3">
            <p className="text-xs text-foreground-500">Follow-up 2</p>
            <p className="font-heading font-bold text-foreground-950 text-lg">{controleAna.followUp2Horas}h</p>
          </div>
          <div className="bg-background-100/50 border border-background-200/70 rounded-lg p-3">
            <p className="text-xs text-foreground-500">Timeout</p>
            <p className="font-heading font-bold text-foreground-950 text-lg">{controleAna.timeoutHoras}h</p>
          </div>
          <div className="bg-background-100/50 border border-background-200/70 rounded-lg p-3">
            <p className="text-xs text-foreground-500">Score p/ handoff</p>
            <p className="font-heading font-bold text-foreground-950 text-lg">{controleAna.scoreHandoff}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground-800 mb-3">
            Quando transferir para um humano <span className="text-foreground-400">(clique para ativar/desativar)</span>
          </label>
          <div className="space-y-2">
            {handoff.map((r) => (
              <button
                key={r.gatilho}
                onClick={() => toggleHandoff(r.gatilho)}
                className={`w-full text-left flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                  r.status === 'ativo' ? 'border-primary-300 bg-primary-100/40' : 'border-background-200/70 bg-background-50 hover:border-background-300'
                }`}
              >
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  r.status === 'ativo' ? 'bg-primary-500 border-primary-500' : 'border-background-300'
                }`}>
                  {r.status === 'ativo' && <i className="ri-check-line text-background-50 dark:text-foreground-950 text-xs"></i>}
                </span>
                <span>
                  <span className="block font-medium text-foreground-900 text-sm">{r.gatilho}</span>
                  <span className="block text-xs text-foreground-500">{r.descricao}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Metas de prospecção */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-accent-100 rounded-lg flex items-center justify-center">
            <i className="ri-flag-line text-accent-600"></i>
          </div>
          <div>
            <h3 className="font-heading font-bold text-foreground-900">Metas de prospecção</h3>
            <p className="text-sm text-foreground-500">Os alvos que guiam a atuação da Ana e alimentam a dashboard.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {metasProspeccao.map((m) => (
            <div key={m.id} className="bg-background-100/50 border border-background-200/70 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-accent-100 rounded-lg flex items-center justify-center">
                  <i className={`${m.icone} text-accent-600`}></i>
                </div>
                <div>
                  <p className="font-medium text-foreground-900 text-sm">{m.nome}</p>
                  <p className="text-xs text-foreground-500">
                    {m.atual} de {m.alvo} {m.unidade}
                  </p>
                </div>
              </div>
              <div className="h-2 bg-background-200 rounded-full overflow-hidden">
                <div className="h-full bg-accent-500 rounded-full transition-all" style={{ width: `${pct(m.atual, m.alvo)}%` }}></div>
              </div>
              <p className="text-xs text-foreground-600 mt-2">{pct(m.atual, m.alvo)}% da meta</p>
            </div>
          ))}
        </div>
      </section>

      {/* Compliance LGPD */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
            <i className="ri-shield-check-line text-primary-600"></i>
          </div>
          <div>
            <h3 className="font-heading font-bold text-foreground-900">Compliance e privacidade (LGPD)</h3>
            <p className="text-sm text-foreground-500">Consentimento e direitos do titular que a Ana respeita no automático.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Texto de consentimento</label>
            <textarea
              value={consentimento}
              onChange={(e) => setConsentimento(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 resize-none focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-background-100/50 border border-background-200/70 rounded-lg p-4">
              <p className="text-xs text-foreground-500 mb-1">Base legal</p>
              <p className="font-medium text-foreground-900 text-sm">{complianceLgpd.baseLegal}</p>
            </div>
            <div className="bg-background-100/50 border border-background-200/70 rounded-lg p-4">
              <p className="text-xs text-foreground-500 mb-1">Encarregado (DPO)</p>
              <p className="font-medium text-foreground-900 text-sm">{complianceLgpd.dpo}</p>
            </div>
            <div className="bg-background-100/50 border border-background-200/70 rounded-lg p-4">
              <p className="text-xs text-foreground-500 mb-1">Retenção de dados</p>
              <p className="font-medium text-foreground-900 text-sm">{complianceLgpd.retencaoDias} dias</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-2">Direitos do titular</label>
            <ul className="space-y-2">
              {complianceLgpd.direitosTitular.map((d) => (
                <li key={d} className="flex items-start gap-2 text-sm text-foreground-700">
                  <i className="ri-check-line text-primary-500 mt-0.5"></i>
                  {d}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-accent-100/60 border border-accent-200 rounded-lg p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-accent-800 mb-1">
              <i className="ri-error-warning-line"></i>
              Palavra de descadastro: "{complianceLgpd.palavraDescadastro}"
            </p>
            <p className="text-sm text-foreground-700">{complianceLgpd.acaoDescadastro}</p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="inline-flex items-center gap-2 text-primary-700 text-sm font-medium">
            <i className="ri-checkbox-circle-line"></i>
            Operação salva!
          </span>
        )}
        <button
          onClick={salvar}
          className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 px-8 py-3 rounded-lg font-heading font-bold text-sm transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-save-line"></i>
          Salvar operação
        </button>
      </div>
    </div>
  );
}