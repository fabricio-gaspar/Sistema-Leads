export const handoffPolicyStages = ['novo', 'apresentado', 'qualificando', 'reuniao', 'orcamento'] as const;

export type HandoffPolicyStage = typeof handoffPolicyStages[number];

const workflowStages = ['novo', 'apresentado', 'qualificando', 'reuniao', 'orcamento', 'fechado'] as const;

export function handoffStageReached(nextStage: unknown, configuredStage: unknown): boolean {
  if (typeof nextStage !== 'string' || typeof configuredStage !== 'string') return false;
  const next = nextStage.trim().toLowerCase();
  const configured = configuredStage.trim().toLowerCase();
  if (!handoffPolicyStages.includes(configured as HandoffPolicyStage)) return false;
  const nextIndex = workflowStages.indexOf(next as typeof workflowStages[number]);
  const configuredIndex = workflowStages.indexOf(configured as typeof workflowStages[number]);
  return nextIndex >= configuredIndex && nextIndex >= 0;
}
