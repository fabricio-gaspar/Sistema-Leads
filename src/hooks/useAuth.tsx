import { createContext, Fragment, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { sessionContext, broadcastContextInvalidation } from '@/lib/sessionContext';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { acceptsAuthenticatedEvents, beginAuthIntent, observeAuthContext } from '@/lib/authContextObserver';
import type { User } from '@supabase/supabase-js';

// Usuário exposto pela aplicação. Mantém os mesmos campos que o antigo mock,
// para não quebrar nenhum componente que lê name/avatar/role/company/email.
export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  avatar: string;
}

// Dados completos da empresa coletados no cadastro. São usados somente para
// provisionar a organização e suas configurações iniciais no backend.
export interface CompanyDados {
  nome: string;
  cnpj: string;
  segmento: string;
  endereco: string;
  telefone: string;
  whatsapp: string;
  site: string;
  social_media: { linkedin: string; instagram: string; facebook: string };
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  company: CompanyDados;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  organizationReady: boolean;
  organizationError: string | null;
  refreshOrganization: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ ok: boolean; error?: string; precisaConfirmar?: boolean }>;
  resetPassword: (email: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toAppUser(u: User): AppUser {
  const meta = (u.user_metadata ?? {}) as Record<string, string | undefined>;
  const name = meta.name || (u.email ? u.email.split('@')[0] : 'Usuário');
  return {
    id: u.id,
    name,
    email: u.email ?? '',
    // This value is only presentational. Authorization always comes from the
    // organization_members table and RLS, never user_metadata.
    role: 'Membro',
    company: meta.company || name,
    avatar: name.charAt(0).toUpperCase(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const context = useSyncExternalStore(sessionContext.subscribe, sessionContext.get, sessionContext.get);

  const refreshOrganization = useCallback(async () => {
    const current = sessionContext.get();
    const pending = sessionContext.replace(current.userId);
    setOrganizationError(null);
    try {
      await resolveOrganizationSession();
    } catch (error) {
      if (sessionContext.isCurrent(pending)) setOrganizationError('Não foi possível confirmar o acesso à organização.');
      throw error;
    }
  }, []);

  useEffect(() => observeAuthContext({
    identity: (next) => setUser(next ? toAppUser(next) : null),
    organizationError: setOrganizationError,
    loading: setLoading,
  }), []);

  const login = async (email: string, password: string) => {
    beginAuthIntent('login');
    setUser(null);
    setOrganizationError(null);
    broadcastContextInvalidation('signout');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    if (!acceptsAuthenticatedEvents()) return { ok: false, error: 'A sessão foi encerrada durante o login.' };
    broadcastContextInvalidation('refresh');
    // Invites are accepted explicitly in PendingInvitesGate, never as a login side effect.
    return { ok: true };
  };

  const register = async (data: RegisterData) => {
    beginAuthIntent('register');
    setUser(null);
    broadcastContextInvalidation('signout');
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
          company: data.company.nome,
          empresa: data.company,
        },
      },
    });
    if (error) return { ok: false, error: error.message };

    if (!acceptsAuthenticatedEvents()) return { ok: false, error: 'A sessão foi encerrada durante o cadastro.' };
    if (result.session) broadcastContextInvalidation('refresh');
    // Canonical Auth trigger owns provisioning; pending invite never seeds another tenant.
    const precisaConfirmar = !result.session;
    return { ok: true, precisaConfirmar };
  };

  const resetPassword = async (email: string) => {
    const basePath = (__BASE_PATH__ || '').split('/').filter(Boolean).join('/');
    const prefix = basePath ? `/${basePath}` : '';
    const redirectTo = `${window.location.origin}${prefix}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const logout = async () => {
    beginAuthIntent('logout');
    setLoading(false);
    setUser(null);
    setOrganizationError(null);
    broadcastContextInvalidation('signout');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, loading, organizationReady: Boolean(context.organizationId && context.userId === user?.id), organizationError, refreshOrganization, login, register, resetPassword, logout }}>
      <Fragment key={context.generation}>{children}</Fragment>
    </AuthContext.Provider>
  );
}

// The hook shares the provider context defined in this module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
}
