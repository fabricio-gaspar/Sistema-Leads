import { supabase } from '@/lib/supabase';
import { sessionContext } from '@/lib/sessionContext';
import type { TeamPermission, TeamRole } from '@/lib/crm/teamMembersRepository';

export interface CurrentAccess {
  organizationId: string;
  role: TeamRole;
  permissions: Record<TeamPermission, boolean>;
}

const cache = new Map<string, { request: Promise<CurrentAccess>; expiresAt: number }>();
const listeners = new Set<() => void>();
let revision = 0;
export const getAccessRevision = () => revision;
export const subscribeAccessRevision = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
sessionContext.subscribe(() => clearCurrentAccess());

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
  const context = sessionContext.requireReady();
  if (context.userId !== userId) return Promise.reject(new Error('session_context_changed'));
  const key = `${userId}:${context.organizationId}:${context.generation}`;
  const cached = cache.get(key);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.request;
  const request = Promise.resolve(supabase.rpc('current_user_access')).then(({ data, error }) => {
    sessionContext.assertCurrent(context);
    if (cache.get(key)?.request !== request) throw new Error('organization_access_invalidated');
    if (error) throw error;
    const access = parseAccess(data);
    if (access.organizationId !== context.organizationId) throw new Error('organization_context_changed');
    return access;
  }).catch((error) => {
    if (cache.get(key)?.request === request) cache.delete(key);
    throw error;
  });
  cache.set(key, { request, expiresAt: Date.now() + 30_000 });
  return request;
}

export function hasAnyPermission(access: CurrentAccess | null, permissions: TeamPermission[]): boolean {
  if (!access) return false;
  return permissions.some((permission) => access.permissions[permission] === true);
}

export function clearCurrentAccess(userId?: string): void {
  if (userId) for (const key of cache.keys()) { if (key.startsWith(`${userId}:`)) cache.delete(key); }
  else cache.clear();
  revision++;
  listeners.forEach((listener) => listener());
}
