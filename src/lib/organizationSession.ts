import { supabase } from '@/lib/supabase';
import { sessionContext, broadcastContextInvalidation, type SessionContext } from '@/lib/sessionContext';

export interface OrganizationSession {
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'manager' | 'seller' | 'viewer';
  context: SessionContext;
}

export async function resolveOrganizationSession(): Promise<OrganizationSession> {
  const context = sessionContext.get();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  sessionContext.assertCurrent(context);
  if (authError || !authData.user) throw new Error('authentication_required');

  const userId = authData.user.id;
  if (context.userId !== userId) throw new Error('session_context_changed');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', userId)
    .maybeSingle();
  sessionContext.assertCurrent(context);
  if (profileError) throw profileError;

  const activeOrganizationId = profile?.active_organization_id as string | null | undefined;
  const membershipQuery = supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .eq('status', 'active');

  const { data: membership, error: membershipError } = activeOrganizationId
    ? await membershipQuery.eq('organization_id', activeOrganizationId).maybeSingle()
    : await membershipQuery.order('created_at', { ascending: true }).limit(1).maybeSingle();
  sessionContext.assertCurrent(context);

  if (membershipError || !membership) throw new Error('organization_context_required');

  if (!activeOrganizationId) {
    const { error } = await supabase.rpc('set_active_organization', { target_organization_id: membership.organization_id });
    sessionContext.assertCurrent(context);
    if (error) throw error;
  }

  const confirmed = sessionContext.confirm(context, userId, membership.organization_id);
  // A caller carrying data from a prior tenant must not continue with the new one.
  if (context.organizationId && context.organizationId !== membership.organization_id) throw new Error('organization_context_changed');
  return {
    organizationId: membership.organization_id,
    userId,
    role: membership.role as OrganizationSession['role'],
    context: confirmed,
  };
}

export function assertOrganizationSession(session: OrganizationSession): void {
  sessionContext.assertCurrent(session.context);
}

/** Clear every consumer before changing the canonical organization. */
export async function switchOrganization(organizationId: string): Promise<OrganizationSession> {
  const previous = sessionContext.requireReady();
  const pending = sessionContext.replace(previous.userId);
  const { error } = await supabase.rpc('set_active_organization', { target_organization_id: organizationId });
  sessionContext.assertCurrent(pending);
  if (error) throw error;
  const session = await resolveOrganizationSession();
  broadcastContextInvalidation('refresh');
  return session;
}
