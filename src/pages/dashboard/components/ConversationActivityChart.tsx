import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Conversa } from '@/mocks/atendimentoData';
import { buildConversationActivity, type ConversationRealtimeState } from './conversationActivity';

function realtimeLabel(state: ConversationRealtimeState): string {
  if (state === 'live') return 'Ao vivo';
  if (state === 'unavailable') return 'Tempo real indisponível';
  return 'Conectando';
}

export default function ConversationActivityChart({ conversas, realtimeState }: { conversas: Conversa[]; realtimeState: ConversationRealtimeState }) {
  const activity = buildConversationActivity(conversas);
  const total = activity.reduce((sum, point) => sum + point.total, 0);
  const recebidas = activity.reduce((sum, point) => sum + point.recebidas, 0);
  const enviadas = activity.reduce((sum, point) => sum + point.enviadas, 0);
  const hasActivity = total > 0;

  return <article className="wf-surface overflow-hidden" aria-label="Atividade das conversas nas últimas 24 horas">
    <div className="wf-overview-heading border-b border-background-200 px-4 py-3 md:px-5">
      <div>
        <div className="flex flex-wrap items-center gap-2"><h2>Conversas nas últimas 24 horas</h2><span className={`rounded-md px-2 py-1 text-xs font-semibold ${realtimeState === 'live' ? 'bg-emerald-50 text-emerald-800' : realtimeState === 'unavailable' ? 'bg-amber-50 text-amber-800' : 'bg-background-100 text-foreground-600'}`}>{realtimeLabel(realtimeState)}</span></div>
        <p>Mensagens recebidas e enviadas por hora</p>
      </div>
      <div className="flex gap-3 text-xs font-medium text-foreground-600" aria-label={`${recebidas} recebidas e ${enviadas} enviadas`}>
        <span><i className="ri-arrow-down-line mr-1 text-primary-600" aria-hidden="true" />{recebidas} recebidas</span>
        <span><i className="ri-arrow-up-line mr-1 text-emerald-600" aria-hidden="true" />{enviadas} enviadas</span>
      </div>
    </div>
    {hasActivity ? <div className="overflow-x-auto px-4 pb-3 pt-4 md:px-5" aria-label="Gráfico rolável horizontalmente">
      <div className="h-60 min-w-[52rem]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={activity} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke="#e8ece8" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} minTickGap={16} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
            <Tooltip cursor={{ fill: '#f4f7f4' }} contentStyle={{ borderRadius: 10, borderColor: '#dfe5df' }} labelStyle={{ color: '#1f2937' }} />
            <Bar dataKey="recebidas" name="Recebidas" stackId="mensagens" fill="#2684d9" radius={[3, 3, 0, 0]} />
            <Bar dataKey="enviadas" name="Enviadas" stackId="mensagens" fill="#0c9b62" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-foreground-500">Role horizontalmente para percorrer as 24 horas.</p>
    </div> : <div className="px-4 py-8 text-sm text-foreground-500 md:px-5">Nenhuma mensagem de conversa registrada nas últimas 24 horas.</div>}
    {realtimeState === 'unavailable' && <p className="border-t border-background-100 px-4 py-2 text-xs text-amber-800 md:px-5">A consulta permanece real, mas novas mensagens exigirão atualizar a página até a conexão ser restabelecida.</p>}
  </article>;
}
