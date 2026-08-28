import { useState } from 'react';
import { useSaudeWhatsapp, type NivelRisco } from '@/hooks/useSaudeWhatsapp';

const nivelVisual: Record<
  NivelRisco,
  { bar: string; text: string; chip: string; label: string; icon: string }
> = {
  seguro: {
    bar: 'bg-primary-500',
    text: 'text-primary-700',
    chip: 'bg-primary-100',
    label: 'Saudável',
    icon: 'ri-shield-check-line',
  },
  sem_dados: { bar: 'bg-background-300', text: 'text-foreground-600', chip: 'bg-background-100', label: 'Sem telemetria', icon: 'ri-information-line' },
  atencao: {
    bar: 'bg-accent-500',
    text: 'text-accent-700',
    chip: 'bg-accent-100',
    label: 'Atenção',
    icon: 'ri-alert-line',
  },
  alto: { bar: 'bg-accent-500', text: 'text-accent-700', chip: 'bg-accent-100', label: 'Risco alto', icon: 'ri-alarm-warning-line' },
  critico: {
    bar: 'bg-accent-500',
    text: 'text-accent-700',
    chip: 'bg-accent-100',
    label: 'Risco alto',
    icon: 'ri-alarm-warning-line',
  },
};

export default function SaudeWhatsappIndicator() {
  const saude = useSaudeWhatsapp();
  const [aberto, setAberto] = useState(false);
  const v = nivelVisual[saude.nivel];

  return (
    <div className="relative">
      <button
        onClick={() => setAberto(!aberto)}
        title="Saúde do WhatsApp"
        className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 cursor-pointer transition-colors"
      >
        <i className={`${v.icon} ${v.text} text-lg`}></i>
        {saude.nivel !== 'seguro' && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent-500 border-2 border-background-50"></span>
        )}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)}></div>
          <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 bg-background-50 border border-background-200/70 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-background-200/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className={`${v.icon} ${v.text}`}></i>
                <span className="font-semibold text-foreground-900 text-sm">Saúde do WhatsApp</span>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${v.chip} ${v.text}`}>{v.label}</span>
            </div>
            <div className="p-4">
              <div className="flex items-end justify-between mb-2">
                <span className="text-2xl font-heading font-extrabold text-foreground-950">{saude.risco}%</span>
                <span className="text-xs text-foreground-500">sinal operacional</span>
              </div>
              <div className="h-2 rounded-full bg-background-200 overflow-hidden mb-1">
                <div className={`h-full ${v.bar} transition-all`} style={{ width: `${saude.risco}%` }}></div>
              </div>
              <div className="flex justify-between text-[10px] text-foreground-400 mb-4">
                <span>0%</span>
                <span className="text-accent-600 font-semibold">alerta em {saude.limite}%</span>
                <span>100%</span>
              </div>

              {saude.nivel === 'critico' && (
                <div className="mb-3 flex items-start gap-2 text-xs text-accent-700 bg-accent-50 border border-accent-200 rounded-lg px-3 py-2">
                  <i className="ri-alarm-warning-line mt-0.5"></i>
                  <span>
                    Risco alto de bloqueio! Reduza envios proativos, revise o consentimento e confira o painel de
                    qualidade da Meta.
                  </span>
                </div>
              )}

              <div className="space-y-1.5 text-sm text-foreground-700">
                <div className="flex justify-between">
                  <span>Mensagens enviadas</span>
                  <b>{saude.totalEnvios}</b>
                </div>
                <div className="flex justify-between">
                  <span>Opt-outs recebidos</span>
                  <b>{saude.optOuts}</b>
                </div>
                <div className="flex justify-between">
                  <span>Sem resposta</span>
                  <b>{saude.semResposta}</b>
                </div>
              </div>
              <p className="text-[10px] text-foreground-400 mt-3 leading-relaxed">
                Telemetria registrada pelo provedor e decisões do servidor. A Meta continua sendo a fonte oficial de qualidade do número.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
