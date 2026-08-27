import { useSaudeWhatsapp, type NivelRisco } from '@/hooks/useSaudeWhatsapp';

const nivelVisual: Record<
  NivelRisco,
  { bar: string; text: string; dot: string; label: string; icon: string; card: string }
> = {
  seguro: {
    bar: 'bg-primary-500',
    text: 'text-primary-700',
    dot: 'bg-emerald-500',
    label: 'Conectado',
    icon: 'ri-whatsapp-line',
    card: 'bg-background-50 border-background-200/70',
  },
  atencao: {
    bar: 'bg-accent-500',
    text: 'text-accent-700',
    dot: 'bg-amber-500',
    label: 'Atenção',
    icon: 'ri-alert-line',
    card: 'bg-background-50 border-background-200/70',
  },
  critico: {
    bar: 'bg-accent-500',
    text: 'text-accent-700',
    dot: 'bg-rose-500',
    label: 'Desconectado',
    icon: 'ri-alarm-warning-line',
    card: 'bg-background-50 border-background-200/70',
  },
};

// Card de saúde do WhatsApp exibido no Dashboard. Mostra o risco de bloqueio em
// tempo real (estimado a partir de opt-outs e falta de engajamento) e dispara um
// alerta visual forte quando o risco ultrapassa o limite configurado.
export default function SaudeWhatsappCard() {
  const saude = useSaudeWhatsapp();
  const v = nivelVisual[saude.nivel];

  return (
    <div className={`rounded-xl p-5 border ${v.card} h-full flex flex-col`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative w-9 h-9 rounded-lg bg-background-100 flex items-center justify-center">
            <i className={`${v.icon} ${v.text} text-base`}></i>
            <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${v.dot} ring-2 ring-background-50`}></span>
          </div>
          <h3 className="text-sm font-bold text-foreground-800">WhatsApp</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-500">
          <span className={`w-2 h-2 rounded-full ${v.dot}`}></span>
          {v.label}
        </span>
      </div>

      {saude.nivel === 'critico' && (
        <div className="mb-4 flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
          <i className="ri-alarm-warning-line mt-0.5"></i>
          <span>
            <b>Risco alto de bloqueio ({saude.risco}%)!</b> Você está acima do limite de {saude.limite}%. Reduza
            envios proativos, revise o consentimento e confira o painel de qualidade da Meta.
          </span>
        </div>
      )}

      <div className="flex items-end justify-between mb-2">
        <span className="text-3xl font-heading font-extrabold text-foreground-950">{saude.risco}%</span>
        <span className="text-xs text-foreground-500">risco de bloqueio</span>
      </div>
      <div className="h-2.5 rounded-full bg-background-200 overflow-hidden mb-1">
        <div className={`h-full ${v.bar} transition-all`} style={{ width: `${saude.risco}%` }}></div>
      </div>
      <div className="flex justify-between text-[10px] text-foreground-400 mb-4">
        <span>0%</span>
        <span className="text-accent-600 font-semibold">alerta em {saude.limite}%</span>
        <span>100%</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center mt-auto">
        <div className="bg-background-100/50 rounded-lg p-3">
          <p className="text-xl font-bold text-foreground-900">{saude.totalEnvios}</p>
          <p className="text-[10px] text-foreground-500">Mensagens enviadas</p>
        </div>
        <div className="bg-background-100/50 rounded-lg p-3">
          <p className="text-xl font-bold text-foreground-900">{saude.optOuts}</p>
          <p className="text-[10px] text-foreground-500">Opt-outs</p>
        </div>
        <div className="bg-background-100/50 rounded-lg p-3">
          <p className="text-xl font-bold text-foreground-900">{saude.semResposta}</p>
          <p className="text-[10px] text-foreground-500">Sem resposta</p>
        </div>
      </div>
    </div>
  );
}