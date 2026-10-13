import WaAkgPanel from './WaAkgPanel';

/** Canonical WhatsApp provider surface. Legacy provider toggles are removed. */
export default function WhatsappProviderControlPanel() {
  return <section aria-label="Canal WhatsApp WA-AKG" data-testid="wa-akg-provider-control-panel">
    <div className="mb-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-xs leading-5 text-primary-900">
      O WayFlex usa somente o WA-AKG para entrada, saída e automações. O estado operacional é confirmado pelo gateway e pelas sessões abaixo.
    </div>
    <WaAkgPanel mode="administration" />
  </section>;
}
