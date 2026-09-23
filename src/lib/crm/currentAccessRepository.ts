import { supabase } from '@/lib/supabase';
import type { TeamPermission, TeamRole } from '@/lib/crm/teamMembersRepository';

export interface CurrentAccess {
  organizationId: string;
  role: TeamRole;
  permissions: Record<TeamPermission, boolean>;
}

const cache = new Map<string, Promise<CurrentAccess>>();

function parseAccess(value: unknown): CurrentAccess {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('organization_access_denied');
  const row = value as Record<string, unknown>;
  const permissions = row.permissions;
  if (typeof row.organization_id !== 'string' || typeof row.role !== 'string'
    || !permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    throw new Error('organization_access_invalid');
  }
  return {
    organizationId: row.organization_id,
    role: row.role as TeamRole,
    permissions: permissions as Record<TeamPermission, boolean>,
  };
}

export function loadCurrentAccess(userId: string, force = false): Promise<CurrentAccess> {
  if (!force && cache.has(userId)) return cache.get(userId)!;
  const request = Promise.resolve(supabase.rpc('current_user_access')).then(({ data, error }) => {
    if (error) throw error;
    return parseAccess(data);
  }).catch((error) => {
    cache.delete(userId);
    throw error;
  });
  cache.set(userId, request);
  return request;
}

export function hasAnyPermission(access: CurrentAccess | null, permissions: TeamPermission[]): boolean {
  if (!access) return false;
  return permissions.some((permission) => access.permissions[permission] === true);
}

export function clearCurrentAccess(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}
