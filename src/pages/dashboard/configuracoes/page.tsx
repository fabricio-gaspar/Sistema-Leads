import { useSearchParams } from 'react-router-dom';
import EmpresaTabs from '@/pages/dashboard/empresa/components/EmpresaTabs';
import AnaPolicyWorkspace from '@/pages/dashboard/personalizacao-ana/AnaPolicyWorkspace';
import ProductsOrcamentosWorkspace from './components/ProductsOrcamentosWorkspace';
import IntegracoesOperacaoTab from './components/IntegracoesOperacaoTab';
import OperationalStatusTab from './components/OperationalStatusTab';
import UsersAccessWorkspace from './components/UsersAccessWorkspace';
import SuppressionTab from './components/SuppressionTab';
import DiagnosticsTab from './components/DiagnosticsTab';
import './command-center.css';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  description: string;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const groups: MenuGroup[] = [
  {
    title: 'Operação',
    items: [
      { id: 'operacao', label: 'Status operacional', icon: 'ri-pulse-line', description: 'Estado, controles e preparação operacional do sistema.' },
    ],
  },
  {
    title: 'Canais e integrações',
    items: [
      { id: 'canais', label: 'Canais', icon: 'ri-message-3-line', description: 'Entradas, recebimento e canais de atendimento.' },
      { id: 'apis', label: 'APIs', icon: 'ri-code-s-slash-line', description: 'Credenciais, validação e uso operacional de provedores.' },
    ],
  },
  {
    title: 'Empresa e inteligência',
    items: [
      { id: 'empresa', label: 'Empresa e conhecimento', icon: 'ri-building-2-line', description: 'Perfil da empresa, catálogo e conhecimento aprovado.' },
      { id: 'ana', label: 'Configurar a Ana', icon: 'ri-robot-2-line', description: 'Políticas, limites e comportamento assistido da Ana.' },
    ],
  },
  {
    title: 'Gestão comercial',
    items: [
      { id: 'produtos', label: 'Produtos e orçamentos', icon: 'ri-shopping-bag-3-line', description: 'Catálogo, documentos e configurações comerciais.' },
    ],
  },
  {
    title: 'Acesso e segurança',
    items: [
      { id: 'usuarios', label: 'Usuários', icon: 'ri-team-line', description: 'Pessoas, permissões e contas de atendimento.' },
      { id: 'registro', label: 'Registro do Sistema', icon: 'ri-shield-check-line', description: 'Auditoria, diagnósticos e histórico técnico.' },
      { id: 'supressao', label: 'Proteção de contatos', icon: 'ri-shield-check-line', description: 'Preferências de contato e controles de proteção.' },
    ],
  },
];

const legacyTabMap: Record<string, string> = {
  empresa: 'empresa',
  conexoes: 'canais',
  integracoes: 'apis',
  fontes: 'apis',
  'integracoes-operacao': 'canais',
  equipe: 'usuarios',
  ambiente: 'operacao',
  logs: 'operacao',
  abordagem: 'ana',
  templates: 'ana',
  respostas: 'ana',
  variaveis: 'ana',
  biblioteca: 'empresa',
  'templates-proposta': 'produtos',
  'templates-documento': 'produtos',
  fluxos: 'ana',
  horarios: 'ana',
  automacoes: 'ana',
  comercial: 'ana',
  pipeline: 'ana',
};

const availableTabs = new Set(groups.flatMap((group) => group.items.map((item) => item.id)));

function tabFromUrl(params: URLSearchParams) {
  const requested = params.get('tab') || 'operacao';
  const tab = legacyTabMap[requested] || requested;
  return availableTabs.has(tab) ? tab : 'operacao';
}

export default function DashboardConfiguracoes() {
  const [params, setParams] = useSearchParams();
  const tab = tabFromUrl(params);

  const chooseTab = (nextTab: string) => {
    setParams((previous) => { const next = new URLSearchParams(previous); next.set('tab', nextTab); return next; });
  };

  const currentItem = groups.flatMap((group) => group.items).find((item) => item.id === tab);
  const refreshOperationalStatus = () => window.dispatchEvent(new CustomEvent('wayflex:refresh-operational-status'));

  return (
    <div className="wf-page wf-settings cc-settings">
      <div className="wf-page-header cc-settings-header">
        <div>
          <p className="cc-settings-kicker">Administração</p>
          <h1 className="wf-page-title mt-1">Configurações</h1>
          <p className="wf-page-description">{currentItem?.description || 'Canais, automações e acessos.'}</p>
        </div>
        {tab === 'operacao' && <div className="cc-settings-header-actions">
          <button type="button" className="wf-btn-secondary text-xs" onClick={refreshOperationalStatus}><i className="ri-refresh-line" aria-hidden="true" />Atualizar status</button>
        </div>}
      </div>

      <div className="cc-settings-layout flex flex-col items-stretch gap-4 xl:flex-row xl:items-start xl:gap-6">
        <aside className="cc-settings-nav hidden w-[258px] flex-shrink-0 rounded-xl border border-background-200 bg-white p-3 shadow-2xs xl:sticky xl:top-6 xl:block" aria-label="Áreas de configuração">
          {groups.map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
              <p className="px-3 pb-2 pt-2 text-xs font-semibold tracking-wide text-foreground-500">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => chooseTab(item.id)}
                    aria-current={tab === item.id ? 'page' : undefined}
                    className={`cc-settings-nav-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                      tab === item.id
                        ? 'bg-primary-50 text-primary-800 shadow-xs ring-1 ring-inset ring-primary-100'
                        : 'text-foreground-600 hover:bg-background-100 hover:text-foreground-950'
                    }`}
                  >
                    <i className={`${item.icon} text-base`} aria-hidden="true" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        <div className="xl:hidden">
          <label className="sr-only" htmlFor="settings-section">Seção de configurações</label>
          <select
            id="settings-section"
            value={tab}
            onChange={(event) => chooseTab(event.target.value)}
            className="w-full rounded-xl border border-background-200 bg-background-100 px-3.5 py-2.5 text-sm text-foreground-950 outline-none focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20"
          >
            {groups.map((group) => (
              <optgroup key={group.title} label={group.title}>
                {group.items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        <main className="cc-settings-main min-w-0 flex-1" aria-label={currentItem?.label || 'Configurações'}>
          {tab === 'ana' && <AnaPolicyWorkspace />}
          {tab === 'operacao' && <OperationalStatusTab />}
          {tab === 'empresa' && <EmpresaTabs />}
          {tab === 'usuarios' && <UsersAccessWorkspace />}
          {tab === 'produtos' && <ProductsOrcamentosWorkspace />}
          {tab === 'canais' && <IntegracoesOperacaoTab section="channels" />}
          {tab === 'apis' && <IntegracoesOperacaoTab section="apis" />}
          {tab === 'registro' && <DiagnosticsTab />}
          {tab === 'supressao' && <SuppressionTab />}
        </main>
      </div>
    </div>
  );
}
