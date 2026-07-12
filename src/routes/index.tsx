import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "../components/PagePlaceholder";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <PagePlaceholder
      title="Dashboard"
      description="Painel de controle com KPIs, funil visual, atividade da Ana e tarefas do dia."
    />
  );
}
