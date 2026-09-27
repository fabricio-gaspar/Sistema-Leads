import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTarefasStore } from '@/hooks/useTarefasStore';

const PRIORIDADE: Record<string, { label: string; chip: string }> = {
  ALTA: { label: 'Alta', chip: 'bg-accent-100 text-accent-700' },
  MEDIA: { label: 'Média', chip: 'bg-amber-100 text-amber-700' },
  BAIXA: { label: 'Baixa', chip: 'bg-secondary-100 text-secondary-700' },
};

function formatarLimite(iso?: string): string {
  if (!iso) return 'sem prazo';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'sem prazo';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function FilaTarefas() {
  const { tarefas } = useTarefasStore();
  const agora = Date.now();

  const abertas = useMemo(
    () =>
      tarefas
        .filter((t) => !t.concluida)
        .sort((a, b) => {
          const va = a.dataLimite ? new Date(a.dataLimite).getTime() : Infinity;
          const vb = b.dataLimite ? new Date(b.dataLimite).getTime() : Infinity;
          return va - vb;
        })
        .slice(0, 6),
    [tarefas]
  );

  const vencidas = abertas.filter((t) => t.dataLimite && new Date(t.dataLimite).getTime() < agora).length;

  return (
    <div className="bg-background-50 border border-background-200/60 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-100 flex items-center justify-center">
            <i className="ri-checkbox-circle-line text-accent-700 text-sm"></i>
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground-800">Fila de tarefas</h3>
            <p className="text-[10px] text-foreground-400">Atividades abertas para a equipe</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-700 text-[10px] font-semibold">
          {vencidas} vencida(s)
        </span>
      </div>

      <div className="mt-3 space-y-1.5 flex-1">
        {abertas.length === 0 ? (
          <p className="text-xs text-foreground-400 py-6 text-center">Nenhuma tarefa em aberto. Tudo em dia!</p>
        ) : (
          abertas.map((t) => {
            const vencida = t.dataLimite && new Date(t.dataLimite).getTime() < agora;
            const p = PRIORIDADE[t.prioridade] || PRIORIDADE.MEDIA;
            return (
              <div
                key={t.id}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-2 -mx-1 border ${
                  vencida ? 'border-accent-200 bg-accent-50' : 'border-transparent hover:border-background-200 hover:bg-background-100/60'
                } transition-colors`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    vencida ? 'bg-accent-100 text-accent-600' : 'bg-background-100 text-foreground-500'
                  }`}
                >
                  <i className={`${vencida ? 'ri-alert-line' : 'ri-task-line'} text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground-800 leading-tight truncate">{t.titulo}</p>
                  <p className="text-[10px] text-foreground-400 truncate">
                    {t.leadNome || t.responsavel} · {formatarLimite(t.dataLimite)}
                  </p>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.chip} shrink-0`}>
                  {p.label}
                </span>
              </div>
            );
          })
        )}
      </div>

      <Link
        to="/dashboard/agenda"
        className="mt-2 text-[11px] text-primary-600 hover:text-primary-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
      >
        Ver todas as tarefas
        <i className="ri-arrow-right-line text-xs"></i>
      </Link>
    </div>
  );
}