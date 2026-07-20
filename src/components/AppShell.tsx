import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Building2,
  Search,
  Users,
  MessagesSquare,
  FileText,
  ShoppingCart,
  BarChart3,
  Settings,
  ShieldAlert,
  Bell,
  Search as SearchIcon,
  Moon,
  Sun,
  Bot,
  Sparkles,
  CheckCheck,
  LogOut,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNotifications, useNotificationsActions } from "@/hooks/use-notifications";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSidebarCounts, globalSearch } from "@/lib/crm.functions";
import { useTheme, themeStore, hydrateTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/empresa", label: "Minha Empresa", icon: Building2 },
  { to: "/prospeccao", label: "Prospecção", icon: Search },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/atendimento", label: "Central de Atendimento", icon: MessagesSquare },
  { to: "/orcamentos", label: "Orçamentos", icon: FileText },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/diagnostico", label: "Diagnóstico", icon: ShieldAlert },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/empresa": "Minha Empresa",
  "/prospeccao": "Prospecção",
  "/leads": "Leads",
  "/atendimento": "Central de Atendimento",
  "/orcamentos": "Orçamentos",
  "/pedidos": "Pedidos",
  "/relatorios": "Relatórios",
  "/diagnostico": "Diagnóstico de dados",
  "/configuracoes": "Configurações",
};

const NOTIF_ICONS = {
  ana: Bot,
  lead: Users,
  orcamento: FileText,
  pedido: ShoppingCart,
  sistema: Sparkles,
} as const;

export function AppShell({
  children,
  isSellerOnly = false,
  isAdmin = false,
}: {
  children: ReactNode;
  isSellerOnly?: boolean;
  isAdmin?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title =
    TITLES[pathname] ??
    (pathname.startsWith("/leads/") ? "Detalhe do Lead" : "WF Digital CRM");

  // Vendedor puro vê somente a Central. Outros perfis seguem a matriz padrão.
  const visibleNav = NAV.filter((item) => {
    if (isSellerOnly) return item.to === "/atendimento";
    if (isAdmin) return true;
    const adminOnly = ["/empresa", "/configuracoes", "/diagnostico", "/relatorios"];
    return !adminOnly.includes(item.to);
  });

  const notifications = useNotifications();
  const notifActions = useNotificationsActions();
  const unread = notifications.filter((n) => !n.read).length;
  const theme = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const countsFn = useServerFn(getSidebarCounts);
  const { data: counts } = useQuery({
    queryKey: ["sidebar-counts"],
    queryFn: () => countsFn(),
    enabled: !isSellerOnly,
    refetchInterval: 60_000,
  });

  const searchFn = useServerFn(globalSearch);
  const [searchQ, setSearchQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { data: searchRes } = useQuery({
    queryKey: ["global-search", searchQ],
    queryFn: () => searchFn({ data: { q: searchQ } }),
    enabled: !isSellerOnly && searchQ.trim().length >= 2,
  });

  useEffect(() => {
    hydrateTheme();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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
          {visibleNav.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            const badge =
              item.to === "/leads"
                ? counts?.leads
                : item.to === "/orcamentos"
                  ? counts?.proposals
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
                      item.to === "/orcamentos" ? "bg-error text-white" : "bg-hot text-white"
                    }`}
                  >
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <UserPanel />
      </aside>

      <div className="flex-1" style={{ marginLeft: 230 }}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border-card bg-bg-card px-6">
          <h1 className="text-[15px] font-semibold text-text-title">{title}</h1>

          {!isSellerOnly && <div className="ml-6 flex-1 max-w-md relative" ref={searchRef}>
            <div className="flex h-9 items-center gap-2 rounded-md border border-border-card bg-bg-general px-3">
              <SearchIcon className="h-4 w-4 text-text-ter" />
              <input
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Buscar leads, empresas, propostas..."
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-text-ter"
              />
              {searchQ && (
                <button
                  onClick={() => {
                    setSearchQ("");
                    setSearchOpen(false);
                  }}
                  className="text-[11px] text-text-ter hover:text-text-body"
                >
                  ×
                </button>
              )}
            </div>
            {searchOpen && searchQ.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-11 z-40 max-h-[420px] overflow-y-auto rounded-lg border border-border-card bg-bg-card shadow-xl">
                <SearchResults
                  res={searchRes}
                  onPick={() => {
                    setSearchOpen(false);
                    setSearchQ("");
                  }}
                />
              </div>
            )}
          </div>}

          {isSellerOnly && <div className="flex-1" />}

          <button
            onClick={() => themeStore.toggle()}
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-sec hover:bg-bg-general"
            aria-label="Alternar tema"
            title={theme === "dark" ? "Tema claro" : "Tema escuro"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {!isSellerOnly && <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative flex h-9 w-9 items-center justify-center rounded-md text-text-sec hover:bg-bg-general"
              aria-label="Notificações"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-hot px-1 text-[9px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-11 z-40 w-[360px] overflow-hidden rounded-lg border border-border-card bg-bg-card shadow-xl">
                <div className="flex items-center justify-between border-b border-border-card px-3 py-2.5">
                  <div className="text-[13px] font-semibold text-text-title">Notificações</div>
                  <button
                    onClick={() => notifActions.markAllRead()}
                    className="inline-flex items-center gap-1 text-[11px] text-text-sec hover:text-primary"
                  >
                    <CheckCheck className="h-3 w-3" /> Marcar tudo como lido
                  </button>
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                  {notifications.length === 0 && (
                    <div className="p-6 text-center text-[12px] text-text-ter">
                      Nenhuma notificação
                    </div>
                  )}
                  {notifications.map((n) => {
                    const Icon = NOTIF_ICONS[n.kind];
                    return (
                      <div
                        key={n.id}
                        className={`flex gap-2.5 border-b border-border-card px-3 py-2.5 last:border-b-0 ${
                          n.read ? "opacity-60" : ""
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            n.kind === "ana"
                              ? "bg-ia-bg text-ia"
                              : n.kind === "orcamento"
                                ? "bg-warm-bg text-warm"
                                : n.kind === "pedido"
                                  ? "bg-success-bg text-success"
                                  : n.kind === "lead"
                                    ? "bg-error-bg text-error"
                                    : "bg-bg-general text-text-sec"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="truncate text-[12px] font-semibold text-text-title">
                              {n.title}
                            </div>
                            <div className="shrink-0 text-[10px] text-text-ter">{n.at}</div>
                          </div>
                          <div className="mt-0.5 text-[11px] leading-snug text-text-sec">
                            {n.desc}
                          </div>
                        </div>
                        {!n.read && (
                          <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>}

          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            F
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

function UserPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? "");
        setName(
          (data.user.user_metadata?.name as string | undefined) ??
            data.user.email?.split("@")[0] ??
            "Usuário",
        );
      }
    });
  }, []);

  async function handleSignOut() {
    if (pending) return;
    setPending(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } finally {
      setPending(false);
    }
  }

  const initial = (name || email || "U").charAt(0).toUpperCase();

  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
          {initial}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] text-white">{name || "Carregando..."}</div>
          <div className="truncate text-[11px] text-sidebar-foreground/60">{email}</div>
        </div>
        <button
          onClick={handleSignOut}
          disabled={pending}
          title="Sair"
          className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-border hover:text-white disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

