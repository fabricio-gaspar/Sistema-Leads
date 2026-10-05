import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const navigate = useNavigate();
  const { login, resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Preencha todos os campos.');
      return;
    }

    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      navigate('/dashboard');
    } else {
      setError(res.error || 'E-mail ou senha inválidos. Verifique suas credenciais.');
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotSent) {
      setForgotOpen(false);
      setForgotSent(false);
      setForgotError('');
      return;
    }
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    setForgotError('');
    const res = await resetPassword(forgotEmail);
    setForgotLoading(false);
    if (res.ok) {
      setForgotSent(true);
    } else {
      setForgotError(res.error || 'Não foi possível enviar o link. Tente novamente.');
    }
  };

  return (
    <div className="wf-login min-h-screen bg-background-50 flex">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 md:px-12 lg:py-16">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-3 mb-14 cursor-pointer" aria-label="Sistema de Leads — início">
            <div className="w-10 h-10 bg-primary-700 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg font-semibold" aria-hidden="true">W</span>
            </div>
            <span className="font-heading font-semibold text-xl tracking-tight text-foreground-900">WayFlex <span className="font-normal text-foreground-400">CRM</span></span>
          </Link>

          <div className="mb-8">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-foreground-500 mb-3">Seu espaço de trabalho</p>
            <h1 className="text-3xl font-heading font-semibold tracking-[-0.035em] text-foreground-950 mb-3">
              Bem-vindo de volta
            </h1>
            <p className="text-foreground-600">
              Acesse seus contatos, conversas e oportunidades.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div role="alert" className="bg-accent-100 border border-accent-300 text-accent-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  <i className="ri-error-warning-line text-accent-600"></i>
                </div>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-foreground-800 mb-1.5">
                E-mail corporativo
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <i className="ri-mail-line text-foreground-400"></i>
                </div>
                <input
                  id="login-email"
                  name="email"
                  autoComplete="username"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@empresa.com"
                  className="w-full pl-10 pr-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="text-sm font-medium text-foreground-800">
                  Senha
                </label>
                <button type="button" onClick={() => setForgotOpen(true)} className="text-xs text-primary-600 hover:text-primary-700 font-medium cursor-pointer">
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <i className="ri-lock-line text-foreground-400"></i>
                </div>
                <input
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="w-full pl-10 pr-12 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-foreground-400 hover:text-foreground-600 cursor-pointer"
                >
                  <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`}></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white py-3.5 rounded-lg font-heading font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-background-50/30 border-t-background-50 rounded-full animate-spin"></div>
                  Entrando...
                </>
              ) : (
                <>
                  Entrar no painel
                  <i className="ri-arrow-right-line"></i>
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-7 text-sm text-foreground-500">
            Ainda não tem conta?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-semibold cursor-pointer">
              Cadastre sua empresa
            </Link>
          </p>
          <p className="mt-12 border-t border-background-200 pt-5 text-xs leading-5 text-foreground-400">Sistema de Leads · Relacionamentos que geram oportunidades.</p>
        </div>
      </div>

      {/* Right - Visual */}
      <aside className="wf-login-story hidden lg:flex flex-1 relative overflow-hidden flex-col justify-between p-12 xl:p-16">
        <div className="relative z-10 flex items-center gap-2.5 text-xs font-medium text-white/65"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> RELACIONAMENTO COMERCIAL</div>
        <div className="relative z-10 max-w-lg py-16">
          <p className="text-sm text-white/55 mb-5">Clareza em cada contato.</p>
          <h2 className="font-heading text-4xl xl:text-5xl font-medium tracking-[-0.045em] leading-[1.12] text-white">Boas conversas.<br />Próximos passos<br /><span className="text-emerald-200">bem definidos.</span></h2>
          <p className="mt-6 max-w-sm text-sm leading-7 text-white/65">Organize o relacionamento com seus clientes, acompanhe oportunidades e mantenha sua equipe no mesmo contexto.</p>
          <div className="mt-12 border-t border-white/15">
            {[
              ['01', 'Atendimento', 'O histórico que dá contexto à conversa.'],
              ['02', 'Oportunidades', 'Visibilidade do contato ao orçamento.'],
              ['03', 'Conhecimento', 'As informações da empresa, organizadas.'],
            ].map(([number, title, description]) => (
              <div key={number} className="flex items-start gap-5 border-b border-white/15 py-5">
                <span className="pt-0.5 text-xs tabular-nums text-white/40">{number}</span>
                <div><p className="text-sm font-medium text-white/90">{title}</p><p className="mt-1 text-xs leading-5 text-white/50">{description}</p></div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-xs text-white/40">Sistema de Leads <span className="mx-2 text-white/20">/</span> Gestão comercial</p>
      </aside>

      {/* Modal Esqueceu a senha */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setForgotOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="forgot-title" className="bg-background-50 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 id="forgot-title" className="font-heading font-bold text-foreground-950">Recuperar senha</h3>
              <button type="button" aria-label="Fechar recuperação de senha" onClick={() => setForgotOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <form onSubmit={handleForgot} className="p-6 space-y-4">
              {forgotSent ? (
                <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <i className="ri-checkbox-circle-line"></i>
                  Se existir uma conta com esse e-mail, enviaremos um link de redefinição.
                </div>
              ) : (
                <>
                  <p className="text-sm text-foreground-600">Informe seu e-mail e enviaremos as instruções para redefinir sua senha.</p>
                  <div>
                    <label htmlFor="forgot-email" className="block text-sm font-medium text-foreground-800 mb-1.5">E-mail corporativo</label>
                    <input
                      id="forgot-email"
                      autoComplete="email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="seu@empresa.com"
                      className="w-full px-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
                    />
                  </div>
                </>
              )}
              {forgotError && (
                <div className="bg-accent-100 border border-accent-300 text-accent-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <i className="ri-error-warning-line"></i>
                  {forgotError}
                </div>
              )}
              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 py-3 rounded-lg font-heading font-bold text-sm cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {forgotLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-background-50/30 border-t-background-50 rounded-full animate-spin"></div>
                    Enviando...
                  </>
                ) : forgotSent ? (
                  'Fechar'
                ) : (
                  'Enviar link de redefinição'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
