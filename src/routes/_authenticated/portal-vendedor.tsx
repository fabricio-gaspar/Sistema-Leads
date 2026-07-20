import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Compatibilidade com favoritos e links publicados antes da unificação.
 * A operação do vendedor agora acontece na Central de Atendimento.
 */
export const Route = createFileRoute("/_authenticated/portal-vendedor")({
  beforeLoad: () => {
    throw redirect({ to: "/atendimento" });
  },
});
