import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

// Matriz de navegação aprovada:
// - administrador: tudo
// - vendedor: somente /atendimento
// - SDR:      /prospeccao, /leads (+detalhe) e /atendimento
// - CX:       somente /atendimento
const ADMIN_ONLY = ["/", "/empresa", "/configuracoes", "/diagnostico", "/relatorios", "/orcamentos", "/pedidos"];
const SDR_ALLOWED = ["/prospeccao", "/leads", "/atendimento", "/meu-whatsapp"];
const CX_ALLOWED = ["/atendimento", "/meu-whatsapp"];
const VENDEDOR_ALLOWED = ["/atendimento", "/meu-whatsapp"];

const allows = (allowed: string[], path: string) =>
  allowed.some((p) => path === p || path.startsWith(p + "/"));

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from("organization_members")
      .select("organization_id, role, active, password_change_required, created_at")
      .eq("user_id", data.user.id)
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1);

    if (membershipsError || !memberships?.[0]) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }

    if (memberships[0].password_change_required) {
      throw redirect({ to: "/alterar-senha" });
    }

    const roles = [memberships[0].role as string];
    const isAdmin = roles.includes("administrador");
    const isSellerOnly = !isAdmin && roles.includes("vendedor");
    const isSdrOnly = !isAdmin && !roles.includes("vendedor") && roles.includes("sdr");
    const isCxOnly =
      !isAdmin && !roles.includes("vendedor") && !roles.includes("sdr") && roles.includes("cx");
    const hasValidRole = isAdmin || isSellerOnly || isSdrOnly || isCxOnly;

    // Bloqueia usuário autenticado sem papel válido
    if (!hasValidRole) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }

    const path = location.pathname;

    if (isSellerOnly && !allows(VENDEDOR_ALLOWED, path)) {
      throw redirect({ to: "/atendimento" });
    }
    if (isSdrOnly && !allows(SDR_ALLOWED, path)) {
      throw redirect({ to: "/prospeccao" });
    }
    if (isCxOnly && !allows(CX_ALLOWED, path)) {
      throw redirect({ to: "/atendimento" });
    }
    if (!isAdmin && ADMIN_ONLY.some((p) => path === p || path.startsWith(p + "/"))) {
      // Admin-only route reached por não-admin
      if (isSdrOnly) throw redirect({ to: "/prospeccao" });
      throw redirect({ to: "/atendimento" });
    }

    return { user: data.user, roles, isAdmin, isSellerOnly, isSdrOnly, isCxOnly };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isSellerOnly, isAdmin, isSdrOnly, isCxOnly, roles } = Route.useRouteContext();
  return (
    <AppShell
      isSellerOnly={isSellerOnly}
      isAdmin={isAdmin}
      isSdrOnly={isSdrOnly}
      isCxOnly={isCxOnly}
      roles={roles}
    >
      <Outlet />
    </AppShell>
  );
}
