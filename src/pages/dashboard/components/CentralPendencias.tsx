import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { usePropostasStore } from '@/hooks/usePropostasStore';
import { useTarefasStore } from '@/hooks/useTarefasStore';
import { stageFromLegacy } from '@/domain/pipeline';

interface Pendencia {
  id: string;
  label: string;
  valor: number;
  descricao: string;
  icon: string;
  cor: string;
  to: string;
}

export default function CentralPendencias() {
  const [leads] = useLeadsStore();
  const { propostas } = usePropostasStore();
  const { tarefas } = useTarefasStore();

  const pendencias = useMemo<Pendencia[]>(() => {
    const agora = Date.now();

    const aguardandoHumano = leads.filter((l) => l.automacaoStatus === 'AGUARDANDO_HUMANO').length;

    const automacoesPendentes = leads.filter(
      (l) =>
        l.automacaoStatus === 'ATIVA' &&
        !l.bloqueado &&
        ((l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() > agora) ||
          (l.timeoutAt && new Date(l.timeoutAt).getTime() > agora))
    ).length;

    const travados = leads.filter((lead) => {
      if (['entered', 'won', 'lost'].includes(stageFromLegacy(lead.etapa))) return false;
      return /(dia|dias|semana)/i.test(lead.ultimaInteracao);
    }).length;

    const orcamentosSemResposta = propostas.filter((p) =>
      ['enviada', 'visualizada', 'expirada'].includes(p.status)
    ).length;

    const tarefasAbertas = tarefas.filter((t) => !t.concluida).length;
    const tarefasVencidas = tarefas.filter(
      (t) => !t.concluida && t.dataLimite && new Date(t.dataLimite).getTime() < agora
    ).length;

    return [
      {
        id: 'humano',
        label: 'Aguardando humano',
        valor: aguardandoHumano,
        descricao: 'leads transferidos pela Ana',
        icon: 'ri-user-heart-line',
        cor: 'bg-accent-100 text-accent-600',
        to: '/dashboard/atendimento',
      },
      {
        id: 'automacoes',
        label: 'Automações pendentes',
        valor: automacoesPendentes,
        descricao: 'follow-ups e timeouts na fila',
        icon: 'ri-timer-flash-line',
        cor: 'bg-amber-100 text-amber-600',
        to: '/dashboard/kanban',
      },
      {
        id: 'travados',
        label: 'Leads travados',
        valor: travados,
        descricao: 'sem avançar há dias',
        icon: 'ri-git-commit-line',
        cor: 'bg-amber-100 text-amber-700',
        to: '/dashboard/kanban',
      },
      {
        id: 'orcamentos',
        label: 'Orçamentos sem resposta',
        valor: orcamentosSemResposta,
        descricao: 'enviados aguardando retorno',
        icon: 'ri-file-list-3-line',
        cor: 'bg-primary-100 text-primary-700',
        to: '/dashboard/orcamentos',
      },
      {
        id: 'tarefas',
        label: 'Tarefas abertas',
        valor: tarefasAbertas,
        descricao: `${tarefasVencidas} vencida(s)`,
        icon: 'ri-task-line',
        cor: 'bg-background-100 text-foreground-700',
        to: '/dashboard/agenda',
      },
    ];
  }, [leads, propostas, tarefas]);

  const total = pendencias.reduce((s, p) => s + p.valor, 0);

  return (
    <div className="bg-background-50 border border-background-200/60 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-100 flex items-center justify-center">
            <i className="ri-alarm-warning-line text-accent-700 text-sm"></i>
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground-800">Central de pendências</h3>
            <p className="text-[10px] text-foreground-400">O que está parado esperando ação</p>
          </div>
        </div>
        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-foreground-900 text-background-50 text-xs font-bold">
          {total}
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        {pendencias.map((p) => (
          <Link
            key={p.id}
            to={p.to}
            className="group flex items-center gap-2.5 rounded-lg border border-transparent hover:border-background-200 hover:bg-background-100/60 px-2 py-2 -mx-1 transition-colors cursor-pointer"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${p.cor}`}>
              <i className={`${p.icon} text-sm`}></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground-800 leading-tight">{p.label}</p>
              <p className="text-[10px] text-foreground-400 truncate">{p.descricao}</p>
            </div>
            <span className="text-base font-heading font-bold text-foreground-900">{p.valor}</span>
            <i className="ri-arrow-right-s-line text-foreground-400 group-hover:text-foreground-600 group-hover:translate-x-0.5 transition-all text-sm"></i>
          </Link>
        ))}
      </div>
    </div>
  );
}
