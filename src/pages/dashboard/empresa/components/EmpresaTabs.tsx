import { useState } from 'react';
import BaseConhecimentoTab from './BaseConhecimentoTab';
import KnowledgeOverviewTab from './KnowledgeOverviewTab';
import KnowledgeSourcesTab from './KnowledgeSourcesTab';
import KnowledgeCatalogManagerTab from './KnowledgeCatalogManagerTab';
import KnowledgeDocumentsMediaTab from './KnowledgeDocumentsMediaTab';

const tabs = [
  { id: 'visao-geral', nome: 'Visão geral', icone: 'ri-dashboard-line' },
  { id: 'produtos', nome: 'Produtos e acessórios', icone: 'ri-shapes-line' },
  { id: 'servicos', nome: 'Serviços', icone: 'ri-tools-line' },
  { id: 'catalogos', nome: 'Catálogos e documentos', icone: 'ri-book-open-line' },
  { id: 'documentos', nome: 'Documentos e mídia', icone: 'ri-folder-shared-line' },
  { id: 'fontes', nome: 'Fontes de conhecimento', icone: 'ri-radar-line' },
  { id: 'ana', nome: 'Configurações da Ana', icone: 'ri-robot-2-line' },
];

export default function EmpresaTabs() {
  const requested = new URLSearchParams(window.location.search).get('subtab');
  const legacyTabs: Record<string, string> = { dados: 'visao-geral', conhecimento: 'ana', fontes: 'documentos' };
  const initialTab = legacyTabs[requested || ''] || requested || 'visao-geral';
  const [tab, setTab] = useState(tabs.some((item) => item.id === initialTab) ? initialTab : 'visao-geral');

  const selectTab = (id: string) => {
    setTab(id);
    const url = new URL(window.location.href);
    url.searchParams.set('subtab', id);
    window.history.replaceState(null, '', url.toString());
  };

  return (
    <>
      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 bg-background-100 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => selectTab(t.id)}
            className={`inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
              tab === t.id ? 'bg-background-50 text-foreground-900 shadow-sm' : 'text-foreground-500 hover:text-foreground-700'
            }`}
          >
            <i className={t.icone}></i>
            {t.nome}
          </button>
        ))}
      </div>

      {tab === 'visao-geral' && <KnowledgeOverviewTab />}
      {tab === 'produtos' && <KnowledgeCatalogManagerTab itemType="product" />}
      {tab === 'servicos' && <KnowledgeCatalogManagerTab itemType="service" />}
      {tab === 'catalogos' && <KnowledgeCatalogManagerTab itemType="catalog" />}
      {tab === 'documentos' && <KnowledgeDocumentsMediaTab />}
      {tab === 'fontes' && <KnowledgeSourcesTab />}
      {tab === 'ana' && <BaseConhecimentoTab />}
    </>
  );
}
