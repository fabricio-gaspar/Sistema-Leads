export function normalizeHandoffWhatsappNotification(
  initialAssignmentMode: string,
  handoffStage: string | null,
  requested: unknown,
): boolean {
  return initialAssignmentMode === 'ana' && Boolean(handoffStage) && requested === true;
}
