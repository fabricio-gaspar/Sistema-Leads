import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

export type TeamRole = 'administrador' | 'vendedor' | 'sdr' | 'cx';
export const teamPermissions = [
  'leads.read_all', 'leads.read_assigned', 'leads.create', 'leads.edit_all',
  'leads.edit_assigned', 'leads.delete', 'conversations.read_all',
  'conversations.reply_all', 'conversations.reply_assigned', 'messages.delete',
  'prospecting.manage', 'proposals.manage', 'configuration.manage',
  'website_entry.manage', 'team.manage', 'audit.view', 'channels.view_own',
  'channels.connect_own', 'channels.manage_all',
] as const;
export type TeamPermission = typeof teamPermissions[number];

export const teamPermissionLabel: Record<TeamPermission, string> = {
  'leads.read_all': 'Ver todos os leads',
  'leads.read_assigned': 'Ver leads sob responsabilidade',
  'leads.create': 'Criar leads',
  'leads.edit_all': 'Editar todos os leads',
  'leads.edit_assigned': 'Editar leads sob responsabilidade',
  'leads.delete': 'Excluir leads definitivamente',
  'conversations.read_all': 'Ver todas as conversas',
  'conversations.reply_all': 'Responder todas as conversas',
  'conversations.reply_assigned': 'Responder conversas sob responsabilidade',
  'messages.delete': 'Excluir mensagens',
  'prospecting.manage': 'Gerenciar busca de leads',
  'proposals.manage': 'Criar e editar orçamentos',
  'configuration.manage': 'Alterar configurações e integrações',
  'website_entry.manage': 'Configurar entrada da Ana pelo site',
  'team.manage': 'Gerenciar equipe e permissões',
  'audit.view': 'Consultar Registro do Sistema',
  'channels.view_own': 'Ver o próprio WhatsApp operacional',
  'channels.connect_own': 'Conectar o próprio WhatsApp por QR Code',
  'channels.manage_all': 'Gerenciar os WhatsApps de todos os usuários',
};

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
  role: TeamRole;
  status: 'active' | 'disabled';
  updatedAt: string | null;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function findActiveAssignee(members: TeamMember[], userId: string): TeamMember | null {
  if (!uuidPattern.test(userId)) return null;
  return members.find((member) => member.userId === userId && member.status === 'active') ?? null;
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

async function mutate<T extends Record<string, unknown> = Record<string, unknown>>(action: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('team-members', { body: { action, ...payload } });
  if (error || !data?.ok) throw new Error(data?.erro ?? await detalheDoErroDeFuncao(error));
  return data as T;
}

export async function inviteTeamMember(input: { name: string; email: string; role: TeamRole }): Promise<void> {
  await mutate('invite', input);
}

export interface DailyLeadReportSettings {
  enabled: boolean;
  phoneSuffix: string | null;
  scheduleTime: string;
  timezone: string;
  lastStatus: 'sending' | 'sent' | 'failed' | 'reconciliation_required' | 'blocked' | null;
  lastSentAt: string | null;
  lastError: string | null;
}

export interface HandoffWhatsappAlertSettings {
  enabled: boolean;
  phoneSuffix: string | null;
}

export async function createTeamMember(input: { name: string; email: string; password: string; role: TeamRole }): Promise<void> {
  await mutate('create', input);
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

export async function loadTeamMemberPermissions(userId: string): Promise<{ role: TeamRole; permissions: Record<TeamPermission, boolean> }> {
  return mutate('permissions_get', { user_id: userId });
}

export async function saveTeamMemberPermissions(userId: string, permissions: Record<TeamPermission, boolean>): Promise<void> {
  await mutate('permissions_set', { user_id: userId, permissions });
}

export async function loadDailyLeadReportSettings(userId: string): Promise<DailyLeadReportSettings> {
  const result = await mutate<{ settings: DailyLeadReportSettings }>('daily_report_get', { user_id: userId });
  return result.settings;
}

export async function saveDailyLeadReportSettings(
  userId: string,
  input: { enabled: boolean; phone?: string; scheduleTime: string; timezone: string },
): Promise<DailyLeadReportSettings> {
  const result = await mutate<{ settings: DailyLeadReportSettings }>('daily_report_set', {
    user_id: userId,
    enabled: input.enabled,
    phone: input.phone,
    schedule_time: input.scheduleTime,
    timezone: input.timezone,
  });
  return result.settings;
}

export async function loadHandoffWhatsappAlertSettings(userId: string): Promise<HandoffWhatsappAlertSettings> {
  const result = await mutate<{ settings: HandoffWhatsappAlertSettings }>('handoff_alert_get', { user_id: userId });
  return result.settings;
}

export async function saveHandoffWhatsappAlertSettings(
  userId: string,
  input: { enabled: boolean; phone?: string },
): Promise<HandoffWhatsappAlertSettings> {
  const result = await mutate<{ settings: HandoffWhatsappAlertSettings }>('handoff_alert_set', {
    user_id: userId, enabled: input.enabled, phone: input.phone,
  });
  return result.settings;
}
