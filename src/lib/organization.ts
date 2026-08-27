import { supabase } from '@/lib/supabase';
import { organizationSlug } from '@/lib/organizationSlug';

export interface OrganizationBootstrapInput {
  legalName: string;
  displayName: string;
  timezone?: string;
}

// This function is intentionally the only client bootstrap path for a tenant.
// The RPC creates the organization, owner membership and settings atomically.
export async function bootstrapOrganization(userId: string, input: OrganizationBootstrapInput): Promise<void> {
  const legalName = input.legalName.trim();
  const displayName = input.displayName.trim();
  if (!legalName || !displayName) return;

  const { data: existingMembership, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1);
  if (!membershipError && existingMembership && existingMembership.length > 0) return;

  const { error } = await supabase.rpc('create_organization', {
    organization_legal_name: legalName,
    organization_display_name: displayName,
    organization_slug: organizationSlug(displayName, userId),
    organization_timezone: input.timezone ?? 'America/Sao_Paulo',
  });
  if (error) throw error;
}
