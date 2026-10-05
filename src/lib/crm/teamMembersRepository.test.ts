import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptTeamInvite, defaultPermissionsForRole, findActiveAssignee, inviteTeamMember, loadPendingTeamInvites, teamPermissions, updateTeamRole, type TeamMember } from './teamMembersRepository';
import { sessionContext } from '@/lib/sessionContext';
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), clear: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('@/lib/crm/currentAccessRepository', () => ({ clearCurrentAccess: mocks.clear }));
beforeEach(() => { mocks.invoke.mockReset(); mocks.clear.mockReset(); sessionContext.replace('synthetic-user', 'synthetic-org'); });

const member: TeamMember = {
  userId: 'd26d66f5-23fd-466e-8f8a-f218993a1213',
  name: 'Vendedor', email: 'vendedor@example.test', avatar: null,
  role: 'vendedor', status: 'active', updatedAt: null,
};

describe('findActiveAssignee', () => {
  it('accepts only an active member from the loaded organization', () => {
    expect(findActiveAssignee([member], member.userId)?.name).toBe('Vendedor');
    expect(findActiveAssignee([member], 'u-2')).toBeNull();
    expect(findActiveAssignee([member], '446ccddf-5d17-44a0-a6e2-54208b916eb7')).toBeNull();
    expect(findActiveAssignee([{ ...member, status: 'disabled' }], member.userId)).toBeNull();
  });
});

describe('R4 team access client contracts', () => {
  it('returns delivery failure honestly instead of claiming email sent', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, delivery: 'failed', message: 'SMTP unavailable' }, error: null });
    expect(await inviteTeamMember({ name: 'Synthetic', email: 'synthetic@example.test', role: 'vendedor' })).toMatchObject({ delivery: 'failed' });
  });
  it('queries pending invites without requiring an existing organization', async () => {
    sessionContext.replace('synthetic-user', null);
    mocks.invoke.mockResolvedValue({ data: { ok: true, invites: [{ id: 'i', revision: 4 }] }, error: null });
    expect(await loadPendingTeamInvites()).toEqual([{ id: 'i', revision: 4 }]);
  });
  it('passes explicit invite revision on acceptance', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await acceptTeamInvite({ id: 'invite', revision: 2 });
    expect(mocks.invoke).toHaveBeenCalledWith('team-members', { body: { action: 'activate_invite', invite_id: 'invite', revision: 2 } });
  });
  it('discards old-account responses', async () => {
    mocks.invoke.mockImplementation(async () => { sessionContext.replace('different-user', 'different-org'); return { data: { ok: true, invites: [{ id: 'old' }] }, error: null }; });
    await expect(loadPendingTeamInvites()).rejects.toThrow('session_context_changed');
  });
  it('invalidates cached access after a role mutation', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await updateTeamRole('target', 'cx'); expect(mocks.clear).toHaveBeenCalledTimes(1);
  });
  it('shares the exact canonical 19 permissions and actual CX/SDR scope', () => {
    expect(teamPermissions).toHaveLength(19);
    expect(teamPermissions).not.toContain('conversations.read_assigned');
    expect(defaultPermissionsForRole('sdr')).toMatchObject({ 'leads.edit_all': true, 'conversations.reply_all': true, 'proposals.manage': true });
    expect(defaultPermissionsForRole('cx')).toMatchObject({ 'leads.read_all': true, 'conversations.read_all': true, 'channels.view_own': false });
    expect(Object.values(defaultPermissionsForRole('administrador')).every(Boolean)).toBe(true);
  });
});
