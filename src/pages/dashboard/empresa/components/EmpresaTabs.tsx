import { useState } from 'react';
import DadosTab from './DadosTab';
import BaseConhecimentoTab from './BaseConhecimentoTab';

const tabs = [
  { id: 'dados', nome: 'Dados da empresa', icone: 'ri-store-2-line' },
  { id: 'conhecimento', nome: 'Base aprovada para a Ana', icone: 'ri-book-open-line' },
];

export default function EmpresaTabs() {
  const [tab, setTab] = useState('dados');

  return (
    <>
      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 bg-background-100 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
              tab === t.id ? 'bg-background-50 text-foreground-900 shadow-sm' : 'text-foreground-500 hover:text-foreground-700'
            }`}
          >
            <i className={t.icone}></i>
            {t.nome}
          </button>
        ))}
      </div>

      {tab === 'dados' && <DadosTab />}
      {tab === 'conhecimento' && <BaseConhecimentoTab />}
    </>
  );
}
