import { useState } from 'react';
import EmpresaTabs from '@/pages/dashboard/empresa/components/EmpresaTabs';
import PersonalizacaoAna from '@/pages/dashboard/personalizacao-ana/page';
import CommercialCatalogTab from './components/CommercialCatalogTab';
import IntegracoesOperacaoTab from './components/IntegracoesOperacaoTab';
import OperationalStatusTab from './components/OperationalStatusTab';
import TeamAccessTab from './components/TeamAccessTab';
import SuppressionTab from './components/SuppressionTab';

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
    title: 'Comece aqui',
    items: [
      { id: 'ana', label: 'Configurar a Ana', icon: 'ri-robot-2-line' },
      { id: 'operacao', label: 'Status operacional', icon: 'ri-pulse-line' },
    ],
  },
  {
    title: 'Base comercial',
    items: [
      { id: 'empresa', label: 'Empresa e conhecimento', icon: 'ri-building-2-line' },
      { id: 'equipe', label: 'Equipe e acessos', icon: 'ri-team-line' },
      { id: 'produtos', label: 'Produtos e orçamentos', icon: 'ri-shopping-bag-3-line' },
    ],
  },
  {
    title: 'Captação e canais',
    items: [
      { id: 'conexoes', label: 'Canais, APIs e fontes', icon: 'ri-plug-2-line' },
    ],
  },
  {
    title: 'Segurança e controle',
    items: [
      { id: 'supressao', label: 'Proteção de contatos', icon: 'ri-shield-check-line' },
    ],
  },
];

const legacyTabMap: Record<string, string> = {
  empresa: 'empresa',
  fontes: 'conexoes',
  integracoes: 'conexoes',
  'integracoes-operacao': 'conexoes',
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

function tabFromUrl() {
  const requested = new URLSearchParams(window.location.search).get('tab') || 'ana';
  const tab = legacyTabMap[requested] || requested;
  return availableTabs.has(tab) ? tab : 'ana';
}

export default function DashboardConfiguracoes() {
  const [tab, setTab] = useState(tabFromUrl);

  const chooseTab = (nextTab: string) => {
    setTab(nextTab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', nextTab);
    window.history.replaceState(null, '', url.toString());
  };

  const currentItem = groups.flatMap((group) => group.items).find((item) => item.id === tab);

  return (
    <div className="wf-page">
      <div className="wf-page-header">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">Administração</p>
          <h1 className="wf-page-title mt-1">Configurações</h1>
          <p className="wf-page-description">
            Cada área abaixo altera ou mostra a configuração efetivamente usada na operação da WayFlex.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start lg:gap-6">
        <aside className="hidden w-[248px] flex-shrink-0 rounded-2xl border border-[#E5E5EA] bg-white p-3 shadow-2xs lg:sticky lg:top-6 lg:block">
          {groups.map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
              <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#86868B]">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => chooseTab(item.id)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                      tab === item.id
                        ? 'bg-[#0071E3] text-white shadow-xs'
                        : 'text-[#4A4A4D] hover:bg-[#F2F2F7] hover:text-[#1D1D1F]'
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
            className="w-full rounded-xl border border-[#E5E5EA] bg-[#F2F2F7] px-3.5 py-2.5 text-sm text-[#1D1D1F] outline-none focus:border-[#0071E3] focus:bg-white focus:ring-2 focus:ring-[#0071E3]/20"
          >
            {groups.map((group) => (
              <optgroup key={group.title} label={group.title}>
                {group.items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        <main className="min-w-0 flex-1" aria-label={currentItem?.label || 'Configurações'}>
          {tab === 'ana' && <PersonalizacaoAna embedded />}
          {tab === 'operacao' && <OperationalStatusTab />}
          {tab === 'empresa' && <EmpresaTabs />}
          {tab === 'equipe' && <TeamAccessTab />}
          {tab === 'produtos' && <CommercialCatalogTab />}
          {tab === 'conexoes' && <IntegracoesOperacaoTab />}
          {tab === 'supressao' && <SuppressionTab />}
        </main>
      </div>
    </div>
  );
}
