import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "../components/PagePlaceholder";
export const Route = createFileRoute("/orcamentos")({ component: () => (
  <PagePlaceholder title="Orçamentos" description="Propostas, catálogo e base de conhecimento com loop de aprendizado da IA." />
)});
