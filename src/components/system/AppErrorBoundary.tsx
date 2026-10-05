import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

/** Mantém uma falha de tela isolada e oferece recuperação explícita ao usuário. */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Mantém detalhes técnicos no console para diagnóstico sem expô-los na interface.
    console.error('Erro não tratado na interface do Sistema de Leads.', error, errorInfo);
  }

  private reloadApplication = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[oklch(var(--background-50))] px-6">
          <section aria-live="assertive" className="w-full max-w-lg rounded-2xl border border-[oklch(var(--secondary-200))] bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[oklch(var(--primary-700))]">Sistema de Leads</p>
            <h1 className="mt-3 text-2xl font-bold text-[oklch(var(--foreground-900))]">Não foi possível carregar esta tela</h1>
            <p className="mt-3 text-sm leading-6 text-[oklch(var(--foreground-600))]">
              A falha foi isolada para que ela não apareça como uma tela em branco. Atualize a aplicação para tentar novamente.
            </p>
            <button
              className="mt-6 rounded-lg bg-[oklch(var(--primary-700))] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[oklch(var(--primary-800))] focus:outline-none focus:ring-2 focus:ring-[oklch(var(--primary-500))] focus:ring-offset-2"
              onClick={this.reloadApplication}
              type="button"
            >
              Recarregar aplicação
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
