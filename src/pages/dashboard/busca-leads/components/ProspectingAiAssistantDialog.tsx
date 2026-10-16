import { useState } from 'react';
import AccessibleDialog from '@/components/feature/AccessibleDialog';
import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import {
  buildLocalProspectingAiPlan,
  normalizeProspectingAiPlan,
  type ProspectingAiDraft,
  type ProspectingAiPlan,
} from '@/lib/crm/prospectingAiAssistant';

export default function ProspectingAiAssistantDialog({ currentFilters, selectedCatalogItemId, localBuyerTerms, onClose, onApply }: {
  currentFilters: ProspectingAiDraft;
  selectedCatalogItemId?: string;
  localBuyerTerms?: string[];
  onClose: () => void;
  onApply: (plan: ProspectingAiPlan) => void;
}) {
  const [instruction, setInstruction] = useState('');
  const [plan, setPlan] = useState<ProspectingAiPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  const prepare = async () => {
    const request = instruction.trim();
    if (!request) {
      setNotice('Descreva o público ou objetivo da busca para a IA preparar os filtros.');
      return;
    }

    setLoading(true);
    setNotice('');
    try {
      const session = await resolveOrganizationSession();
      const { data, error } = await supabase.functions.invoke('gerar-prompt-busca', {
        body: {
          action: 'suggest_filters',
          organizationId: session.organizationId,
          request,
          currentFilters,
          selectedCatalogItemId,
        },
      });
      if (error || !data?.plan) throw new Error('ai_unavailable');
      setPlan(normalizeProspectingAiPlan(data.plan, currentFilters));
      if (data?.source === 'fallback') setNotice('A IA não está disponível agora; foram usadas sugestões locais do seu perfil comercial.');
    } catch {
      setPlan(buildLocalProspectingAiPlan({ ...currentFilters, terms: [...currentFilters.terms, ...(localBuyerTerms || [])] }));
      setNotice('A IA não está disponível agora; foram usadas sugestões locais do seu perfil comercial.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccessibleDialog title="IA para Busca de Leads" onClose={() => { if (!loading) onClose(); }} className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground-950/50 p-4">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="border-b border-background-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700"><i className="ri-sparkling-2-line text-lg" aria-hidden="true" /></div>
            <div>
              <p className="wf-eyebrow">Assistente contextual</p>
              <h2 className="mt-1 font-heading text-lg font-bold text-foreground-950">Prepare a busca com IA</h2>
              <p className="mt-1 text-sm text-foreground-600">A sugestão considera o perfil comercial cadastrado e os filtros atuais. Nenhuma busca é iniciada nesta etapa.</p>
            </div>
          </div>
        </header>

        <div className="space-y-4 p-5">
          <label className="block text-sm font-semibold text-foreground-800" htmlFor="prospecting-ai-request">
            O que você quer encontrar?
            <textarea
              id="prospecting-ai-request"
              autoFocus
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              rows={4}
              maxLength={800}
              placeholder="Ex.: Distribuidores industriais de materiais técnicos em Campinas, com site e contato comercial."
              className="mt-1.5 w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2.5 text-sm font-normal text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </label>
          <p className="text-xs leading-5 text-foreground-500">A IA não recebe chaves, tokens, QR Codes ou mensagens privadas. Ela apenas propõe filtros para sua revisão.</p>

          {notice && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">{notice}</p>}

          {plan && <section aria-label="Prévia dos filtros sugeridos" className="rounded-xl border border-primary-200 bg-primary-50/50 p-4">
            <div className="flex items-start gap-2"><i className="ri-checkbox-circle-line mt-0.5 text-primary-700" aria-hidden="true" /><div><h3 className="text-sm font-bold text-foreground-900">Estratégia pronta para revisão</h3><p className="mt-1 text-sm text-foreground-700">{plan.summary}</p></div></div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Região</dt><dd className="mt-1 font-medium text-foreground-900">{plan.city} · {plan.state}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Volume</dt><dd className="mt-1 font-medium text-foreground-900">{plan.volume} leads</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Oferta</dt><dd className="mt-1 text-foreground-900">{plan.offer}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Termos</dt><dd className="mt-1 flex flex-wrap gap-1.5">{plan.terms.map((term) => <span key={term} className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-foreground-700">{term}</span>)}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Critérios</dt><dd className="mt-1 text-foreground-900">{[plan.requireSite && 'Site informado', plan.requireWhatsApp && 'Telefone ou WhatsApp', plan.requireEmail && 'E-mail informado'].filter(Boolean).join(' · ') || 'Sem exigências adicionais'}</dd></div>
            </dl>
            <p className="mt-4 border-t border-primary-200 pt-3 text-xs leading-5 text-foreground-600">{plan.rationale}</p>
          </section>}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-background-200 px-5 py-4">
          <button type="button" disabled={loading} onClick={onClose} className="wf-btn-secondary disabled:opacity-50">Cancelar</button>
          {!plan ? <button type="button" disabled={loading} onClick={() => void prepare()} className="wf-btn-primary disabled:opacity-50">{loading ? 'Preparando…' : <><i className="ri-sparkling-2-line mr-1.5" aria-hidden="true" />Preparar filtros</>}</button> : <><button type="button" disabled={loading} onClick={() => void prepare()} className="wf-btn-secondary disabled:opacity-50">Gerar novamente</button><button type="button" onClick={() => onApply(plan)} className="wf-btn-primary"><i className="ri-check-line mr-1.5" aria-hidden="true" />Aplicar filtros</button></>}
        </footer>
      </section>
    </AccessibleDialog>
  );
}
