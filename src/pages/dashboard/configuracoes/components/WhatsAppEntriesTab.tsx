import EvolutionGoPanel from '@/components/feature/EvolutionGoPanel';

/**
 * O WayFlex opera exclusivamente com Evolution GO. Registros de provedores
 * anteriores continuam no banco para auditoria, mas não são pontos de entrada,
 * configuração nem contingência do produto.
 */
export default function WhatsAppEntriesTab() {
  return <div className="cc-channel-settings space-y-5" data-testid="whatsapp-entries-tab">
    <header className="cc-channel-header flex flex-col gap-3 border-b border-background-200/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="wf-eyebrow">Canal de atendimento</p>
        <h2 className="mt-1 text-xl font-semibold text-foreground-950">WhatsApp com Evolution GO</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-500">O Evolution GO é o único canal do WayFlex. O administrador valida o servidor e cada vendedor conecta apenas a própria instância.</p>
      </div>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800"><i className="ri-shield-check-line" aria-hidden="true" />Canal exclusivo</span>
    </header>

    <section className="cc-channel-primary">
      <div className="cc-channel-section-heading">
        <p>Canal principal</p>
        <span>Servidor corporativo, conectores dos vendedores e estado real de cada instância.</span>
      </div>
      <EvolutionGoPanel />
    </section>

    <aside className="rounded-xl border border-primary-200 bg-primary-50/50 px-4 py-3 text-xs leading-5 text-primary-900" aria-label="Política de canais">
      <i className="ri-information-line mr-1" aria-hidden="true" />
      Z-API, Meta, WA-AKG e entrada pública do site foram retirados dos fluxos ativos. Seus registros históricos permanecem preservados para auditoria; não há troca automática, envio ou nova conexão por esses provedores.
    </aside>
  </div>;
}
