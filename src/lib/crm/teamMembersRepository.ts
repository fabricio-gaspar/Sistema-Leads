import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

export type TeamRole = 'administrador' | 'vendedor' | 'sdr' | 'cx';

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
  role: TeamRole;
  status: 'active' | 'disabled';
  updatedAt: string | null;
}

const roleLabel: Record<TeamRole, string> = {
  administrador: 'Administrador', vendedor: 'Vendedor', sdr: 'SDR', cx: 'Atendimento',
};

export { roleLabel };

export async function loadTeamMembers(): Promise<TeamMember[]> {
  const session = await resolveOrganizationSession();
  const { data: members, error: membersError } = await supabase.from('organization_members')
    .select('user_id,role,status,updated_at').eq('organization_id', session.organizationId).order('updated_at', { ascending: false });
  if (membersError) throw membersError;
  const ids = (members ?? []).map((member) => member.user_id);
  if (!ids.length) return [];
  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id,name,email,avatar').in('id', ids);
  if (profilesError) throw profilesError;
  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return (members ?? []).map((member) => {
    const profile = byId.get(member.user_id);
    return {
      userId: member.user_id,
      name: profile?.name || 'Usuário aguardando convite',
      email: profile?.email || 'E-mail indisponível',
      avatar: profile?.avatar ?? null,
      role: member.role as TeamRole,
      status: member.status === 'active' ? 'active' : 'disabled',
      updatedAt: member.updated_at,
    };
  });
}

async function mutate(action: string, payload: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke('team-members', { body: { action, ...payload } });
  if (error || !data?.ok) throw new Error(data?.erro ?? await detalheDoErroDeFuncao(error));
}

export async function inviteTeamMember(input: { name: string; email: string; role: TeamRole }): Promise<void> {
  await mutate('invite', input);
}

export async function updateTeamRole(userId: string, role: TeamRole): Promise<void> {
  await mutate('update_role', { user_id: userId, role });
}

export async function setTeamMemberStatus(userId: string, enabled: boolean): Promise<void> {
  await mutate('set_status', { user_id: userId, enabled });
}

export async function removeTeamMember(userId: string): Promise<void> {
  await mutate('remove', { user_id: userId });
}
