import { useState } from 'react';
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

      {section === 'catalogo' ? <CatalogoCentralizado /> : <TemplatesPropostaTab />}
    </div>
  );
}

function CatalogoCentralizado() {
  return (
    <section className="rounded-xl border border-background-200/70 bg-background-50 p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-700">Catálogo operacional</p>
          <h3 className="mt-1 font-heading text-lg font-bold text-foreground-950">Produtos, serviços e catálogos agora usam uma única base</h3>
          <p className="mt-2 text-sm leading-6 text-foreground-600">O editor anterior usava apenas dados locais e não alimentava a Ana nem a Central. Para não manter dois catálogos divergentes, o conteúdo operacional foi centralizado em Empresa e conhecimento, com fonte, revisão e rastreabilidade.</p>
        </div>
        <button
          type="button"
          onClick={() => { window.location.assign('/dashboard/configuracoes?tab=empresa&subtab=produtos'); }}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary-500 px-3.5 py-2.5 text-xs font-semibold text-background-50 transition hover:bg-primary-600"
        >
          <i className="ri-arrow-right-line" />
          Abrir catálogo operacional
        </button>
      </div>
    </section>
  );
}
