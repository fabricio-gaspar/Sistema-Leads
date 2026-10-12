import { useEffect, useRef } from 'react';
import WaAkgPanel from './WaAkgPanel';

export default function WaAkgOnboardingDialog({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const app = document.querySelector<HTMLElement>('.wf-app');
    const previousAriaHidden = app?.getAttribute('aria-hidden');
    const previousInert = app?.hasAttribute('inert') ?? false;

    document.body.style.overflow = 'hidden';
    app?.setAttribute('aria-hidden', 'true');
    app?.setAttribute('inert', '');
    closeRef.current?.focus();

    const getFocusableElements = () => [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [])];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;

      const elements = getFocusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (app) {
        if (previousAriaHidden === null) app.removeAttribute('aria-hidden');
        else app.setAttribute('aria-hidden', previousAriaHidden);
        if (!previousInert) app.removeAttribute('inert');
      }
      previous?.focus();
    };
  }, [onClose]);

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground-950/55 p-4 backdrop-blur-[2px]">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="wa-akg-onboarding-title" aria-describedby="wa-akg-onboarding-description" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-background-200 bg-background-50 shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between border-b border-background-200/70 bg-background-50 px-5 py-4">
        <div><p className="wf-eyebrow">CONFIGURAÇÃO INICIAL</p><h1 id="wa-akg-onboarding-title" className="mt-1 text-lg font-bold text-foreground-950">Conecte seu WhatsApp</h1><p id="wa-akg-onboarding-description" className="mt-1 text-xs leading-5 text-foreground-500">Faça a leitura do QR Code da sua instância para começar a usar a Central de Atendimento.</p></div>
        <button ref={closeRef} type="button" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" onClick={onClose} aria-label="Continuar sem conectar agora"><i className="ri-close-line text-lg" /></button>
      </header>
      <div className="p-5"><WaAkgPanel mode="self-service" surface="onboarding" onConnected={onConnected} /></div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-background-200/70 bg-background-50 px-5 py-4"><p className="text-xs text-foreground-500">Você pode continuar no sistema e conectar o aparelho depois.</p><button type="button" className="wf-btn-secondary text-xs" onClick={onClose}>Continuar sem conectar</button></footer>
    </section>
  </div>;
}
