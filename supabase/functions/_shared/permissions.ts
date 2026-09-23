import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

export const organizationPermissions = [
  'leads.read_all', 'leads.read_assigned', 'leads.create', 'leads.edit_all',
  'leads.edit_assigned', 'leads.delete', 'conversations.read_all',
  'conversations.reply_all', 'conversations.reply_assigned', 'messages.delete',
  'prospecting.manage', 'proposals.manage', 'configuration.manage',
  'website_entry.manage', 'team.manage', 'audit.view',
  'channels.view_own', 'channels.connect_own', 'channels.manage_all',
] as const;

export type OrganizationPermission = typeof organizationPermissions[number];

const roleDefaults: Record<string, OrganizationPermission[]> = {
  administrador: [...organizationPermissions],
  sdr: [
    'leads.read_all', 'leads.read_assigned', 'leads.create', 'leads.edit_all', 'leads.edit_assigned',
    'conversations.read_all', 'conversations.reply_all', 'prospecting.manage', 'proposals.manage',
  ],
  vendedor: [
    'leads.read_assigned', 'leads.create', 'leads.edit_assigned',
    'conversations.reply_assigned', 'proposals.manage',
    'channels.view_own', 'channels.connect_own',
  ],
  cx: ['leads.read_all', 'leads.read_assigned', 'leads.edit_assigned', 'conversations.read_all', 'conversations.reply_all'],
};

export function defaultPermissionsForRole(role: string): Record<OrganizationPermission, boolean> {
  const allowed = new Set(roleDefaults[role] ?? []);
  return Object.fromEntries(organizationPermissions.map((permission) => [permission, allowed.has(permission)])) as Record<OrganizationPermission, boolean>;
}

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
