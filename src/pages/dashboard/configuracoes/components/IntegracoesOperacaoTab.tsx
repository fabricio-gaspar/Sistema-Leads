import IntegracoesTab from './IntegracoesTab';
import FontesTab from './FontesTab';

export default function IntegracoesOperacaoTab() {
  return <div className="space-y-7">
    <header className="rounded-2xl border border-[#E5E5EA] bg-white p-5 shadow-2xs md:p-6">
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#0071E3]">Conexões reais</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-[#1D1D1F]">Prospecção, comunicação e Ana</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#6E6E73]">Cada integração tem uma finalidade registrada no backend. Credenciais, teste e ativação são separados, e nenhum cartão usa estado local como prova de conexão.</p>
    </header>
    <section>
      <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#86868B]">1. Comunicação e atendimento</p><h3 className="mt-1 text-lg font-bold text-[#1D1D1F]">Canais que conversam com leads</h3><p className="mt-1 text-sm text-[#6E6E73]">WhatsApp e demais canais de contato. O teste não cria conversa nem envia mensagens.</p></div>
      <IntegracoesTab category="communication" />
    </section>
    <section className="border-t border-[#E5E5EA] pt-7">
      <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#86868B]">2. Prospecção e dados</p><h3 className="mt-1 text-lg font-bold text-[#1D1D1F]">APIs usadas para encontrar novos leads</h3><p className="mt-1 text-sm text-[#6E6E73]">Uma fonte só entra na Busca de Leads depois de configurada, validada e ativada no backend.</p></div>
      <IntegracoesTab category="prospecting" />
      <FontesTab />
    </section>
    <section className="border-t border-[#E5E5EA] pt-7">
      <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#86868B]">3. Inteligência da Ana</p><h3 className="mt-1 text-lg font-bold text-[#1D1D1F]">Provedor de IA</h3><p className="mt-1 text-sm text-[#6E6E73]">A IA apoia a Ana no backend; ela não é canal de atendimento nem fonte de prospecção.</p></div>
      <IntegracoesTab category="intelligence" />
    </section>
  </div>;
}
