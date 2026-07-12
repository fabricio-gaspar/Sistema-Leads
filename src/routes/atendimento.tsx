import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "../components/PagePlaceholder";
export const Route = createFileRoute("/atendimento")({ component: () => (
  <PagePlaceholder title="Central de Atendimento" description="Inbox unificado estilo WhatsApp Web com filtros por IA/humano/escaladas." />
)});
