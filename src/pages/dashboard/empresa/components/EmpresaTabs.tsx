import { useState } from 'react';
import DadosTab from './DadosTab';
import DocumentosTab from './DocumentosTab';
import BaseConhecimentoTab from './BaseConhecimentoTab';
import OperacaoTab from './OperacaoTab';
import TimeTab from './TimeTab';
import IntegracoesTab from './IntegracoesTab';

const tabs = [
  { id: 'dados', nome: 'Dados', icone: 'ri-store-2-line' },
  { id: 'operacao', nome: 'Operação', icone: 'ri-settings-3-line' },
  { id: 'time', nome: 'Time', icone: 'ri-team-line' },
  { id: 'integracoes', nome: 'Integrações', icone: 'ri-plug-line' },
  { id: 'conhecimento', nome: 'Base de Conhecimento', icone: 'ri-book-open-line' },
  { id: 'documentos', nome: 'Documentos', icone: 'ri-folder-line' },
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
      {tab === 'operacao' && <OperacaoTab />}
      {tab === 'time' && <TimeTab />}
      {tab === 'integracoes' && <IntegracoesTab />}
      {tab === 'documentos' && <DocumentosTab />}
      {tab === 'conhecimento' && <BaseConhecimentoTab />}
    </>
  );
}
