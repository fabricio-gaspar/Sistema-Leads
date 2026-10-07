import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

import { defaultPermissionsForRole, type OrganizationPermission } from './permissionDefinitions.ts';
export { defaultPermissionsForRole, organizationPermissions, type OrganizationPermission } from './permissionDefinitions.ts';

export async function requireOrganizationPermission(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  permission: OrganizationPermission,
): Promise<void> {
  const { data: member, error: memberError } = await admin.from('organization_members')
    .select('role,status').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
  if (memberError || !member || member.status !== 'active') throw new Error('organization_access_denied');
  if (member.role === 'administrador') return;
  const { data: override, error: overrideError } = await admin.from('team_member_permissions')
    .select('allowed').eq('organization_id', organizationId).eq('user_id', userId).eq('permission', permission).maybeSingle();
  if (overrideError) throw overrideError;
  if (override ? override.allowed !== true : defaultPermissionsForRole(member.role)[permission] !== true) {
    throw new Error('permission_denied');
  }
}

export async function hasOrganizationPermission(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  permission: OrganizationPermission,
): Promise<boolean> {
  try {
    await requireOrganizationPermission(admin, organizationId, userId, permission);
    return true;
  } catch (error) {
    if (error instanceof Error && ['organization_access_denied', 'permission_denied'].includes(error.message)) return false;
    throw error;
  }
}
