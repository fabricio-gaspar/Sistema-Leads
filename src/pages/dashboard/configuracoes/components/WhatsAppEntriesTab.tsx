import WaAkgPanel from '@/components/feature/WaAkgPanel';

/**
 * O WA-AKG é o canal ativo por vendedor. As contas e a política de transporte
 * continuam separadas: configurar o gateway não libera recebimento, envio ou Ana.
 */
export default function WhatsAppEntriesTab() {
  return <div className="cc-channel-settings space-y-5" data-testid="whatsapp-entries-tab">
    <header className="cc-channel-header flex flex-col gap-3 border-b border-background-200/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="wf-eyebrow">Canal de atendimento</p>
        <h2 className="mt-1 text-xl font-semibold text-foreground-950">WhatsApp com WA-AKG</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-500">O administrador configura o gateway protegido e cada vendedor conecta somente a própria sessão. Recebimento, envio e Ana exigem liberações separadas.</p>
      </div>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800"><i className="ri-shield-check-line" aria-hidden="true" />Canal protegido</span>
    </header>

    <section className="cc-channel-primary">
      <div className="cc-channel-section-heading">
        <p>Canal principal</p>
        <span>Gateway corporativo, sessões individuais e estado confirmado de cada conexão.</span>
      </div>
      <WaAkgPanel />
    </section>

    <aside className="rounded-xl border border-primary-200 bg-primary-50/50 px-4 py-3 text-xs leading-5 text-primary-900" aria-label="Política de canais">
      <i className="ri-information-line mr-1" aria-hidden="true" />
      Configurar o gateway não inicia WhatsApp nem libera mensagens. Cada vendedor precisa ler o QR Code, habilitar a própria conta e receber uma liberação administrativa explícita. A Ana permanece desligada até a política ser publicada.
    </aside>
  </div>;
}
