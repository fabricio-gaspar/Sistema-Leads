import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "../components/PagePlaceholder";
export const Route = createFileRoute("/pedidos")({ component: () => (
  <PagePlaceholder title="Pedidos" description="Pedidos com status de contrato e financeiro, badge do vendedor (IA ou humano) e cobrança." />
)});
