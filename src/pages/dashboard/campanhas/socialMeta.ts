import type {
  AccountStatus,
  PostObjetivo,
  PostStatus,
  SocialNetwork,
} from '@/mocks/socialData';

export const networkMeta: Record<SocialNetwork, { icone: string; label: string; cor: string }> = {
  LINKEDIN: { icone: 'ri-linkedin-fill', label: 'LinkedIn', cor: 'bg-primary-100 text-primary-600' },
  INSTAGRAM: { icone: 'ri-instagram-line', label: 'Instagram', cor: 'bg-accent-100 text-accent-600' },
  FACEBOOK: { icone: 'ri-facebook-circle-fill', label: 'Facebook', cor: 'bg-secondary-100 text-secondary-700' },
};

export const statusContaMeta: Record<AccountStatus, { label: string; cor: string }> = {
  DISCONNECTED: { label: 'Desconectada', cor: 'bg-background-200 text-foreground-500' },
  CONNECTED: { label: 'Conectada', cor: 'bg-primary-100 text-primary-700' },
  EXPIRED: { label: 'Expirada', cor: 'bg-accent-100 text-accent-700' },
  ERROR: { label: 'Erro', cor: 'bg-accent-500/20 text-accent-600' },
  AWAITING_AUTH: { label: 'Aguardando autorização', cor: 'bg-secondary-100 text-secondary-700' },
};

export const statusPostMeta: Record<PostStatus, { label: string; cor: string }> = {
  RASCUNHO: { label: 'Rascunho', cor: 'bg-background-200 text-foreground-600' },
  AGUARDANDO_APROVACAO: { label: 'Aguardando aprovação', cor: 'bg-secondary-100 text-secondary-700' },
  APROVADA: { label: 'Aprovada', cor: 'bg-primary-100 text-primary-700' },
  AGENDADA: { label: 'Agendada', cor: 'bg-accent-100 text-accent-700' },
  PUBLICANDO: { label: 'Publicando', cor: 'bg-primary-100 text-primary-700' },
  PUBLICADA: { label: 'Publicada', cor: 'bg-primary-500 text-background-50' },
  FALHOU: { label: 'Falhou', cor: 'bg-accent-500 text-background-50' },
  CANCELADA: { label: 'Cancelada', cor: 'bg-background-200 text-foreground-400' },
};

export const objetivoLabel: Record<PostObjetivo, string> = {
  reconhecimento: 'Reconhecimento',
  trafego: 'Tráfego',
  geracao_leads: 'Geração de leads',
  autoridade: 'Autoridade',
  relacionamento: 'Relacionamento',
  oferta: 'Oferta',
};

export function formatarDataHora(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}