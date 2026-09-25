import { describe, expect, it } from 'vitest';
import { findActiveAssignee, type TeamMember } from './teamMembersRepository';

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
