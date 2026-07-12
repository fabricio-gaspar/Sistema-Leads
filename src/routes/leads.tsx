import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "../components/PagePlaceholder";
export const Route = createFileRoute("/leads")({ component: () => (
  <PagePlaceholder title="Leads" description="Kanban arrastável em 6 estágios, com alertas de escalonamento e leads parados." />
)});
