import { useEffect, useState } from 'react';
import { loadLeadQualification, type LeadQualification } from '@/lib/crm/leadQualificationRepository';

const actionLabel: Record<LeadQualification['requestedAction'], string> = {
  none: 'Sem ação solicitada', follow_up: 'Acompanhar', meeting: 'Reunião solicitada', quote: 'Orçamento solicitado', human: 'Atendimento humano',
};
const interestLabel: Record<LeadQualification['interestLevel'], string> = {
  negative: 'Negativo', neutral: 'Neutro', positive: 'Positivo', hot: 'Quente',
};

function Field({ label, value }: { label: string; value: string | null }) {
  return <div><dt className="text-[11px] font-medium text-foreground-500">{label}</dt><dd className="mt-0.5 break-words text-xs leading-5 text-foreground-800">{value || 'A confirmar'}</dd></div>;
}

export default function QualificationDossier({ leadId, compact = false }: { leadId?: string | null; compact?: boolean }) {
  const [dossier, setDossier] = useState<LeadQualification | null>(null);
  const [loading, setLoading] = useState(Boolean(leadId));

  useEffect(() => {
    let active = true;
    if (!leadId) { setDossier(null); setLoading(false); return () => { active = false; }; }
    setLoading(true);
    void loadLeadQualification(leadId).then((value) => { if (active) setDossier(value); }).catch(() => { if (active) setDossier(null); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [leadId]);

  if (loading) return <div className="wf-skeleton h-28" aria-label="Carregando dossiê de qualificação" />;
  if (!dossier) return <div className="rounded-lg border border-dashed border-background-300 px-3 py-3 text-xs leading-5 text-foreground-500">A Ana ainda não registrou um dossiê técnico para este lead.</div>;

  return <section className="rounded-xl border border-secondary-200 bg-secondary-50/60 p-3" aria-label="Dossiê de qualificação">
    <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-secondary-900"><i className="ri-file-search-line mr-1.5" />Dossiê de qualificação</p><p className="mt-0.5 text-[11px] text-secondary-800">Atualizado em {new Date(dossier.updatedAt).toLocaleString('pt-BR')}</p></div>{dossier.readinessScore !== null && <span className="rounded-full bg-background-50 px-2 py-1 text-[11px] font-bold text-secondary-800">Prontidão {dossier.readinessScore}%</span>}</div>
    <p className="mt-3 text-xs leading-5 text-foreground-800">{dossier.summary || 'A Ana está estruturando a necessidade comercial.'}</p>
    <dl className={`mt-3 grid gap-x-3 gap-y-2 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
      <Field label="Necessidade" value={dossier.technical.need} /><Field label="Aplicação/equipamento" value={dossier.technical.application} />
      <Field label="Medida, desenho ou amostra" value={dossier.technical.measurementOrDrawing} /><Field label="Material/condição" value={dossier.technical.materialOrCondition} />
      <Field label="Quantidade" value={dossier.technical.quantity} /><Field label="Prazo" value={dossier.technical.deadline} />
    </dl>
    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-secondary-200 pt-3 text-xs"><div><span className="text-foreground-500">Interesse</span><p className="mt-0.5 font-semibold text-foreground-800">{interestLabel[dossier.interestLevel]}</p></div><div><span className="text-foreground-500">Encaminhamento</span><p className="mt-0.5 font-semibold text-foreground-800">{actionLabel[dossier.requestedAction]}</p></div>{dossier.decisionMaker && <div className="col-span-2"><span className="text-foreground-500">Decisor</span><p className="mt-0.5 font-semibold text-foreground-800">{dossier.decisionMaker}</p></div>}</div>
    {dossier.missingFields.length > 0 && <p className="mt-3 rounded-lg bg-background-50 px-2.5 py-2 text-xs leading-5 text-foreground-700"><strong>Falta confirmar:</strong> {dossier.missingFields.join(', ')}.</p>}
    {dossier.nextAction && <p className="mt-2 text-xs leading-5 text-secondary-900"><strong>Próxima ação:</strong> {dossier.nextAction}</p>}
  </section>;
}
