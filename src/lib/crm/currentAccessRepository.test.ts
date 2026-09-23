import { describe, expect, it } from 'vitest';
import { hasAnyPermission, type CurrentAccess } from './currentAccessRepository';
import type { TeamPermission } from './teamMembersRepository';

function access(allowed: TeamPermission[]): CurrentAccess {
  return {
    organizationId: 'a1111111-1111-4111-8111-111111111111',
    role: 'vendedor',
    permissions: Object.fromEntries(allowed.map((permission) => [permission, true])) as Record<TeamPermission, boolean>,
  };
}

describe('current user module access', () => {
  it('shows the seller WhatsApp module only with an effective channel permission', () => {
    const seller = access(['leads.read_assigned', 'channels.view_own', 'channels.connect_own']);
    expect(hasAnyPermission(seller, ['channels.view_own', 'channels.manage_all'])).toBe(true);
    expect(hasAnyPermission(seller, ['configuration.manage', 'team.manage'])).toBe(false);
  });

  it('fails closed while access is unavailable', () => {
    expect(hasAnyPermission(null, ['channels.view_own'])).toBe(false);
  });
});
