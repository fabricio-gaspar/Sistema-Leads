import { Link } from 'react-router-dom';
import WaAkgPanel from './WaAkgPanel';

/**
 * Compatibility surface for the team-access modal.
 *
 * Seller sessions are now managed only by WA-AKG. Keeping this component as a
 * small wrapper avoids old TeamAccess routes reintroducing legacy credentials
 * while directing administrators to the canonical channel panel.
 */
export default function WhatsappAccountPanel(_props: { member?: unknown }) {
  return <section className="space-y-4" data-testid="wa-akg-team-account-panel">
    <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900">
      <p className="font-semibold">WhatsApp com WA-AKG</p>
      <p className="mt-1 text-xs leading-5">As conexões antigas foram retiradas. Configure o gateway e as sessões dos vendedores no canal oficial; credenciais de provedores legados não são aceitas.</p>
      <Link to="/dashboard/configuracoes?tab=canais" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:underline">Abrir configuração do canal <i className="ri-arrow-right-line" /></Link>
    </div>
    <WaAkgPanel mode="administration" />
  </section>;
}
