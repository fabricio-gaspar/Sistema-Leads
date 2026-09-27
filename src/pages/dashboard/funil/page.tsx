import CommercialAnalytics from '@/components/feature/CommercialAnalytics';
import { useCurrentAccess } from '@/hooks/useCurrentAccess';
import LeadBaseManager from '../leads/components/LeadBaseManager';

export default function FunilConversao() {
  const { access, loading: accessLoading } = useCurrentAccess();
  const canViewLeadBase = !accessLoading && access?.permissions['leads.read_all'] === true;

  return <div className="wf-page wf-page--funnel">
    <header className="wf-page-header">
      <div>
        <p className="wf-eyebrow">Inteligência comercial</p>
        <h1 className="wf-page-title">Funil</h1>
        <p className="wf-page-description">Da carteira atribuída ao desfecho. Distribuição atual e histórico observado, sem misturar revisão com oportunidade comercial.</p>
      </div>
      {canViewLeadBase && <a href="#gestao-base-leads" className="wf-btn-secondary whitespace-nowrap">
          <i className="ri-delete-bin-6-line" aria-hidden="true" />
          Gerenciar base
        </a>}
    </header>
    <CommercialAnalytics mode="funnel" />
    {canViewLeadBase && <div id="gestao-base-leads" className="scroll-mt-24 pt-2">
      <LeadBaseManager />
    </div>}
  </div>;
}
