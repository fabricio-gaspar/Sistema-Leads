import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import PendingInvitesGate from '@/components/auth/PendingInvitesGate';

export default function InvitesPage() {
  const { user, loading, organizationReady, refreshOrganization, logout } = useAuth();
  const navigate = useNavigate();
  if (loading) return <div role="status">Confirmando sessão…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <PendingInvitesGate onSignOut={logout} onAccepted={async () => { await refreshOrganization(); navigate('/dashboard'); }} onContinue={organizationReady ? () => navigate('/dashboard') : undefined} />;
}
