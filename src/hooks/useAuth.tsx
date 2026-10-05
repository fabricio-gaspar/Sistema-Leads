import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { bootstrapOrganization } from '@/lib/organization';
import { loadOperationalCompanySettings, persistOperationalCompanySettings } from '@/lib/crm/organizationSettingsRepository';
import { getEmpresaSettingsSnapshot } from '@/hooks/useEmpresaSettingsStore';
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

// Persiste os dados iniciais no domínio da organização, sem usar blobs legados.
async function seedOrganizationSettings(email: string, company: CompanyDados): Promise<void> {
  try {
    const current = await loadOperationalCompanySettings(getEmpresaSettingsSnapshot());
    if (current.organizacao.nome.trim()) return;
    await persistOperationalCompanySettings({
      ...current,
      organizacao: {
        ...current.organizacao,
        nome: company.nome,
        nomeComercial: company.nome,
        cnpj: company.cnpj,
        site: company.site,
        email,
        telefone: company.telefone,
        endereco: company.endereco,
        whatsapp: company.whatsapp,
        social_media: company.social_media,
        fusoHorario: current.organizacao.fusoHorario || 'America/Sao_Paulo',
        idioma: current.organizacao.idioma || 'pt-BR',
        assinaturaComercial: current.organizacao.assinaturaComercial || '',
      },
      ramo: current.ramo || company.segmento,
    });
  } catch (e) {
    console.error('[useAuth] erro ao persistir dados iniciais da organização', e);
  }
}

async function provisionOrganization(userId: string, company: CompanyDados): Promise<void> {
  try {
    await bootstrapOrganization(userId, {
      legalName: company.nome,
      displayName: company.nome,
      timezone: 'America/Sao_Paulo',
    });
  } catch (error) {
    // Keeps legacy environments usable until the Phase 1 migration is applied.
    // Registration itself remains owned by Supabase Auth.
    console.warn('[useAuth] organização ainda não provisionada', error);
  }
}

// Cobre o caso de confirmação de e-mail: o usuário entra depois de confirmar.
async function sincronizarEmpresa(user: User): Promise<void> {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  if (meta.empresa && typeof meta.empresa === 'object') {
    await provisionOrganization(user.id, meta.empresa as CompanyDados);
    await seedOrganizationSettings(user.email ?? '', meta.empresa as CompanyDados);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      if (data.session?.user) {
        setUser(toAppUser(data.session.user));
        void sincronizarEmpresa(data.session.user);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(toAppUser(session.user));
        void sincronizarEmpresa(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    // Um convite não concede acesso antes do aceite. No primeiro login do
    // convidado, a função server-side transforma o vínculo pendente em ativo,
    // marca o convite como aceito e registra a auditoria. Falhas transitórias
    // aqui não bloqueiam usuários que já possuem acesso válido.
    if (data.user) {
      await supabase.functions.invoke('team-members', { body: { action: 'activate_invite' } });
    }
    return { ok: true };
  };

  const register = async (data: RegisterData) => {
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

    // Sem confirmação de e-mail, já existe sessão: persiste os dados da empresa agora.
    const precisaConfirmar = !result.session;
    if (result.session?.user) {
      await provisionOrganization(result.session.user.id, data.company);
      await seedOrganizationSettings(data.email, data.company);
    }
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
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, resetPassword, logout }}>
      {children}
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
