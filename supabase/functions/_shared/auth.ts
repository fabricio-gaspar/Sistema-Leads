import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.57.4';

export interface AuthContext { client: SupabaseClient; user: User; }

function canonicalRole(role: string): string {
  const aliases: Record<string, string> = { administrador: 'admin', vendedor: 'seller', gerente: 'manager' };
  return aliases[role] ?? role;
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

export function createAdminClient(): SupabaseClient {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireUser(request: Request): Promise<AuthContext> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('authentication_required');
  const token = authorization.slice('Bearer '.length);
  const client = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error('invalid_session');
  return { client, user: data.user };
}

export async function requireOrganizationRole(
  client: SupabaseClient,
  userId: string,
  organizationId: string,
  allowedRoles: string[],
): Promise<void> {
  const { data, error } = await client
    .from('organization_members')
    .select('role,status')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data || data.status !== 'active' || !allowedRoles.includes(canonicalRole(data.role))) {
    throw new Error('organization_access_denied');
  }
}
