import { useAuditoriaStore } from '@/hooks/useAuditoriaStore';

const EVENTO_META: Record<string, { icon: string; cor: string }> = {
  LEAD_CREATED: { icon: 'ri-user-add-line', cor: 'bg-primary-100 text-primary-700' },
  STAGE_CHANGED: { icon: 'ri-git-commit-line', cor: 'bg-accent-100 text-accent-700' },
  MESSAGE_SENT: { icon: 'ri-send-plane-line', cor: 'bg-primary-100 text-primary-600' },
  HANDOFF: { icon: 'ri-user-heart-line', cor: 'bg-amber-100 text-amber-600' },
  USER_INVITED: { icon: 'ri-user-add-line', cor: 'bg-primary-100 text-primary-700' },
  SETTINGS_CHANGED: { icon: 'ri-settings-4-line', cor: 'bg-secondary-100 text-secondary-700' },
  OPT_OUT: { icon: 'ri-forbid-line', cor: 'bg-accent-100 text-accent-600' },
  AUTOMATION_FAILED: { icon: 'ri-alert-line', cor: 'bg-accent-100 text-accent-600' },
  TEMPLATE_APPROVED: { icon: 'ri-check-double-line', cor: 'bg-primary-100 text-primary-600' },
  CHANNEL_TEST: { icon: 'ri-plug-line', cor: 'bg-secondary-100 text-secondary-700' },
  TASK_CREATED: { icon: 'ri-task-line', cor: 'bg-background-100 text-foreground-700' },
  MEETING_SCHEDULED: { icon: 'ri-calendar-check-line', cor: 'bg-primary-100 text-primary-600' },
  MEETING_REMINDER: { icon: 'ri-notification-3-line', cor: 'bg-amber-100 text-amber-600' },
  MEETING_NO_SHOW: { icon: 'ri-calendar-close-line', cor: 'bg-accent-100 text-accent-600' },
  HANDOFF_ETAPA_ALTERADO: { icon: 'ri-git-branch-line', cor: 'bg-accent-100 text-accent-700' },
};

const FALLBACK_META = { icon: 'ri-information-line', cor: 'bg-secondary-100 text-secondary-700' };

function formatarData(data: string): string {
  const m = data.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return data;
  return `${m[3]}/${m[2]} · ${m[4]}:${m[5]}`;
}

export default function AtividadeRecente() {
  const { registros } = useAuditoriaStore();
  const recentes = registros.slice(0, 8);

  return (
    <div className="bg-background-50 border border-background-200/60 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-secondary-100 flex items-center justify-center">
          <i className="ri-history-line text-secondary-700 text-sm"></i>
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground-800">Atividade recente</h3>
          <p className="text-[10px] text-foreground-400">O que aconteceu enquanto você não olhava</p>
        </div>
      </div>

      <div className="space-y-1 flex-1">
        {recentes.length === 0 ? (
          <p className="text-xs text-foreground-400 py-6 text-center">Nenhuma atividade registrada ainda.</p>
        ) : (
          recentes.map((r, i) => {
            const meta = EVENTO_META[r.evento] || FALLBACK_META;
            return (
              <div key={r.id} className="relative flex gap-2.5">
                {i < recentes.length - 1 && (
                  <span className="absolute left-3.5 top-8 bottom-0 w-px bg-background-200"></span>
                )}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${meta.cor}`}>
                  <i className={`${meta.icon} text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0 pb-2">
                  <p className="text-xs text-foreground-800 leading-snug">
                    <span className="font-semibold">{r.ator}</span>{' '}
                    <span className="text-foreground-500">{r.detalhes}</span>
                  </p>
                  <p className="text-[10px] text-foreground-400 mt-0.5">
                    {r.alvo} · {formatarData(r.data)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}