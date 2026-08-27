import { supabase } from '@/lib/supabase';

export interface OrganizationSession {
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'manager' | 'seller' | 'viewer';
}

export async function resolveOrganizationSession(): Promise<OrganizationSession> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('authentication_required');

  const userId = authData.user.id;
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', userId)
    .maybeSingle();

  const activeOrganizationId = profile?.active_organization_id as string | null | undefined;
  const membershipQuery = supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .eq('status', 'active');

  const { data: membership, error: membershipError } = activeOrganizationId
    ? await membershipQuery.eq('organization_id', activeOrganizationId).maybeSingle()
    : await membershipQuery.order('created_at', { ascending: true }).limit(1).maybeSingle();

  if (membershipError || !membership) throw new Error('organization_context_required');

  if (!activeOrganizationId) {
    await supabase.rpc('set_active_organization', { target_organization_id: membership.organization_id });
  }

  return {
    organizationId: membership.organization_id,
    userId,
    role: membership.role as OrganizationSession['role'],
  };
}
