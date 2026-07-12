import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "../components/PagePlaceholder";
export const Route = createFileRoute("/configuracoes")({ component: () => (
  <PagePlaceholder title="Configurações" description="Usuários, integrações, limites e alçadas, notificações e auditoria completa." />
)});
