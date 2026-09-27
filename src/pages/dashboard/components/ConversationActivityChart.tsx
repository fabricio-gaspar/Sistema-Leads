import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Conversa } from '@/mocks/atendimentoData';
import { buildConversationActivity, type ConversationRealtimeState } from './conversationActivity';
import InfoTooltip from '@/components/feature/InfoTooltip';

function realtimeLabel(state: ConversationRealtimeState): string {
  if (state === 'live') return 'Ao vivo';
  if (state === 'unavailable') return 'Tempo real indisponível';
  return 'Conectando';
}

export default function ConversationActivityChart({ conversas, realtimeState, loadState = 'ready' }: { conversas: Conversa[]; realtimeState: ConversationRealtimeState; loadState?: 'loading' | 'ready' | 'error' }) {
  const activity = buildConversationActivity(conversas);
  const total = activity.reduce((sum, point) => sum + point.total, 0);
  const recebidas = activity.reduce((sum, point) => sum + point.recebidas, 0);
  const enviadas = activity.reduce((sum, point) => sum + point.enviadas, 0);
  const hasActivity = total > 0;

  return <article className="wf-surface wf-conversation-chart overflow-hidden" aria-label="Atividade das conversas nas últimas 24 horas">
    <div className="wf-overview-heading border-b border-background-200/80 px-4 py-3 md:px-5">
      <div>
        <div className="flex flex-wrap items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-background-100 text-foreground-700"><i className="ri-message-3-line" aria-hidden="true" /></span><h2>Conversas nas últimas 24 horas</h2><InfoTooltip text="Mensagens recebidas e enviadas por hora, com atualização pelo canal Realtime quando disponível." label="Sobre o gráfico de conversas" align="start" /><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${realtimeState === 'live' ? 'bg-[#168654]/10 text-[#116B43]' : realtimeState === 'unavailable' ? 'bg-[#BC8B42]/10 text-[#8C651D]' : 'bg-background-100 text-foreground-600'}`}>{realtimeLabel(realtimeState)}</span></div>
      </div>
      <div className="flex gap-3 text-xs font-medium text-foreground-600" aria-label={`${recebidas} recebidas e ${enviadas} enviadas`}>
        <span><i className="ri-arrow-down-line mr-1 text-primary-600" aria-hidden="true" />{recebidas} recebidas</span>
        <span><i className="ri-arrow-up-line mr-1 text-primary-600" aria-hidden="true" />{enviadas} enviadas</span>
      </div>
    </div>
    {loadState === 'ready' && hasActivity ? <div className="overflow-x-auto bg-white px-4 pb-3 pt-4 md:px-5" aria-label="Gráfico rolável horizontalmente">
      <div className="h-60 min-w-[52rem] rounded-[16px] border border-background-200/80 bg-white px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={activity} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="#E9EDF3" strokeDasharray="3 4" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#69717d', fontSize: 12 }} minTickGap={16} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#69717d', fontSize: 12 }} />
            <Tooltip cursor={{ fill: '#F2F4F8' }} contentStyle={{ borderRadius: 14, borderColor: '#E3E7ED', boxShadow: '0 12px 28px rgba(20,21,26,0.12)' }} labelStyle={{ color: '#14151A', fontWeight: 600 }} />
            <Bar dataKey="recebidas" name="Recebidas" stackId="mensagens" fill="#111318" radius={[6, 6, 0, 0]} barSize={16} />
            <Bar dataKey="enviadas" name="Enviadas" stackId="mensagens" fill="#169b62" radius={[6, 6, 0, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-foreground-500">Role horizontalmente para percorrer as 24 horas.</p>
    </div> : <div className="px-4 py-8 text-sm text-foreground-500 md:px-5">{loadState === 'loading' ? 'Consultando conversas…' : loadState === 'error' ? 'Não foi possível confirmar a atividade das conversas.' : 'Nenhuma mensagem de conversa registrada nas últimas 24 horas.'}</div>}
    {realtimeState === 'unavailable' && <p className="border-t border-background-100 px-4 py-2 text-xs text-amber-800 md:px-5">A consulta permanece real, mas novas mensagens exigirão atualizar a página até a conexão ser restabelecida.</p>}
  </article>;
}
