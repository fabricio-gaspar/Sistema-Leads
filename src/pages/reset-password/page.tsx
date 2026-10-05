import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError('Link inválido ou expirado. Solicite um novo link de redefinição de senha.');
      }
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || password.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-background-50 flex items-center justify-center px-4 md:px-8">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2.5 mb-12 cursor-pointer">
          <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center">
            <i className="ri-flashlight-line text-background-50 text-base"></i>
          </div>
          <span className="font-heading font-bold text-xl text-foreground-900">Sistema de Leads</span>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-heading font-extrabold text-foreground-950 mb-2">
            Redefinir senha
          </h1>
          <p className="text-foreground-600">
            Defina uma nova senha para acessar sua conta.
          </p>
        </div>

        {checking ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary-300 border-t-primary-500 rounded-full animate-spin"></div>
          </div>
        ) : success ? (
          <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-4 rounded-lg text-sm flex items-center gap-3">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <i className="ri-checkbox-circle-line text-primary-600"></i>
            </div>
            Senha redefinida com sucesso! Redirecionando para o login...
          </div>
        ) : (
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
                Nova senha
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <i className="ri-lock-line text-foreground-400"></i>
                </div>
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-10 pr-12 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-foreground-400 hover:text-foreground-600 cursor-pointer"
                >
                  <i className={`${show ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`}></i>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                Confirmar nova senha
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <i className="ri-lock-line text-foreground-400"></i>
                </div>
                <input
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full pl-10 pr-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all"
                />
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
                  Redefinindo...
                </>
              ) : (
                <>
                  Redefinir senha
                  <i className="ri-arrow-right-line"></i>
                </>
              )}
            </button>

            <p className="text-center text-sm text-foreground-600 pt-2">
              Lembrou a senha?{' '}
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold cursor-pointer">
                Voltar para o login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
