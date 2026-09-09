import { useState } from 'react';
import ProdutosTab from './ProdutosTab';
import TemplatesPropostaTab from './TemplatesPropostaTab';

type Section = 'catalogo' | 'templates';

export default function CommercialCatalogTab() {
  const [section, setSection] = useState<Section>('catalogo');

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-2xl border border-[#E5E5EA] bg-[#F2F2F7] p-1.5">
        <button
          type="button"
          onClick={() => setSection('catalogo')}
          className={`rounded-xl px-4 py-2 text-xs transition ${section === 'catalogo' ? 'bg-[#0071E3] font-semibold text-white shadow-xs' : 'text-[#6E6E73] hover:bg-[#E5E5EA] hover:text-[#1D1D1F]'}`}
        >
          Produtos e catálogo
        </button>
        <button
          type="button"
          onClick={() => setSection('templates')}
          className={`rounded-xl px-4 py-2 text-xs transition ${section === 'templates' ? 'bg-[#0071E3] font-semibold text-white shadow-xs' : 'text-[#6E6E73] hover:bg-[#E5E5EA] hover:text-[#1D1D1F]'}`}
        >
          Templates de orçamento
        </button>
      </div>

      {section === 'catalogo' ? <ProdutosTab /> : <TemplatesPropostaTab />}
    </div>
  );
}
