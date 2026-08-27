import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { useConversasStore } from '@/hooks/useConversasStore';
import { usePropostasStore } from '@/hooks/usePropostasStore';
import SaudeWhatsappCard from '@/components/feature/SaudeWhatsappCard';

function Metric({ label, value, detail, icon, tone = 'primary' }: { label: string; value: number; detail: string; icon: string; tone?: 'primary' | 'secondary' | 'accent' }) {
  const tones = {
    primary: 'bg-primary-100 text-primary-700', secondary: 'bg-secondary-100 text-secondary-800', accent: 'bg-accent-100 text-accent-800',
  };
  return <div className="bg-background-50 border border-background-200/70 rounded-xl p-4">
    <div className="flex items-start justify-between"><div><p className="text-xs text-foreground-500">{label}</p><p className="mt-1 text-2xl font-heading font-extrabold text-foreground-950">{value}</p></div><span className={`w-9 h-9 rounded-lg flex items-center justify-center ${tones[tone]}`}><i className={icon}></i></span></div>
    <p className="mt-2 text-xs text-foreground-500">{detail}</p>
  </div>;
}

export default function Dashboard() {
  const [leads] = useLeadsStore();
  const { conversas } = useConversasStore();
  const { propostas } = usePropostasStore();
  const data = useMemo(() => {
    const handoff = leads.filter((lead) => lead.modoAtendimento === 'HUMANO' || lead.automacaoStatus === 'AGUARDANDO_HUMANO');
    const active = leads.filter((lead) => !['Fechado — Ganho', 'Fechado — Perdido'].includes(lead.etapa));
    const hot = active.filter((lead) => lead.temperatura === 'Quente');
    const quotes = propostas.filter((proposal) => ['enviada', 'visualizada'].includes(proposal.status));
    const expiring = quotes.filter((proposal) => new Date(`${proposal.validade}T23:59:59`).getTime() - Date.now() < 3 * 86400000);
    return { handoff, active, hot, quotes, expiring };
  }, [leads, propostas]);

  return <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-5">
    <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Central de operação</p><h1 className="mt-1 text-2xl md:text-3xl font-heading font-extrabold text-foreground-950">O que precisa da sua atenção</h1><p className="mt-1 text-sm text-foreground-500">Priorize conversas, orçamentos e decisões — sem distração comercial.</p></div>
      <div className="flex gap-2"><Link to="/dashboard/atendimento" className="inline-flex items-center gap-2 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-semibold"><i className="ri-customer-service-2-line"></i>Abrir atendimento</Link><Link to="/dashboard/kanban" className="inline-flex items-center gap-2 px-3 py-2 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-sm font-semibold"><i className="ri-layout-masonry-line"></i>Ver Kanban</Link></div>
    </header>

    <section className="grid grid-cols-2 xl:grid-cols-4 gap-3"><Metric label="Precisa de você" value={data.handoff.length} detail="Atendimentos com humano" icon="ri-user-received-line" tone="accent"/><Metric label="Leads no fluxo" value={data.active.length} detail="Oportunidades abertas" icon="ri-stack-line"/><Metric label="Alta prioridade" value={data.hot.length} detail="Leads com temperatura quente" icon="ri-fire-line" tone="secondary"/><Metric label="Orçamentos ativos" value={data.quotes.length} detail={`${data.expiring.length} vencendo em breve`} icon="ri-file-list-3-line"/></section>

    <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2 bg-background-50 border border-background-200/70 rounded-xl overflow-hidden"><div className="px-5 py-4 border-b border-background-200/70 flex items-center justify-between"><div><h2 className="font-heading font-bold text-foreground-950">Fila prioritária</h2><p className="text-xs text-foreground-500 mt-0.5">A Ana pausa automaticamente quando um humano assume.</p></div><Link className="text-xs font-semibold text-primary-700" to="/dashboard/atendimento">Ver inbox</Link></div><div className="divide-y divide-background-100">{data.handoff.slice(0, 5).map((lead) => <Link key={lead.id} to={`/dashboard/atendimento?leadId=${lead.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-background-100/70"><span className="w-9 h-9 rounded-full bg-secondary-100 text-secondary-800 flex items-center justify-center font-bold">{lead.nome.charAt(0)}</span><span className="flex-1 min-w-0"><strong className="block text-sm text-foreground-900 truncate">{lead.nome || lead.empresa}</strong><span className="text-xs text-foreground-500">{lead.empresa} · {lead.motivoTransferencia || 'Aguardando ação humana'}</span></span><i className="ri-arrow-right-s-line text-foreground-400 text-lg"></i></Link>)}{data.handoff.length === 0 && <div className="px-5 py-10 text-center text-sm text-foreground-500"><i className="ri-checkbox-circle-line text-primary-500 text-xl block mb-2"></i>Nenhum atendimento aguardando você.</div>}</div></div>
      <SaudeWhatsappCard />
    </section>

    <section className="grid grid-cols-1 lg:grid-cols-2 gap-5"><div className="bg-background-50 border border-background-200/70 rounded-xl p-5"><div className="flex items-center justify-between mb-4"><div><h2 className="font-heading font-bold text-foreground-950">Funil simplificado</h2><p className="text-xs text-foreground-500">Acompanhe a conversa até o orçamento.</p></div><Link className="text-xs font-semibold text-primary-700" to="/dashboard/kanban">Abrir Kanban</Link></div><div className="space-y-3">{['Novo','Em Contato','Em Qualificação','Orçamento Enviado','Negociação'].map((stage, index) => { const count = leads.filter((lead) => lead.etapa === stage).length; return <div key={stage} className="flex items-center gap-3"><span className="w-5 text-xs font-bold text-primary-600">{index + 1}</span><span className="w-36 text-sm text-foreground-700">{['Entrou','Em conversa','Qualificado','Orçamento enviado','Em decisão'][index]}</span><div className="flex-1 h-2 rounded-full bg-background-200 overflow-hidden"><div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.max(4, Math.min(100, count * 12))}%` }} /></div><span className="w-6 text-right text-xs font-semibold text-foreground-700">{count}</span></div>; })}</div></div>
      <div className="bg-background-50 border border-background-200/70 rounded-xl p-5"><h2 className="font-heading font-bold text-foreground-950">Qualidade da Ana</h2><p className="text-xs text-foreground-500 mt-0.5">Decisões sensíveis continuam sob controle humano.</p><div className="mt-4 grid grid-cols-3 gap-3"><div className="bg-background-100 rounded-lg p-3"><p className="text-xl font-bold text-foreground-950">{conversas.length}</p><p className="text-[11px] text-foreground-500">Conversas</p></div><div className="bg-background-100 rounded-lg p-3"><p className="text-xl font-bold text-foreground-950">{data.handoff.length}</p><p className="text-[11px] text-foreground-500">Handoffs</p></div><div className="bg-background-100 rounded-lg p-3"><p className="text-xl font-bold text-foreground-950">0</p><p className="text-[11px] text-foreground-500">Envios ativos</p></div></div><Link to="/dashboard/configuracoes" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700"><i className="ri-robot-2-line"></i>Personalizar a Ana</Link></div></section>
  </div>;
}
