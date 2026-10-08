import { useCurrentAccess } from '@/hooks/useCurrentAccess';
import { hasAnyPermission } from '@/lib/crm/currentAccessRepository';
import type { TeamPermission } from '@/lib/crm/teamMembersRepository';
import WaAkgPanel from '@/components/feature/WaAkgPanel';
import Atendimento from './page';

const conversationPermissions: TeamPermission[] = ['conversations.read_all', 'conversations.reply_all', 'conversations.reply_assigned'];

/**
 * One navigation entry serves both roles without broadening conversation access.
 * Sellers who can only manage their own channel get the private WA-AKG
 * pairing area; conversation-capable users mount the full Central workspace.
 */
export default function AtendimentoEntry() {
  const { access, loading } = useCurrentAccess();

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><span className="h-8 w-8 animate-spin rounded-full border-2 border-background-200 border-t-primary-500" /></div>;
  }

  if (hasAnyPermission(access, conversationPermissions)) return <Atendimento />;

  return <div className="wf-page space-y-5">
    <header className="wf-page-header">
      <div>
        <p className="wf-eyebrow">ATENDIMENTO</p>
        <h1 className="wf-page-title">Central de Atendimento</h1>
        <p className="mt-1 text-sm text-foreground-500">Conecte seu WhatsApp individual para receber conversas atribuídas a você. Conversas, Ana e histórico continuam protegidos pelas permissões de atendimento.</p>
      </div>
    </header>
    <WaAkgPanel mode="self-service" surface="central" />
  </div>;
}
