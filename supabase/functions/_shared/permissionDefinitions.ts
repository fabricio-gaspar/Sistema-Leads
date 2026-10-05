// Canonical framework-neutral definitions for Edge and UI.
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
