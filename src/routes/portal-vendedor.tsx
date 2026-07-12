import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "../components/PagePlaceholder";
export const Route = createFileRoute("/portal-vendedor")({ component: () => (
  <PagePlaceholder title="Portal do Vendedor" description="Login por QR + OTP no WhatsApp, sessão cronometrada e fila de leads priorizada." />
)});
