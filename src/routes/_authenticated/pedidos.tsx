import { createFileRoute, redirect } from "@tanstack/react-router";

// Pedidos belonged to an older sales/ERP scope. The Wayflex lead product ends at
// an approved commercial proposal; historical order data remains untouched for
// compatibility, but the UI no longer exposes an order/checkout workflow.
export const Route = createFileRoute("/_authenticated/pedidos")({
  beforeLoad: () => {
    throw redirect({ to: "/orcamentos" });
  },
});
