export function organizationSlug(name: string, userId: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 45) || 'organizacao';
  return `${normalized}-${userId.replace(/-/g, '').slice(0, 8) || 'organizacao'}`;
}
