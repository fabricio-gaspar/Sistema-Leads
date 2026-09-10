import { useState } from 'react';
import { Link, useLocation, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotificacoesStore } from '@/hooks/useNotificacoesStore';
import { useTarefasStore } from '@/hooks/useTarefasStore';
import { useSaudeWhatsapp } from '@/hooks/useSaudeWhatsapp';
import { useOperationalMode } from '@/hooks/useOperationalMode';
import SaudeWhatsappIndicator from '@/components/feature/SaudeWhatsappIndicator';
import ModoExecucaoToggle from '@/components/feature/ModoExecucaoToggle';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'ri-dashboard-line' },
  { label: 'Busca de Leads', path: '/dashboard/busca-leads', icon: 'ri-search-eye-line' },
  { label: 'Leads', path: '/dashboard/leads', icon: 'ri-user-search-line' },
  { label: 'Kanban', path: '/dashboard/kanban', icon: 'ri-layout-masonry-line' },
  { label: 'Central de Atendimento', path: '/dashboard/atendimento', icon: 'ri-customer-service-2-line' },
  { label: 'Orçamentos', path: '/dashboard/orcamentos', icon: 'ri-file-list-3-line' },
  { label: 'Agenda', path: '/dashboard/agenda', icon: 'ri-calendar-event-line' },
  { label: 'Funil', path: '/dashboard/funil', icon: 'ri-arrow-down-line' },
  { label: 'Relatórios', path: '/dashboard/relatorios', icon: 'ri-bar-chart-line' },
  { label: 'Registro do Sistema', path: '/dashboard/registro-sistema', icon: 'ri-file-list-3-line' },
  { label: 'Configurações', path: '/dashboard/configuracoes', icon: 'ri-settings-4-line' },
];

const tipoIcone: Record<string, string> = {
  lead: 'ri-user-search-line text-primary-600',
  proposta: 'ri-file-list-3-line text-accent-600',
  venda: 'ri-file-list-3-line text-secondary-600',
  sistema: 'ri-settings-4-line text-foreground-500',
  alerta: 'ri-error-warning-line text-accent-600',
  TAREFA: 'ri-task-line text-primary-600',
  HANDOFF: 'ri-user-shared-line text-accent-600',
  APROVACAO: 'ri-shield-check-line text-secondary-600',
};

const iconeNotificacao = (tipo: string) => tipoIcone[tipo] || 'ri-notification-3-line text-foreground-500';

