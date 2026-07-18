import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }

    // Fetch roles client-side to decide portal-only redirect
    const { data: rolesRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (rolesRows ?? []).map((r) => r.role as string);
    const isAdmin = roles.includes("administrador");
    const isSellerOnly = roles.includes("vendedor") && !isAdmin;

    // Vendedor puro só pode acessar o portal
    if (isSellerOnly && !location.pathname.startsWith("/portal-vendedor")) {
      throw redirect({ to: "/portal-vendedor" });
    }

    return { user: data.user, roles, isAdmin, isSellerOnly };
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
