import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface FormData {
  nome: string;
  seuNome: string;
  cnpj: string;
  segmento: string;
  endereco: string;
  telefone: string;
  whatsapp: string;
  email: string;
  site: string;
  social_media: { linkedin: string; instagram: string; facebook: string };
  password: string;
  confirm_password: string;
}

const segmentos = [
  'Tecnologia',
  'Construção Civil',
  'Saúde',
  'Marketing e Publicidade',
  'Alimentação',
  'Varejo',
  'Indústria',
  'Educação',
  'Serviços Financeiros',
  'Logística',
  'Agronegócio',
  'Energia',
  'Outro',
];

export default function Register() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    nome: '',
    seuNome: '',
    cnpj: '',
    segmento: '',
    endereco: '',
    telefone: '',
    whatsapp: '',
    email: '',
    site: '',
    social_media: { linkedin: '', instagram: '', facebook: '' },
    password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'confirm_password', string>>>({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [precisaConfirmar, setPrecisaConfirmar] = useState(false);
  const { register } = useAuth();

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const updateSocial = (field: keyof typeof formData.social_media, value: string) => {
    setFormData((prev) => ({
      ...prev,
      social_media: { ...prev.social_media, [field]: value },
    }));
  };

  const validateStep1 = () => {
    const errs: typeof errors = {};
    if (!formData.nome.trim()) errs.nome = 'Nome da empresa é obrigatório';
    if (!formData.cnpj.trim()) errs.cnpj = 'CNPJ é obrigatório';
    else if (formData.cnpj.replace(/\D/g, '').length !== 14) errs.cnpj = 'CNPJ inválido';
    if (!formData.segmento) errs.segmento = 'Selecione o segmento';
    if (!formData.email.trim()) errs.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'E-mail inválido';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs: typeof errors = {};
    if (!formData.seuNome.trim()) errs.seuNome = 'Seu nome é obrigatório';
    if (!formData.password) errs.password = 'Senha é obrigatória';
    else if (formData.password.length < 6) errs.password = 'Mínimo 6 caracteres';
    if (formData.password !== formData.confirm_password)
      errs.confirm_password = 'As senhas não conferem';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else {
      if (validateStep2()) {
        setLoading(true);
        setSubmitError('');
        const res = await register({
          name: formData.seuNome,
          email: formData.email,
          password: formData.password,
          company: {
            nome: formData.nome,
            cnpj: formData.cnpj,
            segmento: formData.segmento,
            endereco: formData.endereco,
            telefone: formData.telefone,
            whatsapp: formData.whatsapp,
            site: formData.site,
            social_media: formData.social_media,
          },
        });
        setLoading(false);
        if (res.ok) {
          setPrecisaConfirmar(Boolean(res.precisaConfirmar));
          setSuccess(true);
        } else {
          setSubmitError(res.error || 'Não foi possível criar a conta. Tente novamente.');
        }
      }
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-check-line text-primary-600 text-3xl"></i>
          </div>
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-3">
            {precisaConfirmar ? 'Confirme seu e-mail' : 'Cadastro realizado!'}
          </h1>
          <p className="text-foreground-600 mb-8 leading-relaxed">
            {precisaConfirmar
              ? 'Enviamos um link de confirmação para o seu e-mail. Clique nele para ativar sua conta e depois faça login para começar.'
              : 'Sua empresa foi cadastrada com sucesso. Agora você pode configurar seu negócio e começar a prospectar leads automaticamente.'}
          </p>
          <Link
            to={precisaConfirmar ? '/login' : '/dashboard'}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 px-8 py-3.5 rounded-lg font-heading font-bold text-sm transition-all cursor-pointer whitespace-nowrap"
          >
            {precisaConfirmar ? 'Ir para o login' : 'Ir para o Dashboard'}
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50 flex">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center px-4 md:px-8 py-12">
        <div className="w-full max-w-lg">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-8 cursor-pointer">
            <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center">
              <i className="ri-flashlight-line text-background-50 text-base"></i>
            </div>
            <span className="font-heading font-bold text-xl text-foreground-900">Sistema de Leads</span>
          </Link>

          {/* Progress Steps */}
          <div className="flex items-center gap-3 mb-10">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-3 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold font-heading transition-all ${
                    s <= step
                      ? 'bg-primary-500 text-background-50'
                      : 'bg-background-200 text-foreground-400'
                  }`}
                >
                  {s < step ? (
                    <i className="ri-check-line text-sm"></i>
                  ) : (
                    s
                  )}
                </div>
                <span className={`text-sm font-medium ${s <= step ? 'text-foreground-900' : 'text-foreground-400'}`}>
                  {s === 1 ? 'Dados da Empresa' : 'Conta de Acesso'}
                </span>
                {s < 2 && <div className={`flex-1 h-0.5 rounded ${s < step ? 'bg-primary-500' : 'bg-background-200'}`}></div>}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-1">
                    Cadastre sua empresa
                  </h1>
                  <p className="text-foreground-600 text-sm">
                    Preencha os dados da sua empresa para começar a usar o Sistema de Leads.
                  </p>
                </div>

                {/* Nome da Empresa */}
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                    Nome da Empresa <span className="text-accent-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => updateField('nome', e.target.value)}
                    placeholder="Nome completo da empresa"
                    className={`w-full px-4 py-3 bg-background-50 border rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 transition-all ${
                      errors.nome
                        ? 'border-accent-400 focus:ring-accent-400/20'
                        : 'border-background-300 focus:border-primary-400 focus:ring-primary-400/20'
                    }`}
                  />
                  {errors.nome && <p className="text-accent-600 text-xs mt-1">{errors.nome}</p>}
                </div>

                {/* CNPJ + Segmento */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                      CNPJ <span className="text-accent-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.cnpj}
                      onChange={(e) => updateField('cnpj', e.target.value)}
                      placeholder="00.000.000/0000-00"
                      className={`w-full px-4 py-3 bg-background-50 border rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 transition-all ${
                        errors.cnpj
                          ? 'border-accent-400 focus:ring-accent-400/20'
                          : 'border-background-300 focus:border-primary-400 focus:ring-primary-400/20'
                      }`}
                    />
                    {errors.cnpj && <p className="text-accent-600 text-xs mt-1">{errors.cnpj}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                      Segmento <span className="text-accent-600">*</span>
                    </label>
                    <select
                      value={formData.segmento}
                      onChange={(e) => updateField('segmento', e.target.value)}
                      className={`w-full px-4 py-3 bg-background-50 border rounded-lg text-sm text-foreground-900 focus:outline-none focus:ring-2 transition-all cursor-pointer ${
                        errors.segmento
                          ? 'border-accent-400 focus:ring-accent-400/20'
                          : 'border-background-300 focus:border-primary-400 focus:ring-primary-400/20'
                      }`}
                    >
                      <option value="" className="text-foreground-400">Selecione o segmento</option>
                      {segmentos.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {errors.segmento && <p className="text-accent-600 text-xs mt-1">{errors.segmento}</p>}
                  </div>
                </div>

                {/* Endereço */}
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                    Endereço
                  </label>
                  <input
                    type="text"
                    value={formData.endereco}
                    onChange={(e) => updateField('endereco', e.target.value)}
                    placeholder="Rua, número, bairro, cidade - UF"
                    className="w-full px-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all"
                  />
                </div>

                {/* Telefone + WhatsApp */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                      Telefone
                    </label>
                    <input
                      type="text"
                      value={formData.telefone}
                      onChange={(e) => updateField('telefone', e.target.value)}
                      placeholder="(00) 0000-0000"
                      className="w-full px-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                      WhatsApp
                    </label>
                    <input
                      type="text"
                      value={formData.whatsapp}
                      onChange={(e) => updateField('whatsapp', e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full px-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all"
                    />
                  </div>
                </div>

                {/* E-mail + Site */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                      E-mail <span className="text-accent-600">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="contato@empresa.com"
                      className={`w-full px-4 py-3 bg-background-50 border rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 transition-all ${
                        errors.email
                          ? 'border-accent-400 focus:ring-accent-400/20'
                          : 'border-background-300 focus:border-primary-400 focus:ring-primary-400/20'
                      }`}
                    />
                    {errors.email && <p className="text-accent-600 text-xs mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                      Site
                    </label>
                    <input
                      type="text"
                      value={formData.site}
                      onChange={(e) => updateField('site', e.target.value)}
                      placeholder="https://www.empresa.com"
                      className="w-full px-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all"
                    />
                  </div>
                </div>

                {/* Redes Sociais */}
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                    Redes Sociais
                  </label>
                  <div className="space-y-3">
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                        <i className="ri-linkedin-fill text-foreground-400 text-sm"></i>
                      </div>
                      <input
                        type="text"
                        value={formData.social_media.linkedin}
                        onChange={(e) => updateSocial('linkedin', e.target.value)}
                        placeholder="LinkedIn"
                        className="w-full pl-10 pr-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all"
                      />
                    </div>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                        <i className="ri-instagram-line text-foreground-400 text-sm"></i>
                      </div>
                      <input
                        type="text"
                        value={formData.social_media.instagram}
                        onChange={(e) => updateSocial('instagram', e.target.value)}
                        placeholder="Instagram"
                        className="w-full pl-10 pr-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all"
                      />
                    </div>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                        <i className="ri-facebook-fill text-foreground-400 text-sm"></i>
                      </div>
                      <input
                        type="text"
                        value={formData.social_media.facebook}
                        onChange={(e) => updateSocial('facebook', e.target.value)}
                        placeholder="Facebook"
                        className="w-full pl-10 pr-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-1">
                    Crie sua conta
                  </h1>
                  <p className="text-foreground-600 text-sm">
                    Defina suas credenciais de acesso ao sistema.
                  </p>
                </div>

                {/* Seu Nome */}
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                    Seu Nome <span className="text-accent-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                      <i className="ri-user-line text-foreground-400"></i>
                    </div>
                    <input
                      type="text"
                      value={formData.seuNome}
                      onChange={(e) => updateField('seuNome', e.target.value)}
                      placeholder="Seu nome completo"
                      className={`w-full pl-10 pr-4 py-3 bg-background-50 border rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 transition-all ${
                        errors.seuNome
                          ? 'border-accent-400 focus:ring-accent-400/20'
                          : 'border-background-300 focus:border-primary-400 focus:ring-primary-400/20'
                      }`}
                    />
                  </div>
                  {errors.seuNome && <p className="text-accent-600 text-xs mt-1">{errors.seuNome}</p>}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                    Senha <span className="text-accent-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                      <i className="ri-lock-line text-foreground-400"></i>
                    </div>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className={`w-full pl-10 pr-4 py-3 bg-background-50 border rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 transition-all ${
                        errors.password
                          ? 'border-accent-400 focus:ring-accent-400/20'
                          : 'border-background-300 focus:border-primary-400 focus:ring-primary-400/20'
                      }`}
                    />
                  </div>
                  {errors.password && <p className="text-accent-600 text-xs mt-1">{errors.password}</p>}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">
                    Confirmar Senha <span className="text-accent-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                      <i className="ri-lock-line text-foreground-400"></i>
                    </div>
                    <input
                      type="password"
                      value={formData.confirm_password}
                      onChange={(e) => updateField('confirm_password', e.target.value)}
                      placeholder="Repita a senha"
                      className={`w-full pl-10 pr-4 py-3 bg-background-50 border rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 transition-all ${
                        errors.confirm_password
                          ? 'border-accent-400 focus:ring-accent-400/20'
                          : 'border-background-300 focus:border-primary-400 focus:ring-primary-400/20'
                      }`}
                    />
                  </div>
                  {errors.confirm_password && <p className="text-accent-600 text-xs mt-1">{errors.confirm_password}</p>}
                </div>

                {/* Resumo */}
                <div className="bg-background-100 rounded-xl p-5 border border-background-200/70">
                  <h3 className="font-heading font-bold text-foreground-900 text-sm mb-3">Resumo do cadastro</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-foreground-500">Empresa:</span>
                      <span className="text-foreground-800 font-medium">{formData.nome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-500">CNPJ:</span>
                      <span className="text-foreground-800 font-medium">{formData.cnpj}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-500">Segmento:</span>
                      <span className="text-foreground-800 font-medium">{formData.segmento}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-500">E-mail:</span>
                      <span className="text-foreground-800 font-medium">{formData.email}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            {submitError && (
              <div className="mt-5 bg-accent-100 border border-accent-300 text-accent-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  <i className="ri-error-warning-line text-accent-600"></i>
                </div>
                {submitError}
              </div>
            )}
            <div className="flex items-center gap-3 mt-8">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-3 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 transition-all cursor-pointer whitespace-nowrap"
                >
                  Voltar
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 py-3 rounded-lg font-heading font-bold text-sm transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-background-50/30 border-t-background-50 rounded-full animate-spin"></div>
                    Processando...
                  </>
                ) : step === 1 ? (
                  <>
                    Continuar
                    <i className="ri-arrow-right-line"></i>
                  </>
                ) : (
                  <>
                    Finalizar Cadastro
                    <i className="ri-check-line"></i>
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="text-center mt-6 text-sm text-foreground-600">
            Já tem conta?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold cursor-pointer">
              Fazer login
            </Link>
          </p>
        </div>
      </div>

      {/* Right - Visual */}
      <div className="hidden lg:flex flex-1 bg-background-950 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-80 h-80 bg-accent-500/15 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 text-center px-8 max-w-md">
          <div className="w-20 h-20 bg-accent-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <i className="ri-rocket-line text-accent-400 text-3xl"></i>
          </div>
          <h2 className="text-2xl font-heading font-bold text-background-50 mb-4">
            Comece em minutos
          </h2>
          <p className="text-background-400 leading-relaxed">
            Cadastre sua empresa, configure seu perfil de cliente ideal e nossa IA
            começa a prospectar leads automaticamente. Simples assim.
          </p>

          <div className="mt-10 space-y-4 text-left">
            {[
              { icon: 'ri-checkbox-circle-line', text: 'Cadastro simplificado em 2 etapas' },
              { icon: 'ri-checkbox-circle-line', text: 'Setup guiado do negócio' },
              { icon: 'ri-checkbox-circle-line', text: 'IA começa a trabalhar em minutos' },
              { icon: 'ri-checkbox-circle-line', text: '7 dias de teste grátis' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <i className={`${item.icon} text-primary-400`}></i>
                </div>
                <span className="text-background-300 text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