const formatarDataNotif = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [painelAba, setPainelAba] = useState<'notificacoes' | 'tarefas'>('notificacoes');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const notif = useNotificacoesStore();
  const tarefas = useTarefasStore();
  const saude = useSaudeWhatsapp();
  const { mode: operationalMode } = useOperationalMode();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background-50">
        <div className="w-8 h-8 border-2 border-background-200 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const naoLidas = notif.naoLidas;
  const tarefasPendentes = tarefas.tarefas.filter((t) => !t.concluida).length;
  const badgeAtencao = naoLidas + tarefasPendentes;

  return (
    <div className="flex h-screen bg-background-100">
      {sidebarOpen && <button aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-20 bg-foreground-950/20 backdrop-blur-[1px] lg:hidden" />}
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full w-64 lg:translate-x-0 lg:w-20'
        } wf-sidebar transition-all duration-300 flex flex-col fixed lg:relative z-30 h-full`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-background-200/80">
          {sidebarOpen ? (
            <Link to="/dashboard" className="min-w-0 px-1 font-heading text-base font-extrabold tracking-[0.13em] text-foreground-950">
              WAYFLEX
            </Link>
          ) : (
            <Link to="/dashboard" className="mx-auto font-heading text-sm font-extrabold tracking-[0.12em] text-foreground-950" aria-label="WayFlex">
              W
            </Link>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="wf-icon-button !w-7 !h-7 cursor-pointer"
          >
            <i className={`${sidebarOpen ? 'ri-arrow-left-s-line' : 'ri-arrow-right-s-line'} text-sm`}></i>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
                    className={`wf-nav-item ${isActive ? 'is-active' : ''} flex items-center gap-3 px-3 py-2.5 rounded-lg group cursor-pointer whitespace-nowrap`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className={`${item.icon} text-lg`}></i>
                    </div>
                    {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>

        </nav>

        {/* User */}
        <div className="border-t border-background-200/80 p-3 relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center gap-3 cursor-pointer rounded-lg p-1 hover:bg-background-800/30 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-accent-500 flex items-center justify-center flex-shrink-0">
              <span className="text-background-50 font-heading font-bold text-sm">{user.avatar}</span>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-foreground-900 text-sm font-medium truncate">{user.name}</p>
                <p className="text-foreground-400 text-xs truncate">{user.role}</p>
              </div>
            )}
            {sidebarOpen && (
              <i className="ri-arrow-up-s-line text-foreground-400 text-sm"></i>
            )}
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-white border border-background-200 rounded-xl overflow-hidden shadow-xl">
              <div className="px-3 py-2.5 border-b border-background-800">
                <p className="text-foreground-900 text-sm font-medium truncate">{user.email}</p>
                <p className="text-foreground-500 text-xs">{user.company}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground-600 hover:bg-background-100 hover:text-foreground-900 cursor-pointer transition-colors"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-logout-box-r-line"></i>
                </div>
                Sair
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="wf-topbar bg-background-50 border-b border-background-200/70 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 cursor-pointer transition-colors"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <i className="ri-menu-line text-foreground-700 text-lg"></i>
            </button>
            <div className="relative hidden sm:block">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
              <input
                type="text"
                placeholder="Buscar leads, conversas, tarefas..."
                className="pl-9 pr-4 py-2 bg-background-100 border border-background-200/70 rounded-xl text-sm text-foreground-800 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400/20 w-72 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ModoExecucaoToggle />

            <div className="hidden md:flex items-center gap-2 bg-primary-100 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
              <span className="text-xs font-medium text-primary-700 whitespace-nowrap">Ana está online</span>
            </div>

            <SaudeWhatsappIndicator />

            {/* Notificações */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 cursor-pointer transition-colors"
              >
                <i className="ri-notification-3-line text-foreground-600 text-lg"></i>
                {badgeAtencao > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent-500 text-background-50 rounded-full text-[10px] flex items-center justify-center font-bold">
                    {badgeAtencao}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)}></div>
                  <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 bg-background-50 border border-background-200/70 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-background-200/70 flex items-center justify-between">
                      <div className="flex items-center gap-1 p-1 bg-background-100 rounded-lg">
                        <button
                          onClick={() => setPainelAba('notificacoes')}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                            painelAba === 'notificacoes' ? 'bg-background-50 text-primary-700 shadow-sm' : 'text-foreground-500 hover:text-foreground-700'
                          }`}
                        >
                          Notificações
                          {naoLidas > 0 && <span className="ml-1 text-accent-600">({naoLidas})</span>}
                        </button>
                        <button
                          onClick={() => setPainelAba('tarefas')}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                            painelAba === 'tarefas' ? 'bg-background-50 text-primary-700 shadow-sm' : 'text-foreground-500 hover:text-foreground-700'
                          }`}
                        >
                          Tarefas
                          {tarefasPendentes > 0 && <span className="ml-1 text-accent-600">({tarefasPendentes})</span>}
                        </button>
                      </div>
                      {painelAba === 'notificacoes' && naoLidas > 0 && (
                        <button
                          onClick={notif.marcarTodasLidas}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium cursor-pointer"
                        >
                          Marcar lidas
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {painelAba === 'notificacoes' && (
                        <>
                          {notif.notificacoes.length === 0 && (
                            <div className="px-4 py-10 text-center text-foreground-400 text-sm">
                              <i className="ri-notification-off-line text-2xl mb-2 block"></i>
                              Sem notificações
                            </div>
                          )}
                          {notif.notificacoes.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => {
                                notif.marcarLida(n.id);
                                navigate(n.tipo === 'HANDOFF' ? '/dashboard/atendimento' : '/dashboard/leads');
                                setNotifOpen(false);
                              }}
                              className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-background-100 hover:bg-background-50/50 transition-colors cursor-pointer ${
                                !n.lida ? 'bg-primary-50/40' : ''
                              }`}
                            >
                              <div className="w-8 h-8 rounded-lg bg-background-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <i className={`${iconeNotificacao(n.tipo)} text-sm`}></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`text-sm font-medium truncate ${!n.lida ? 'text-foreground-900' : 'text-foreground-600'}`}>
                                    {n.titulo}
                                  </p>
                                  {!n.lida && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0"></span>
                                  )}
                                </div>
                                <p className="text-xs text-foreground-500 mt-0.5 line-clamp-2">{n.descricao}</p>
                                <p className="text-[10px] text-foreground-400 mt-1">{formatarDataNotif(n.data)}</p>
                              </div>
                            </button>
                          ))}
                        </>
                      )}

                      {painelAba === 'tarefas' && (
                        <>
                          {tarefas.tarefas.length === 0 && (
                            <div className="px-4 py-10 text-center text-foreground-400 text-sm">
                              <i className="ri-task-line text-2xl mb-2 block"></i>
                              Nenhuma tarefa
                            </div>
                          )}
                          {tarefas.tarefas.map((t) => (
                            <label key={t.id} className="flex items-start gap-3 px-4 py-3 text-left border-b border-background-100 hover:bg-background-50/50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={t.concluida}
                                onChange={() => tarefas.alternar(t.id)}
                                className="w-4 h-4 mt-0.5 cursor-pointer accent-primary-500 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`text-sm font-medium truncate ${t.concluida ? 'text-foreground-400 line-through' : 'text-foreground-900'}`}>
                                    {t.titulo}
                                  </p>
                                  {!t.concluida && <span className="w-1.5 h-1.5 rounded-full bg-accent-500 flex-shrink-0"></span>}
                                </div>
                                {t.leadNome && <p className="text-xs text-foreground-500 mt-0.5 truncate">{t.leadNome}</p>}
                                <div className="flex items-center gap-3 mt-1 text-[10px] text-foreground-400 flex-wrap">
                                  <span><i className="ri-user-line mr-0.5"></i>{t.responsavel}</span>
                                  <span className={`font-semibold ${t.prioridade === 'ALTA' ? 'text-accent-600' : t.prioridade === 'MEDIA' ? 'text-primary-600' : 'text-foreground-400'}`}>{t.prioridade}</span>
                                  {t.dataLimite && <span><i className="ri-time-line mr-0.5"></i>{formatarDataNotif(t.dataLimite)}</span>}
                                </div>
                              </div>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button className="hidden sm:flex w-9 h-9 items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 cursor-pointer transition-colors">
              <i className="ri-question-line text-foreground-600 text-lg"></i>
            </button>
          </div>
        </header>

        {/* A origem é company_settings; o navegador não inicia filas nem decide o modo. */}
        {operationalMode !== 'real' && operationalMode !== 'loading' && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 bg-[#FF9500] px-4 py-2 text-xs font-medium text-white sm:px-6">
            <i className="ri-shield-check-line" />
            <span className="leading-5">AMBIENTE REAL EM PREPARAÇÃO — saídas automáticas permanecem bloqueadas até as verificações do backend serem concluídas.</span>
            <Link to="/dashboard/configuracoes?tab=operacao" className="ml-auto cursor-pointer whitespace-nowrap underline underline-offset-2 hover:opacity-80">Ver status operacional</Link>
          </div>
        )}

        {/* Alerta de risco de bloqueio do WhatsApp */}
        {saude.nivel === 'critico' && (
          <div className="px-4 sm:px-6 py-2 flex flex-wrap items-center gap-2 text-xs font-medium bg-accent-500 text-background-50 flex-shrink-0">
            <i className="ri-alarm-warning-line"></i>
            <span className="leading-5">
              Risco de bloqueio do WhatsApp em {saude.risco}% — acima do limite de {saude.limite}%. Considere pausar envios proativos.
            </span>
          </div>
        )}

        {/* Page Content */}
        <main className="wf-main flex-1 overflow-y-auto bg-background-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
