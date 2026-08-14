import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

// Matriz de navegação aprovada:
// - administrador: tudo
// - vendedor: somente /atendimento
// - SDR:      /prospeccao, /leads (+detalhe) e /atendimento
// - CX:       somente /atendimento
const ADMIN_ONLY = ["/", "/empresa", "/configuracoes", "/relatorios", "/kanban", "/funil", "/drive", "/agenda"];
const SDR_ALLOWED = ["/prospeccao", "/leads", "/atendimento"];
const CX_ALLOWED = ["/atendimento"];
const VENDEDOR_ALLOWED = ["/atendimento"];

const allows = (allowed: string[], path: string) =>
  allowed.some((p) => path === p || path.startsWith(p + "/"));

async function denyAccess(): Promise<never> {
  await supabase.auth.signOut();
  throw redirect({ to: "/auth" });
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }

    // Autorização 100% baseada em dados reais protegidos por RLS:
    // profile ativo + membership válida na organização. Sem exceções por e-mail.
    const [{ data: profile }, { data: memberships }, { data: rolesRows }] = await Promise.all([
      supabase.from("profiles").select("active").eq("id", data.user.id).maybeSingle(),
      supabase
        .from("organization_members")
        .select("organization_id, role, status")
        .eq("user_id", data.user.id),
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
    ]);

    if (profile && (profile as any).active === false) {
      await denyAccess();
    }

    const activeMemberships = (memberships ?? []).filter(
      (m: any) => !m.status || m.status === "active",
    );

    // Sem membership válida o usuário não entra no app.
    if (activeMemberships.length === 0) {
      await denyAccess();
    }

    const roles = Array.from(
      new Set([
        ...activeMemberships.map((m: any) => String(m.role)),
        ...(rolesRows ?? []).map((r: any) => String(r.role)),
      ]),
    ).filter(Boolean);

    const isAdmin = roles.includes("administrador");
    const isSellerOnly = !isAdmin && roles.includes("vendedor");
    const isSdrOnly = !isAdmin && !roles.includes("vendedor") && roles.includes("sdr");
    const isCxOnly =
      !isAdmin && !roles.includes("vendedor") && !roles.includes("sdr") && roles.includes("cx");
    const hasValidRole = isAdmin || isSellerOnly || isSdrOnly || isCxOnly;

    // Bloqueia usuário autenticado sem papel válido
    if (!hasValidRole) {
      await denyAccess();
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
