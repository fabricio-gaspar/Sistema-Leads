import { useEffect } from 'react';
import { fmtMoney, fmtDecimal } from '@/pages/dashboard/equipe/equipeUtils';
import type { UsuarioMetricas } from '@/pages/dashboard/equipe/equipeUtils';

function KpiCard({
  label,
  valor,
  sub,
}: {
  label: string;
  valor: string;
  sub?: string;
}) {
  return (
    <div className="bg-background-100/60 rounded-lg p-3">
      <p className="text-[9px] text-foreground-400 uppercase tracking-wider font-medium">
        {label}
      </p>
      <p className="text-base font-bold text-foreground-900 mt-1 whitespace-nowrap">{valor}</p>
      {sub ? <p className="text-[10px] text-foreground-400 mt-0.5">{sub}</p> : null}
    </div>
  );
}

export default function UsuarioDetalhesModal({
  usuario,
  onClose,
}: {
  usuario: UsuarioMetricas;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const taxaLeadProposta = usuario.leads > 0 ? (usuario.propostas / usuario.leads) * 100 : 0;
  const taxaAceite = usuario.propostas > 0 ? (usuario.orcamentosAceitos / usuario.propostas) * 100 : 0;
  const taxaConversao = usuario.leads > 0 ? (usuario.orcamentosAceitos / usuario.leads) * 100 : 0;

  const canais = [
    { nome: 'WhatsApp', valor: usuario.canalWhatsapp, cor: 'bg-primary-500' },
    { nome: 'Instagram', valor: usuario.canalInstagram, cor: 'bg-accent-500' },
    { nome: 'E-mail', valor: usuario.canalEmail, cor: 'bg-amber-500' },
  ];
  const totalCanal = Math.max(usuario.conversas, 1);

  const funil = [
    { nome: 'Leads', valor: usuario.leads, taxa: null as number | null },
    { nome: 'Propostas', valor: usuario.propostas, taxa: taxaLeadProposta },
    { nome: 'Orçamentos aceitos', valor: usuario.orcamentosAceitos, taxa: taxaAceite },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>

      <div className="relative bg-background-50 border border-background-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-background-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-700 text-xl font-bold flex items-center justify-center flex-shrink-0">
              {usuario.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-heading font-bold text-foreground-900">
                  {usuario.nome}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-900 text-[10px] font-medium">
                  {usuario.role}
                </span>
              </div>
              <p className="text-xs text-foreground-500 mt-0.5">{usuario.email}</p>
              <p className="text-xs text-foreground-400">{usuario.company}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 hover:text-foreground-800 cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Corpo */}
        <div className="p-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              label="Conversas"
              valor={String(usuario.conversas)}
              sub={`${usuario.conversasAtivas} ativas · ${usuario.conversasResolvidas} resolvidas`}
            />
            <KpiCard
              label="Leads"
              valor={String(usuario.leads)}
              sub={`${usuario.leadsComConversa} com conversa`}
            />
            <KpiCard label="Propostas" valor={String(usuario.propostas)} />
            <KpiCard label="Orçamentos aceitos" valor={String(usuario.orcamentosAceitos)} />
            <KpiCard label="Valor orçado" valor={fmtMoney(usuario.valorOrcado)} />
            <KpiCard label="Valor médio orçado" valor={fmtMoney(usuario.valorMedioOrcado)} />
            <KpiCard
              label="Tempo Resposta"
              valor={usuario.tempoResposta === null ? 'Não calculado' : `${fmtDecimal(usuario.tempoResposta)} min`}
            />
            <KpiCard label="Conversão" valor={`${fmtDecimal(taxaConversao)}%`} />
          </div>

          {/* Canais */}
          <div>
            <p className="text-[10px] text-foreground-400 uppercase tracking-wider mb-3">
              Canais de Atendimento
            </p>
            <div className="space-y-3">
              {canais.map((c) => (
                <div key={c.nome}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground-600 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${c.cor}`}></span>
                      {c.nome}
                    </span>
                    <span className="text-xs font-bold text-foreground-800">{c.valor}</span>
                  </div>
                  <div className="h-2 bg-background-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${c.cor} rounded-full transition-all`}
                      style={{ width: `${(c.valor / totalCanal) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Funil */}
          <div>
            <p className="text-[10px] text-foreground-400 uppercase tracking-wider mb-3">
              Funil de Conversão
            </p>
            <div className="grid grid-cols-3 gap-3">
              {funil.map((f) => (
                <div key={f.nome} className="bg-background-100/60 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-foreground-500">{f.nome}</p>
                  <p className="text-2xl font-bold text-foreground-900 mt-1">{f.valor}</p>
                  {f.taxa !== null ? (
                    <p className="text-[10px] text-accent-600 mt-0.5">{fmtDecimal(f.taxa)}% conv.</p>
                  ) : (
                    <p className="text-[10px] text-foreground-300 mt-0.5">—</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
