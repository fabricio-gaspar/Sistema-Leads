export const META_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1_000;

export interface ServiceWindowState {
  isOpen: boolean;
  openedAt: string | null;
  expiresAt: string | null;
  remainingMs: number;
}

export function metaServiceWindow(
  lastCustomerMessageAt: string | null | undefined,
  now = new Date(),
): ServiceWindowState {
  if (!lastCustomerMessageAt) return { isOpen: false, openedAt: null, expiresAt: null, remainingMs: 0 };
  const opened = new Date(lastCustomerMessageAt);
  if (Number.isNaN(opened.getTime())) return { isOpen: false, openedAt: null, expiresAt: null, remainingMs: 0 };
  const expires = new Date(opened.getTime() + META_SERVICE_WINDOW_MS);
  const remainingMs = Math.max(0, expires.getTime() - now.getTime());
  return {
    isOpen: remainingMs > 0,
    openedAt: opened.toISOString(),
    expiresAt: expires.toISOString(),
    remainingMs,
  };
}

export function requiresApprovedTemplate(
  lastCustomerMessageAt: string | null | undefined,
  now = new Date(),
): boolean {
  return !metaServiceWindow(lastCustomerMessageAt, now).isOpen;
}

