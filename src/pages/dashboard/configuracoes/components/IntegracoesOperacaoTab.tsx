import IntegracoesTab from './IntegracoesTab';
import FontesTab from './FontesTab';

export default function IntegracoesOperacaoTab() {
  return <div className="space-y-7">
    <header className="rounded-2xl border border-[#E5E5EA] bg-white p-5 shadow-2xs md:p-6">
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#0071E3]">Conexões reais</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-[#1D1D1F]">Canais, APIs e fontes de captação</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#6E6E73]">Aqui ficam somente os provedores que já possuem integração no backend. Credenciais, teste e ativação são etapas separadas e rastreáveis. O modo de envio é consultado em <strong>Status operacional</strong>.</p>
    </header>
    <section>
      <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#86868B]">1. Conectores</p><h3 className="mt-1 text-lg font-bold text-[#1D1D1F]">Canais e provedores</h3><p className="mt-1 text-sm text-[#6E6E73]">Configure credenciais no cofre e valide cada integração sem disparar mensagens.</p></div>
      <IntegracoesTab />
    </section>
    <section className="border-t border-[#E5E5EA] pt-7">
      <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#86868B]">2. Captação</p><h3 className="mt-1 text-lg font-bold text-[#1D1D1F]">Fontes habilitadas para busca</h3><p className="mt-1 text-sm text-[#6E6E73]">Uma fonte só entra na Busca de Leads depois de estar configurada, validada e ativa no backend.</p></div>
      <FontesTab />
    </section>
  </div>;
}
