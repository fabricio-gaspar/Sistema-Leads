import CommercialAnalytics from '@/components/feature/CommercialAnalytics';

export default function Relatorios() {
  return <div className="wf-page wf-page--reports">
    <header className="wf-page-header"><div><p className="wf-eyebrow">Inteligência comercial</p><h1 className="wf-page-title">Relatórios</h1><p className="wf-page-description">Investigue períodos, origens e responsáveis. Salve recortes e exporte os registros usados na análise.</p></div></header>
    <CommercialAnalytics mode="reports" />
  </div>;
}
