import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "../components/PagePlaceholder";
export const Route = createFileRoute("/prospeccao")({ component: () => (
  <PagePlaceholder title="Prospecção" description="Busca de leads por região/segmento, score explicável e envio em massa para IA ou vendedor humano." />
)});
