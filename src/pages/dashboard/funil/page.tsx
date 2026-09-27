import CommercialAnalytics from '@/components/feature/CommercialAnalytics';

export default function FunilConversao() {
  return <div className="wf-page wf-page--funnel">
    <header className="wf-page-header"><div><p className="wf-eyebrow">Inteligência comercial</p><h1 className="wf-page-title">Funil</h1><p className="wf-page-description">Da carteira atribuída ao desfecho. Distribuição atual e histórico observado, sem misturar revisão com oportunidade comercial.</p></div></header>
    <CommercialAnalytics mode="funnel" />
  </div>;
}
