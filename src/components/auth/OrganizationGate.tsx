import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import PendingInvitesGate from '@/components/auth/PendingInvitesGate';

/** No CRM hook, cache consumer or route mounts until the context is canonical. */
export default function OrganizationGate({ children }: { children: ReactNode }) {
  const { user, loading, organizationReady, organizationError, refreshOrganization, logout } = useAuth();
  if (loading) return <div role="status">Confirmando sessão…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (organizationReady) return children;
  if (organizationError) return <PendingInvitesGate onAccepted={refreshOrganization} onSignOut={logout} />;
  return <div role="status">Confirmando acesso à organização…</div>;
}
