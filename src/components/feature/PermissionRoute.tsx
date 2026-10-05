import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentAccess } from '@/hooks/useCurrentAccess';
import { hasAnyPermission } from '@/lib/crm/currentAccessRepository';
import type { TeamPermission } from '@/lib/crm/teamMembersRepository';

export default function PermissionRoute({ anyOf, children }: { anyOf: TeamPermission[]; children: ReactNode }) {
  const { access, loading } = useCurrentAccess();
  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><span className="h-8 w-8 animate-spin rounded-full border-2 border-background-200 border-t-primary-500" /></div>;
  }
  if (!hasAnyPermission(access, anyOf)) return <Navigate to="/dashboard" replace />;
  return children;
}
