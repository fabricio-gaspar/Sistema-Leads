import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [formStatus, setFormStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleContactSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const honeypot = (formData.get('company_alt') as string || '').trim();
    if (honeypot) {
      form.reset();
      return;
    }
    setFormStatus({
      type: 'error',
      msg: 'O canal comercial será habilitado por uma integração autenticada antes da publicação. Nenhum dado foi enviado.',
    });
  };

  return (
    <div className="min-h-screen bg-background-50">
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-background-50/95 backdrop-blur-md border-b border-background-200/70'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 cursor-pointer">
            <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center">
              <i className="ri-flashlight-line text-background-50 text-base"></i>
            </div>
            <span className={`font-heading font-bold text-xl ${scrolled ? 'text-foreground-900' : 'text-background-50'}`}>
              Sistema de Leads
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {['Funcionalidades', 'Cases', 'FAQ'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className={`text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  scrolled ? 'text-foreground-700 hover:text-foreground-950' : 'text-background-100/80 hover:text-background-50'
                }`}
              >
                {item}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className={`text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                scrolled ? 'text-foreground-700 hover:text-foreground-950' : 'text-background-100/80 hover:text-background-50'
              }`}
            >
              Entrar
            </Link>
            <Link
              to="/register"
              className="bg-primary-500 hover:bg-primary-600 text-background-50 px-5 py-2.5 rounded-lg text-sm font-semibold font-heading transition-all cursor-pointer whitespace-nowrap"
            >
              Começar Grátis
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden w-9 h-9 flex items-center justify-center cursor-pointer"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            <i className={`${scrolled ? 'text-foreground-800' : 'text-background-50'} text-xl ${mobileMenu ? 'ri-close-line' : 'ri-menu-line'}`}></i>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenu && (
          <div className="md:hidden bg-background-50 border-b border-background-200/70 px-4 py-4">
            <div className="flex flex-col gap-3">
              {['Funcionalidades', 'Cases', 'FAQ'].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="text-foreground-700 text-sm font-medium py-2 cursor-pointer"
                  onClick={() => setMobileMenu(false)}
                >
                  {item}
                </a>
              ))}
              <div className="flex gap-3 pt-2 border-t border-background-200/70">
                <Link to="/login" className="flex-1 text-center py-2.5 border border-background-300 rounded-lg text-sm font-semibold text-foreground-700 cursor-pointer" onClick={() => setMobileMenu(false)}>
                  Entrar
                </Link>
                <Link to="/register" className="flex-1 text-center py-2.5 bg-primary-500 text-background-50 rounded-lg text-sm font-semibold cursor-pointer" onClick={() => setMobileMenu(false)}>
                  Começar Grátis
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative w-full min-h-[600px] md:min-h-[700px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(245,158,11,0.35),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(34,197,94,0.22),transparent_40%),linear-gradient(135deg,#173b2f,#0c211b_55%,#102f25)]"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-foreground-950/70 via-foreground-950/50 to-foreground-950/70"></div>

        <div className="relative z-10 w-full max-w-4xl mx-auto text-center px-4 md:px-6 py-20">
          <div className="inline-flex items-center gap-2 bg-background-50/15 backdrop-blur-sm border border-background-50/20 rounded-full px-4 py-1.5 mb-8">
            <div className="w-2 h-2 rounded-full bg-accent-500"></div>
            <span className="text-background-50/90 text-sm font-medium">IA de ponta para prospecção B2B</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-extrabold text-background-50 leading-tight mb-6">
            Prospecção Inteligente
            <br />
            <span className="text-accent-400">no Piloto Automático</span>
          </h1>

          <p className="text-lg md:text-xl text-background-100/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            Encontre, qualifique e converta os melhores leads para o seu negócio usando
            Inteligência Artificial. Automatize seu processo comercial e escale a geração de orçamentos.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="bg-accent-500 hover:bg-accent-600 text-background-950 px-8 py-3.5 rounded-lg text-base font-bold font-heading transition-all cursor-pointer whitespace-nowrap w-full sm:w-auto"
            >
              Começar Agora
              <i className="ri-arrow-right-line ml-2"></i>
            </Link>
            <a
              href="#funcionalidades"
              className="bg-background-50/10 hover:bg-background-50/20 backdrop-blur-sm border border-background-50/30 text-background-50 px-8 py-3.5 rounded-lg text-base font-semibold font-heading transition-all cursor-pointer whitespace-nowrap w-full sm:w-auto"
            >
              Conhecer a plataforma
            </a>
          </div>

          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-background-100/50 text-sm">
            <div className="flex items-center gap-2">
              <i className="ri-shield-check-line text-accent-400 text-lg"></i>
              <span>Dados seguros</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-flashlight-line text-accent-400 text-lg"></i>
              <span>Setup em 5 minutos</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-refresh-line text-accent-400 text-lg"></i>
              <span>Atualização diária</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-customer-service-2-line text-accent-400 text-lg"></i>
              <span>Suporte 24/7</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative -mt-16 z-20 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-background-50 rounded-2xl border border-background-200/70 p-8 md:p-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: '50K+', label: 'Leads Encontrados' },
                { value: '98%', label: 'Taxa de Entrega' },
                { value: '3.2x', label: 'Mais Conversões' },
                { value: '24h', label: 'Setup Completo' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-3xl md:text-4xl font-heading font-extrabold text-primary-600">{stat.value}</p>
                  <p className="text-foreground-600 text-sm mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="funcionalidades" className="py-20 md:py-28 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-accent-100 text-accent-800 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-sparkling-2-line"></i>
              Funcionalidades
            </div>
            <h2 className="text-3xl md:text-5xl font-heading font-extrabold text-foreground-950 mb-4">
              Tudo que você precisa para
              <br />
              <span className="text-primary-600">dominar a prospecção</span>
            </h2>
            <p className="text-foreground-600 text-lg max-w-2xl mx-auto">
              Um ecossistema completo que organiza cada etapa do seu processo comercial,
              da descoberta de leads até o fechamento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: 'ri-search-eye-line',
                title: 'Busca Inteligente de Leads',
                desc: 'Nossa IA vasculha bases públicas e encontra empresas que combinam perfeitamente com seu perfil de cliente ideal.',
              },
              {
                icon: 'ri-message-3-line',
                title: 'Abordagem Multicanal',
                desc: 'Alcance seus leads por WhatsApp, e-mail ou telefone com mensagens personalizadas e automatizadas.',
              },
              {
                icon: 'ri-robot-line',
                title: 'Atendente Virtual IA',
                desc: 'Um agente de IA que conversa, tira dúvidas e qualifica oportunidades 24 horas por dia, 7 dias por semana.',
              },
              {
                icon: 'ri-file-text-line',
                title: 'Orçamentos Automáticos',
                desc: 'Gere propostas comerciais em PDF automaticamente e envie por e-mail ou WhatsApp em segundos.',
              },
              {
                icon: 'ri-bar-chart-box-line',
                title: 'Dashboard Completo',
                desc: 'Acompanhe captação, qualificação, reuniões, orçamentos e a performance do seu time em tempo real.',
              },
              {
                icon: 'ri-shield-check-line',
                title: 'Conformidade LGPD',
                desc: 'Todo o tratamento de dados segue rigorosamente a legislação brasileira de proteção de dados.',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group bg-background-50 border border-background-200/70 rounded-xl p-6 md:p-7 hover:border-primary-300/50 transition-all duration-300 cursor-pointer"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-5 group-hover:bg-primary-200 transition-colors">
                  <i className={`${feature.icon} text-primary-600 text-xl`}></i>
                </div>
                <h3 className="text-lg font-heading font-bold text-foreground-900 mb-2">{feature.title}</h3>
                <p className="text-foreground-600 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="cases" className="py-20 md:py-28 bg-background-100 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-800 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-route-line"></i>
              Como Funciona
            </div>
            <h2 className="text-3xl md:text-5xl font-heading font-extrabold text-foreground-950 mb-4">
              Do cadastro ao orçamento aprovado em
              <br />
              <span className="text-primary-600">4 passos simples</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: '01', icon: 'ri-building-line', title: 'Cadastre sua Empresa', desc: 'Configure seu negócio, produtos e diferenciais em minutos.' },
              { step: '02', icon: 'ri-radar-line', title: 'Defina seus Leads', desc: 'Escolha segmentos, regiões e o perfil de cliente ideal.' },
              { step: '03', icon: 'ri-send-plane-line', title: 'Automatize a Abordagem', desc: 'A IA encontra e aborda leads nos canais certos automaticamente.' },
              { step: '04', icon: 'ri-file-list-3-line', title: 'Aprove Orçamentos', desc: 'Envie orçamentos, registre o aceite e acompanhe a oportunidade no painel.' },
            ].map((step, i) => (
              <div key={i} className="relative text-center group">
                <div className="w-16 h-16 bg-background-50 border-2 border-primary-200 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:border-primary-400 group-hover:bg-primary-50 transition-all">
                  <i className={`${step.icon} text-primary-600 text-2xl`}></i>
                </div>
                <span className="absolute top-0 right-0 md:right-4 text-5xl font-heading font-extrabold text-background-200 select-none -z-0">
                  {step.step}
                </span>
                <h3 className="relative z-10 text-base font-heading font-bold text-foreground-900 mb-2">{step.title}</h3>
                <p className="relative z-10 text-foreground-600 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-28 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-accent-100 text-accent-800 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-double-quotes-l"></i>
              Quem Usa Recomenda
            </div>
            <h2 className="text-3xl md:text-5xl font-heading font-extrabold text-foreground-950">
              Empresas que já transformaram
              <br />
              <span className="text-primary-600">sua prospecção</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                nome: 'Ricardo Almeida',
                cargo: 'CEO - TechVision',
                texto: 'Depois que implementamos o Sistema de Leads, nosso time comercial triplicou a produtividade. A IA encontra leads que nem sabíamos que existiam.',
                avatar: 'RA',
              },
              {
                nome: 'Marina Santos',
                cargo: 'Diretora Comercial - Construtora Prime',
                texto: 'A automação das abordagens por WhatsApp mudou nosso jogo. Agora alcançamos 5x mais prospects com a mesma equipe.',
                avatar: 'MS',
              },
              {
                nome: 'Fernando Costa',
                cargo: 'COO - Agência Digital Wave',
                texto: 'O dashboard me dá visibilidade total do funil. Consigo tomar decisões baseadas em dados reais, não em achismos.',
                avatar: 'FC',
              },
            ].map((t, i) => (
              <div key={i} className="bg-background-50 border border-background-200/70 rounded-xl p-6 md:p-7">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-star-fill text-accent-400 text-sm"></i>
                    </div>
                  ))}
                </div>
                <p className="text-foreground-700 text-sm leading-relaxed mb-6">{t.texto}</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-700 font-heading font-bold text-sm">{t.avatar}</span>
                  </div>
                  <div>
                    <p className="text-foreground-900 font-semibold text-sm">{t.nome}</p>
                    <p className="text-foreground-500 text-xs">{t.cargo}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 md:py-28 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-accent-100 text-accent-800 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-question-answer-line"></i>
              Dúvidas Frequentes
            </div>
            <h2 className="text-3xl md:text-5xl font-heading font-extrabold text-foreground-950">
              Perguntas que
              <br />
              <span className="text-primary-600">sempre fazem</span>
            </h2>
          </div>

          <div className="space-y-4">
            {[
              { q: 'Como a IA encontra os leads?', a: 'Nossa IA utiliza APIs públicas, bases de dados governamentais e fontes abertas para identificar empresas que correspondem ao perfil configurado. O processo é 100% automatizado e respeita todas as normas de coleta de dados.' },
              { q: 'Preciso de conhecimento técnico para usar?', a: 'Não! O Sistema de Leads foi projetado para ser intuitivo. Basta cadastrar sua empresa, configurar seu perfil de cliente ideal e o sistema faz todo o trabalho pesado automaticamente.' },
              { q: 'As mensagens enviadas são personalizadas?', a: 'Sim! Você define os templates e a IA adapta cada mensagem ao contexto do lead, incluindo nome da empresa, segmento e outros dados relevantes para maximizar a taxa de resposta.' },
              { q: 'Meus dados estão seguros?', a: 'Totalmente. Utilizamos criptografia de ponta a ponta e seguimos rigorosamente a LGPD. Seus dados e os dados dos seus leads são tratados com máxima segurança e confidencialidade.' },
            ].map((faq, i) => (
              <details key={i} className="group bg-background-50 border border-background-200/70 rounded-xl overflow-hidden cursor-pointer">
                <summary className="flex items-center justify-between px-6 py-5 text-foreground-900 font-heading font-semibold text-sm md:text-base list-none">
                  {faq.q}
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 ml-3">
                    <i className="ri-add-line text-foreground-400 group-open:hidden"></i>
                    <i className="ri-subtract-line text-primary-500 hidden group-open:block"></i>
                  </div>
                </summary>
                <div className="px-6 pb-5 text-foreground-600 text-sm leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 px-4 md:px-6 bg-background-950 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 left-10 w-72 h-72 bg-primary-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent-500 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-heading font-extrabold text-background-50 mb-6">
            Pronto para revolucionar
            <br />
            sua prospecção?
          </h2>
          <p className="text-background-100/60 text-lg mb-10 max-w-xl mx-auto">
            Junte-se a mais de 2.000 empresas que já automatizaram sua prospecção e
            estão vendendo mais todos os dias.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="bg-accent-500 hover:bg-accent-600 text-background-950 px-8 py-3.5 rounded-lg text-base font-bold font-heading transition-all cursor-pointer whitespace-nowrap w-full sm:w-auto"
            >
              Começar Teste Grátis
              <i className="ri-arrow-right-line ml-2"></i>
            </Link>
            <a
              href="#contato"
              className="border border-background-100/30 text-background-50 hover:bg-background-50/10 px-8 py-3.5 rounded-lg text-base font-semibold font-heading transition-all cursor-pointer whitespace-nowrap w-full sm:w-auto"
            >
              Falar com Especialista
            </a>
          </div>
        </div>
      </section>

      {/* Contato */}
      <section id="contato" className="py-20 md:py-28 px-4 md:px-6 bg-background-100">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-accent-100 text-accent-800 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-customer-service-2-line"></i>
              Fale Conosco
            </div>
            <h2 className="text-3xl md:text-5xl font-heading font-extrabold text-foreground-950 mb-4">
              Vamos conversar sobre
              <br />
              <span className="text-primary-600">sua prospecção</span>
            </h2>
            <p className="text-foreground-600 text-lg max-w-xl mx-auto">
              Preencha o formulário e nossa equipe comercial retornará em até 1 dia útil.
            </p>
          </div>

          <form onSubmit={handleContactSubmit} className="leadai-contact-form bg-background-50 border border-background-200/70 rounded-2xl p-6 md:p-8 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome completo <span className="text-accent-600">*</span></label>
                <input type="text" name="nome" required placeholder="Seu nome" className="w-full px-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">E-mail corporativo <span className="text-accent-600">*</span></label>
                <input type="email" name="email" required placeholder="voce@empresa.com" className="w-full px-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Empresa</label>
                <input type="text" name="empresa" placeholder="Nome da sua empresa" className="w-full px-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">WhatsApp</label>
                <input type="text" name="telefone" placeholder="(00) 00000-0000" className="w-full px-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-800 mb-1.5">Mensagem <span className="text-accent-600">*</span></label>
              <textarea name="mensagem" required rows={4} maxLength={500} placeholder="Conte um pouco sobre o que você precisa..." className="w-full px-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 transition-all resize-none"></textarea>
            </div>
            <input type="text" name="company_alt" tabIndex={-1} autoComplete="off" aria-hidden="true" readOnly className="field-alternate" />
            {formStatus && (
              <div className={`px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${formStatus.type === 'success' ? 'bg-primary-100 text-primary-800' : 'bg-accent-100 text-accent-800'}`}>
                <i className={formStatus.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}></i>
                {formStatus.msg}
              </div>
            )}
            <button type="submit" className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 px-8 py-3.5 rounded-lg font-heading font-bold text-sm transition-all cursor-pointer whitespace-nowrap w-full sm:w-auto">
              Enviar mensagem
              <i className="ri-send-plane-line"></i>
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background-950 border-t border-background-800/50 py-16 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                  <i className="ri-flashlight-line text-background-50 text-sm"></i>
                </div>
                <span className="font-heading font-bold text-xl text-background-50">Sistema de Leads</span>
              </div>
              <p className="text-background-400 text-sm leading-relaxed max-w-xs">
                Plataforma de prospecção inteligente que automatiza o processo comercial com Inteligência Artificial.
              </p>
            </div>
            <div>
              <h4 className="font-heading font-semibold text-background-100 text-sm mb-4">Produto</h4>
              <ul className="space-y-2.5">
                <li><a href="#funcionalidades" className="text-background-400 hover:text-background-100 text-sm transition-colors cursor-pointer">Funcionalidades</a></li>
                <li><a href="#cases" className="text-background-400 hover:text-background-100 text-sm transition-colors cursor-pointer">Cases</a></li>
                <li><a href="#faq" className="text-background-400 hover:text-background-100 text-sm transition-colors cursor-pointer">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading font-semibold text-background-100 text-sm mb-4">Empresa</h4>
              <ul className="space-y-2.5">
                <li><a href="#funcionalidades" className="text-background-400 hover:text-background-100 text-sm transition-colors cursor-pointer">Sobre Nós</a></li>
                <li><a href="#cases" className="text-background-400 hover:text-background-100 text-sm transition-colors cursor-pointer">Cases de Sucesso</a></li>
                <li><a href="#contato" className="text-background-400 hover:text-background-100 text-sm transition-colors cursor-pointer">Contato</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading font-semibold text-background-100 text-sm mb-4">Legal</h4>
              <ul className="space-y-2.5">
                <li><a href="#faq" className="text-background-400 hover:text-background-100 text-sm transition-colors cursor-pointer">Privacidade</a></li>
                <li><a href="#faq" className="text-background-400 hover:text-background-100 text-sm transition-colors cursor-pointer">LGPD</a></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between pt-8 border-t border-background-800/50 gap-4">
            <p className="text-background-500 text-xs">
              &copy; 2026 Sistema de Leads. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-4">
              {['ri-linkedin-fill', 'ri-instagram-line', 'ri-twitter-x-line', 'ri-youtube-line'].map((icon, i) => (
                <a key={i} href="#" className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-800/50 hover:bg-background-700/50 text-background-400 hover:text-background-100 transition-all cursor-pointer">
                  <i className={`${icon} text-sm`}></i>
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