type SearchResData = {
  leads: Array<{ id: string; company: string; contact: string | null; email: string | null }>;
  proposals: Array<{ id: string; number: string; client: string }>;
  orders: Array<{ id: string; number: string; company: string }>;
};

function SearchResults({ res, onPick }: { res: SearchResData | undefined; onPick: () => void }) {
  if (!res) {
    return <div className="p-4 text-[12px] text-text-ter">Buscando…</div>;
  }
  const empty =
    res.leads.length === 0 && res.proposals.length === 0 && res.orders.length === 0;
  if (empty) {
    return <div className="p-4 text-[12px] text-text-ter">Nenhum resultado.</div>;
  }
  return (
    <div className="py-1">
      {res.leads.length > 0 && (
        <div className="px-3 pt-2 pb-1 text-[10px] uppercase text-text-ter">Leads</div>
      )}
      {res.leads.map((l) => (
        <Link
          key={l.id}
          to="/leads/$id"
          params={{ id: l.id }}
          onClick={onPick}
          className="flex items-center justify-between px-3 py-2 text-[12.5px] hover:bg-bg-general"
        >
          <span className="truncate font-medium text-text-title">{l.company}</span>
          <span className="ml-2 truncate text-[11px] text-text-ter">
            {l.contact ?? l.email ?? ""}
          </span>
        </Link>
      ))}
      {res.proposals.length > 0 && (
        <div className="px-3 pt-2 pb-1 text-[10px] uppercase text-text-ter">Orçamentos</div>
      )}
      {res.proposals.map((p) => (
        <Link
          key={p.id}
          to="/orcamentos"
          onClick={onPick}
          className="flex items-center justify-between px-3 py-2 text-[12.5px] hover:bg-bg-general"
        >
          <span className="font-mono text-[11px] text-text-sec">{p.number}</span>
          <span className="ml-2 truncate text-text-title">{p.client}</span>
        </Link>
      ))}
      {res.orders.length > 0 && (
        <div className="px-3 pt-2 pb-1 text-[10px] uppercase text-text-ter">Pedidos</div>
      )}
      {res.orders.map((o) => (
        <Link
          key={o.id}
          to="/pedidos"
          onClick={onPick}
          className="flex items-center justify-between px-3 py-2 text-[12.5px] hover:bg-bg-general"
        >
          <span className="font-mono text-[11px] text-text-sec">{o.number}</span>
          <span className="ml-2 truncate text-text-title">{o.company}</span>
        </Link>
      ))}
    </div>
  );
}
