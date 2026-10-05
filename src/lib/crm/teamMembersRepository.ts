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
  status: 'active' | 'disabled' | 'invited';
  updatedAt: string | null;
  /** Last known membership activity. The auth provider's last sign-in is not
   * exposed to the browser; keeping this value explicit avoids inventing it. */
  lastAccessAt?: string | null;
}

export interface OrganizationInvite {
  id: string;
  email: string;
  role: TeamRole;
  invitedBy: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface AccessSecurityPolicy {
  requireMfa: boolean;
  revokeSessionsOnDisable: boolean;
  quarterlyReview: boolean;
  availableRoles: Record<TeamRole, boolean>;
}

export interface AccessAuditEvent {
  id: string;
  action: string;
  detail: string | null;
  actorName: string;
  occurredAt: string;
  eventData: Record<string, unknown>;
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
      status: member.status === 'active' ? 'active' : member.status === 'invited' ? 'invited' : 'disabled',
      updatedAt: member.updated_at,
      lastAccessAt: member.updated_at,
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

export async function updateTeamMemberProfile(userId: string, input: { name: string; email: string }): Promise<void> {
  await mutate('update_member', { user_id: userId, name: input.name, email: input.email });
}

export async function resetTeamMemberPassword(userId: string, password: string): Promise<void> {
  await mutate('reset_password', { user_id: userId, password });
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

const defaultAccessSecurityPolicy: AccessSecurityPolicy = {
  requireMfa: false,
  revokeSessionsOnDisable: true,
  quarterlyReview: true,
  availableRoles: { administrador: true, vendedor: true, sdr: true, cx: true },
};

export { defaultAccessSecurityPolicy };

export async function loadOrganizationInvites(): Promise<OrganizationInvite[]> {
  const result = await mutate<{ invites: Array<Record<string, unknown>> }>('invites_get', {});
  return result.invites.map((invite) => ({
    id: String(invite.id),
    email: String(invite.email ?? ''),
    role: String(invite.role ?? 'vendedor') as TeamRole,
    invitedBy: typeof invite.invited_by === 'string' ? invite.invited_by : null,
    expiresAt: String(invite.expires_at ?? ''),
    acceptedAt: typeof invite.accepted_at === 'string' ? invite.accepted_at : null,
    cancelledAt: typeof invite.cancelled_at === 'string' ? invite.cancelled_at : null,
    createdAt: String(invite.created_at ?? ''),
  }));
}

export async function cancelOrganizationInvite(inviteId: string): Promise<void> {
  await mutate('invite_cancel', { invite_id: inviteId });
}

export async function resendOrganizationInvite(inviteId: string): Promise<void> {
  await mutate('invite_resend', { invite_id: inviteId });
}

export async function loadAccessSecurityPolicy(): Promise<AccessSecurityPolicy> {
  const result = await mutate<{ policy: Partial<AccessSecurityPolicy> }>('policy_get', {});
  return {
    ...defaultAccessSecurityPolicy,
    ...result.policy,
  };
}

export async function saveAccessSecurityPolicy(policy: AccessSecurityPolicy, reason: string): Promise<AccessSecurityPolicy> {
  const result = await mutate<{ policy: AccessSecurityPolicy }>('policy_set', { policy, reason });
  return result.policy;
}

export async function loadTeamAccessAudit(): Promise<AccessAuditEvent[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id,action,detail,actor_name,occurred_at,event_data')
    .eq('organization_id', session.organizationId)
    .in('action', [
      'team.member_created', 'team.member_invited', 'team.member_enabled', 'team.member_disabled',
      'team.member_role_changed', 'team.member_updated', 'team.member_password_reset',
      'team.member_permissions_changed', 'team.member_deleted',
      'team.invite_cancelled', 'team.invite_resent', 'team.security_policy_changed', 'team.sessions_revoked',
    ])
    .order('occurred_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    action: String(row.action),
    detail: typeof row.detail === 'string' ? row.detail : null,
    actorName: typeof row.actor_name === 'string' ? row.actor_name : 'Usuário autorizado',
    occurredAt: String(row.occurred_at ?? new Date().toISOString()),
    eventData: row.event_data && typeof row.event_data === 'object' ? row.event_data as Record<string, unknown> : {},
  }));
}
