import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

const ADMIN_ONLY = ["/empresa", "/configuracoes", "/diagnostico", "/relatorios"];
const SDR_ALLOWED = ["/", "/prospeccao", "/leads", "/atendimento"];
const CX_ALLOWED = ["/atendimento", "/leads"];

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }

    const [{ data: profile }, { data: rolesRows }] = await Promise.all([
      supabase.from("profiles").select("active").eq("id", data.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
    ]);

    // Bloqueia usuários desativados
    if (profile && profile.active === false) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }

    const roles = (rolesRows ?? []).map((r) => r.role as string);
    const isAdmin = roles.includes("administrador");
    const isSellerOnly = roles.includes("vendedor") && !isAdmin;
    const isSdrOnly = roles.includes("sdr") && !isAdmin && !roles.includes("vendedor");
    const isCxOnly = roles.includes("cx") && !isAdmin && !roles.includes("vendedor") && !roles.includes("sdr");
    const path = location.pathname;

    // Vendedor puro → Central de Atendimento
    if (isSellerOnly && path !== "/atendimento") {
      throw redirect({ to: "/atendimento" });
    }
    // SDR puro → prospecção/leads/atendimento
    if (isSdrOnly && !SDR_ALLOWED.some((p) => (p === "/" ? path === "/" : path === p || path.startsWith(p + "/")))) {
      throw redirect({ to: "/prospeccao" });
    }
    // CX puro → atendimento/leads
    if (isCxOnly && !CX_ALLOWED.some((p) => path === p || path.startsWith(p + "/"))) {
      throw redirect({ to: "/atendimento" });
    }
    // Rotas administrativas
    if (!isAdmin && ADMIN_ONLY.some((p) => path === p || path.startsWith(p + "/"))) {
      throw redirect({ to: "/" });
    }

    return { user: data.user, roles, isAdmin, isSellerOnly, isSdrOnly, isCxOnly };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isSellerOnly, isAdmin } = Route.useRouteContext();
  return (
    <AppShell isSellerOnly={isSellerOnly} isAdmin={isAdmin}>
      <Outlet />
    </AppShell>
  );
}
