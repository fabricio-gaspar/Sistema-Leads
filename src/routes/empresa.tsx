import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "../components/PagePlaceholder";
export const Route = createFileRoute("/empresa")({ component: () => (
  <PagePlaceholder title="Minha Empresa" description="Cadastro, ICP, catálogo de serviços e Cérebro da IA (tom + objeções)." />
)});
