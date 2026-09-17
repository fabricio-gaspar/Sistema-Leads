export function leadPurgeConfirmation(total: number): string {
  return `EXCLUIR ${total} LEADS`;
}

export function isLeadPurgeConfirmationValid(entered: string, total: number): boolean {
  return entered === leadPurgeConfirmation(total);
}
