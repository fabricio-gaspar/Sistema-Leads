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
            className={`rounded-xl px-4 py-2 text-xs transition ${section === 'catalogo' ? 'bg-primary-600 font-semibold text-white shadow-xs' : 'text-foreground-500 hover:bg-background-200 hover:text-foreground-950'}`}
        >
          Produtos e catálogo
        </button>
        <button
          type="button"
          onClick={() => setSection('templates')}
            className={`rounded-xl px-4 py-2 text-xs transition ${section === 'templates' ? 'bg-primary-600 font-semibold text-white shadow-xs' : 'text-foreground-500 hover:bg-background-200 hover:text-foreground-950'}`}
        >
          Templates de orçamento
        </button>
      </div>

      {section === 'catalogo' ? <ProdutosTab /> : <TemplatesPropostaTab />}
    </div>
  );
}
