import { useState } from 'react';
import TemplatesPropostaTab from './TemplatesPropostaTab';

type Section = 'catalogo' | 'templates';

export default function CommercialCatalogTab() {
  const [section, setSection] = useState<Section>('catalogo');

  return (
    <div className="cc-catalog space-y-5">
      <div className="cc-catalog-switch" role="group" aria-label="Gestão comercial">
        <button
          type="button"
          onClick={() => setSection('catalogo')}
          aria-pressed={section === 'catalogo'}
          className={section === 'catalogo' ? 'active' : ''}
        >
          Produtos e catálogo
        </button>
        <button
          type="button"
          onClick={() => setSection('templates')}
          aria-pressed={section === 'templates'}
          className={section === 'templates' ? 'active' : ''}
        >
          Templates de orçamento
        </button>
      </div>

      <div>{section === 'catalogo' ? <CatalogoCentralizado /> : <TemplatesPropostaTab />}</div>
    </div>
  );
}

function CatalogoCentralizado() {
  return (
    <section className="cc-catalog-entry">
      <div className="cc-catalog-entry-icon" aria-hidden="true"><i className="ri-archive-stack-line" /></div>
      <div className="cc-catalog-entry-body">
        <p className="cc-catalog-kicker">Base comercial</p>
        <h3>Produtos e serviços em uma base única</h3>
        <p>Gerencie itens, fontes e revisão em Empresa e conhecimento.</p>
        <div className="cc-catalog-features" aria-label="Organização do catálogo">
          <span><i className="ri-links-line" aria-hidden="true" /> Fonte</span>
          <span><i className="ri-check-double-line" aria-hidden="true" /> Revisão</span>
          <span><i className="ri-history-line" aria-hidden="true" /> Rastreabilidade</span>
        </div>
        <details className="cc-catalog-info">
          <summary>Por que o catálogo fica em Empresa e conhecimento?</summary>
          <p>O editor anterior usava apenas dados locais e não alimentava a Ana nem a Central. A base operacional centralizada evita catálogos divergentes.</p>
        </details>
      </div>
      <div className="cc-catalog-entry-action">
        <button
          type="button"
          onClick={() => { window.location.assign('/dashboard/configuracoes?tab=empresa&subtab=produtos'); }}
          className="cc-catalog-open"
        >
          Abrir catálogo operacional
          <i className="ri-arrow-right-up-line" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
