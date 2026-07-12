import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Search,
  Users,
  MessagesSquare,
  FileText,
  Smartphone,
  ShoppingCart,
  BarChart3,
  Settings,
  Bell,
  Search as SearchIcon,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/empresa", label: "Minha Empresa", icon: Building2 },
  { to: "/prospeccao", label: "Prospecção", icon: Search },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/atendimento", label: "Central de Atendimento", icon: MessagesSquare },
  { to: "/orcamentos", label: "Orçamentos", icon: FileText },
  { to: "/portal-vendedor", label: "Portal do Vendedor", icon: Smartphone },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/empresa": "Minha Empresa",
  "/prospeccao": "Prospecção",
  "/leads": "Leads",
  "/atendimento": "Central de Atendimento",
  "/orcamentos": "Orçamentos",
  "/portal-vendedor": "Portal do Vendedor",
  "/pedidos": "Pedidos",
  "/relatorios": "Relatórios",
  "/configuracoes": "Configurações",
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title =
    TITLES[pathname] ??
    (pathname.startsWith("/leads/") ? "Detalhe do Lead" : "WF Digital CRM");

  // Portal do Vendedor usa layout próprio (sem sidebar)
  if (pathname.startsWith("/portal-vendedor/")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full bg-bg-general">
      <aside
        className="fixed inset-y-0 left-0 flex flex-col bg-sidebar text-sidebar-foreground"
        style={{ width: 230 }}
      >
        <div className="flex h-14 items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            WF
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">WF Digital</div>
            <div className="text-[11px] text-sidebar-foreground/60">CRM</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            const badge =
              item.to === "/leads"
                ? 3
                : item.to === "/orcamentos"
                  ? 1
                  : undefined;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`mx-2 mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-border/60 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {badge ? (
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                      item.to === "/orcamentos"
                        ? "bg-error text-white"
                        : "bg-hot text-white"
                    }`}
                  >
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              F
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] text-white">Fabrício</div>
              <div className="truncate text-[11px] text-sidebar-foreground/60">
                Administrador
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1" style={{ marginLeft: 230 }}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border-card bg-bg-card px-6">
          <h1 className="text-[15px] font-semibold text-text-title">{title}</h1>

          <div className="ml-6 flex-1 max-w-md">
            <div className="flex h-9 items-center gap-2 rounded-md border border-border-card bg-bg-general px-3">
              <SearchIcon className="h-4 w-4 text-text-ter" />
              <input
                placeholder="Buscar leads, empresas, propostas..."
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-text-ter"
              />
            </div>
          </div>

          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-md text-text-sec hover:bg-bg-general"
            aria-label="Notificações"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-hot" />
          </button>

          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            F
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
