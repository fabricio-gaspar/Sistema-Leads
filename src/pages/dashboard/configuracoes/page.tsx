import { useSearchParams } from 'react-router-dom';
import EmpresaTabs from '@/pages/dashboard/empresa/components/EmpresaTabs';
import PersonalizacaoAna from '@/pages/dashboard/personalizacao-ana/page';
import CommercialCatalogTab from './components/CommercialCatalogTab';
import IntegracoesOperacaoTab from './components/IntegracoesOperacaoTab';
import OperationalStatusTab from './components/OperationalStatusTab';
import TeamAccessTab from './components/TeamAccessTab';
import SuppressionTab from './components/SuppressionTab';
import DiagnosticsTab from './components/DiagnosticsTab';
import './command-center.css';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const groups: MenuGroup[] = [
  {
    title: 'Operação',
    items: [
      { id: 'operacao', label: 'Status operacional', icon: 'ri-pulse-line' },
    ],
  },
  {
    title: 'Canais e integrações',
    items: [
      { id: 'canais', label: 'Canais', icon: 'ri-message-3-line' },
      { id: 'apis', label: 'APIs', icon: 'ri-code-s-slash-line' },
    ],
  },
  {
    title: 'Empresa e inteligência',
    items: [
      { id: 'empresa', label: 'Empresa e conhecimento', icon: 'ri-building-2-line' },
      { id: 'ana', label: 'Configurar a Ana', icon: 'ri-robot-2-line' },
    ],
  },
  {
    title: 'Gestão comercial',
    items: [
      { id: 'produtos', label: 'Produtos e orçamentos', icon: 'ri-shopping-bag-3-line' },
    ],
  },
  {
    title: 'Acesso e governança',
    items: [
      { id: 'usuarios', label: 'Usuários', icon: 'ri-team-line' },
      { id: 'registro', label: 'Registro do Sistema', icon: 'ri-shield-check-line' },
      { id: 'supressao', label: 'Proteção de contatos', icon: 'ri-shield-check-line' },
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

  return (
    <div className="wf-page wf-settings cc-settings">
      <div className="wf-page-header cc-settings-header">
        <div>
          <p className="cc-settings-kicker">WayFlex / Administração</p>
          <h1 className="wf-page-title mt-1">Configurações</h1>
          <p className="wf-page-description">Operação, conhecimento, canais e acessos da equipe.</p>
        </div>
        <span className="cc-settings-context"><i className="ri-settings-3-line" aria-hidden="true" /> {currentItem?.label || 'Status operacional'}</span>
      </div>

      <div className="cc-settings-layout flex flex-col items-stretch gap-4 lg:flex-row lg:items-start lg:gap-6">
        <aside className="cc-settings-nav hidden w-[258px] flex-shrink-0 rounded-xl border border-background-200 bg-white p-3 shadow-2xs lg:sticky lg:top-6 lg:block" aria-label="Áreas de configuração">
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

        <div className="lg:hidden">
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
          {tab === 'ana' && <PersonalizacaoAna embedded />}
          {tab === 'operacao' && <OperationalStatusTab />}
          {tab === 'empresa' && <EmpresaTabs />}
          {tab === 'usuarios' && <TeamAccessTab />}
          {tab === 'produtos' && <CommercialCatalogTab />}
          {tab === 'canais' && <IntegracoesOperacaoTab section="channels" />}
          {tab === 'apis' && <IntegracoesOperacaoTab section="apis" />}
          {tab === 'registro' && <DiagnosticsTab />}
          {tab === 'supressao' && <SuppressionTab />}
        </main>
      </div>
    </div>
  );
}
