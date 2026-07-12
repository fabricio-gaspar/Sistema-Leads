import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "../components/PagePlaceholder";
export const Route = createFileRoute("/relatorios")({ component: () => (
  <PagePlaceholder title="Relatórios" description="Faturamento, conversão por estágio, comparativo IA × humano e jornada do Portal do Vendedor." />
)});
