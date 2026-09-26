import { useEffect, useRef } from 'react';
import type { PreviewLead } from '@/mocks/enriquecimentoData';
import { tempBadge, tempLabel, tempCorTexto } from '@/mocks/enriquecimentoData';

interface LeadPreviewDrawerProps {
  lead: PreviewLead;
  onClose: () => void;
  onDescartar: (id: string) => void;
  onAbordar: (id: string) => void;
}

function CanalChip({ ativo, label, icone }: { ativo: boolean; label: string; icone: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${
        ativo ? 'bg-secondary-100 text-secondary-800' : 'bg-background-100 text-foreground-400 line-through'
      }`}
    >
      <i className={icone}></i>
      {label}
    </span>
  );
}

export default function LeadPreviewDrawer({ lead, onClose, onDescartar, onAbordar }: LeadPreviewDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const completudeCor =
    lead.completude >= 80
      ? 'bg-primary-500'
      : lead.completude >= 60
      ? 'bg-accent-500'
      : 'bg-background-300';

  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-foreground-950/50 flex justify-end" onClick={onClose}>
      <div
        ref={dialogRef}
        className="bg-background-50 w-full max-w-md h-full flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-preview-title"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-background-200/70">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 id="lead-preview-title" className="font-heading font-bold text-foreground-950 text-lg">{lead.nome}</h3>
                <i className={`ri-fire-fill text-sm ${tempCorTexto[lead.temperatura]}`}></i>
              </div>
              <p className="text-sm text-foreground-500">{lead.empresa} · {lead.cargo}</p>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Fechar detalhes do lead"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer flex-shrink-0"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${tempBadge[lead.temperatura]}`}>
              {tempLabel[lead.temperatura]}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
              Score {lead.score}
            </span>
            {lead.duplicado && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent-100 text-accent-700">
                <i className="ri-error-warning-line"></i> Duplicado
              </span>
            )}
            {lead.validacao === 'revisar' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800">
                <i className="ri-alert-line"></i> Revisar contato
              </span>
            )}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Evidências retornadas pela fonte para esta revisão */}
          <section>
            <p className="text-xs font-semibold text-foreground-700 mb-3 flex items-center gap-1.5">
              <i className="ri-search-eye-line text-secondary-600"></i> Por que este resultado foi retornado
            </p>
            <div className="space-y-2">
              {lead.motivos.map((m, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <i className="ri-checkbox-circle-line text-primary-500 mt-0.5"></i>
                  <span className="text-foreground-800">{m}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Completude do contato */}
          <section className="bg-background-100/60 border border-background-200/70 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground-700">Grau de enriquecimento</p>
              <span className="text-sm font-bold text-foreground-900">{lead.completude}%</span>
            </div>
            <div className="w-full h-2 bg-background-200 rounded-full overflow-hidden">
              <div className={`h-full ${completudeCor} rounded-full transition-all`} style={{ width: `${lead.completude}%` }}></div>
            </div>
            <p className="text-xs text-foreground-500 mt-2">
              {lead.completude >= 80
                ? 'Dados retornados pela fonte. A revisão e a autorização de contato continuam obrigatórias.'
                : lead.completude >= 60
                ? 'A fonte retornou dados parciais. Revise as evidências antes de importar.'
                : 'Dados incompletos retornados pela fonte. Revise antes de decidir pela importação.'}
            </p>
          </section>

          {/* Canais detectados */}
          <section>
            <p className="text-xs font-semibold text-foreground-700 mb-3">Canais detectados</p>
            <div className="flex flex-wrap gap-2">
              <CanalChip ativo={lead.whatsappStatus === 'verified'} label="WhatsApp comprovado" icone="ri-whatsapp-line" />
              <CanalChip ativo={Boolean(lead.telefone)} label="Telefone informado" icone="ri-phone-line" />
              <CanalChip ativo={lead.canais.email} label="E-mail" icone="ri-mail-line" />
              <CanalChip ativo={lead.canais.site} label="Site" icone="ri-global-line" />
              <CanalChip ativo={lead.canais.instagram} label="Instagram" icone="ri-instagram-line" />
            </div>
          </section>

          {/* Dados do contato */}
          <section className="space-y-3 text-sm">
            <div>
              <p className="text-foreground-500 text-xs">CNPJ</p>
              <p className="text-foreground-900">{lead.cnpj}</p>
            </div>
            <div>
              <p className="text-foreground-500 text-xs">Telefone</p>
              <p className="text-foreground-900">{lead.telefone}</p>
            </div>
            <div>
              <p className="text-foreground-500 text-xs">E-mail</p>
              <p className={`text-foreground-900 break-all ${lead.validacao === 'revisar' ? 'text-accent-600' : ''}`}>
                {lead.email}
              </p>
            </div>
            <div>
              <p className="text-foreground-500 text-xs">Localidade</p>
              <p className="text-foreground-900">{lead.localidade}</p>
            </div>
            <div>
              <p className="text-foreground-500 text-xs">Fonte</p>
              <p className="text-foreground-900">{lead.fonte}</p>
            </div>
          </section>
        </div>

        {/* Ações */}
        <div className="px-6 py-4 border-t border-background-200/70 space-y-2">
          <button
            onClick={() => onAbordar(lead.id)}
            disabled={lead.duplicado}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            Preparar para importação
          </button>
          <button
            onClick={() => onDescartar(lead.id)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-close-circle-line"></i>
            Remover desta revisão
          </button>
        </div>
      </div>
    </div>
  );
}
