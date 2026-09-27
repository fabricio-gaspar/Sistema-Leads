import { useMemo } from 'react';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { useConversasStore } from '@/hooks/useConversasStore';
import { usePropostasStore } from '@/hooks/usePropostasStore';
import { useCompromissosStore } from '@/hooks/useCompromissosStore';
import { stageFromLegacy } from '@/domain/pipeline';

export default function TelemetriaAna() {
  const [leads] = useLeadsStore();
  const { conversas } = useConversasStore();
  const { propostas } = usePropostasStore();
  const { compromissos } = useCompromissosStore();

  const stats = useMemo(() => {
    const mensagens = conversas.reduce(
      (s, c) => s + c.mensagens.filter((m) => m.autor === 'ana').length,
      0
    );
    const qualificados = leads.filter((lead) => {
      const stage = stageFromLegacy(lead.etapa);
      return !['entered', 'won', 'lost'].includes(stage);
    }).length;
    const reunioes = compromissos.filter((c) => c.origem === 'ana' || c.responsavel === 'Ana (IA)').length;
    const handoffs = leads.filter((l) => l.automacaoStatus === 'AGUARDANDO_HUMANO').length;
    const optOuts = leads.filter((l) => l.bloqueado).length;
    const orcamentos = propostas.filter((p) => p.responsavel === 'Ana (IA)').length;
    return { mensagens, qualificados, reunioes, handoffs, optOuts, orcamentos };
  }, [conversas, leads, compromissos, propostas]);

  const itens = [
    { label: 'Mensagens enviadas', valor: stats.mensagens, icon: 'ri-send-plane-line', cor: 'text-primary-600' },
    { label: 'Leads qualificados', valor: stats.qualificados, icon: 'ri-user-star-line', cor: 'text-accent-600' },
    { label: 'Reuniões agendadas', valor: stats.reunioes, icon: 'ri-calendar-check-line', cor: 'text-primary-500' },
    { label: 'Handoffs p/ humano', valor: stats.handoffs, icon: 'ri-user-heart-line', cor: 'text-amber-500' },
    { label: 'Opt-outs', valor: stats.optOuts, icon: 'ri-forbid-line', cor: 'text-accent-500' },
    { label: 'Orçamentos em preparo', valor: stats.orcamentos, icon: 'ri-file-list-3-line', cor: 'text-secondary-600' },
  ];

  return (
    <div className="bg-background-50 border border-background-200/60 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center">
          <i className="ri-robot-2-line text-primary-700 text-sm"></i>
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground-800">O que a Ana fez hoje</h3>
          <p className="text-[10px] text-foreground-400">Operação da IA em tempo real</p>
        </div>
      </div>

      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 flex-1">
        {itens.map((item) => (
          <div
            key={item.label}
            className="bg-background-100/50 rounded-lg p-2.5 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-foreground-500 leading-tight">{item.label}</span>
              <i className={`${item.icon} ${item.cor} text-sm`}></i>
            </div>
            <p className="text-lg font-heading font-extrabold text-foreground-900">{item.valor}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
