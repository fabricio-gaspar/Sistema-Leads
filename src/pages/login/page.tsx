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
    <div className="min-h-screen bg-background-50 flex">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center px-4 md:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-12 cursor-pointer">
            <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center">
              <i className="ri-flashlight-line text-background-50 text-base"></i>
            </div>
            <span className="font-heading font-bold text-xl text-foreground-900">LeadAI</span>
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-heading font-extrabold text-foreground-950 mb-2">
              Bem-vindo de volta
            </h1>
            <p className="text-foreground-600">
              Entre na sua conta para continuar gerenciando sua prospecção.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-accent-100 border border-accent-300 text-accent-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  <i className="ri-error-warning-line text-accent-600"></i>
                </div>
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                E-mail corporativo
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <i className="ri-mail-line text-foreground-400"></i>
                </div>
                <input
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
                <label className="text-sm font-medium text-foreground-800">
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
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="w-full pl-10 pr-12 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-foreground-400 hover:text-foreground-600 cursor-pointer"
                >
                  <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`}></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 py-3 rounded-lg font-heading font-bold text-sm transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-background-50/30 border-t-background-50 rounded-full animate-spin"></div>
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <i className="ri-arrow-right-line"></i>
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-foreground-600">
            Ainda não tem conta?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-semibold cursor-pointer">
              Cadastre sua empresa
            </Link>
          </p>
        </div>
      </div>

      {/* Right - Visual */}
      <div className="hidden lg:flex flex-1 bg-background-950 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-accent-500/20 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 text-center px-8 max-w-md">
          <div className="w-20 h-20 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <i className="ri-dashboard-line text-primary-400 text-3xl"></i>
          </div>
          <h2 className="text-2xl font-heading font-bold text-background-50 mb-4">
            Gerencie sua prospecção
          </h2>
          <p className="text-background-400 leading-relaxed">
            Acesse seu dashboard completo com métricas em tempo real, leads encontrados,
            conversões e muito mais. Tudo em um só lugar.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 text-left">
            {[
              { value: '1.247', label: 'Leads este mês' },
              { value: 'R$ 284K', label: 'Faturamento' },
              { value: '68,6%', label: 'Taxa de resposta' },
              { value: '187', label: 'Convertidos' },
            ].map((stat, i) => (
              <div key={i} className="bg-background-50/5 border border-background-50/10 rounded-lg p-4">
                <p className="text-xl font-heading font-bold text-background-50">{stat.value}</p>
                <p className="text-background-500 text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Esqueceu a senha */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setForgotOpen(false)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Recuperar senha</h3>
              <button type="button" onClick={() => setForgotOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
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
                    <label className="block text-sm font-medium text-foreground-800 mb-1.5">E-mail corporativo</label>
                    <input
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