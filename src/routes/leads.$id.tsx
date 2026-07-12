import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "../components/PagePlaceholder";
export const Route = createFileRoute("/leads/$id")({ component: () => (
  <PagePlaceholder title="Detalhe do Lead" description="Dados, score, timeline comercial, chat WhatsApp e barra de controle IA/humano." />
)});
