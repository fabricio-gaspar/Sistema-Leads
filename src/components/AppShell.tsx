import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Building2,
  Search,
  Users,
  MessagesSquare,
  FileText,
  BarChart3,
  Settings,
  Bell,
  Search as SearchIcon,
  Moon,
  Sun,
  Bot,
  LogOut,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSidebarCounts, globalSearch } from "@/lib/crm.functions";
import { useTheme, themeStore, hydrateTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/empresa", label: "Empresa", icon: Building2 },
  { to: "/prospeccao", label: "Busca de Leads", icon: Search },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/atendimento", label: "Central de Atendimento", icon: MessagesSquare },
  { to: "/kanban", label: "Kanban", icon: FileText },
  { to: "/funil", label: "Funil", icon: BarChart3 },
  { to: "/drive", label: "Midia Drive", icon: FileText },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/agenda", label: "Agenda", icon: Settings },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AppShell({
  children,
  isAdmin = false,
  isSellerOnly = false,
  isSdrOnly = false,
  isCxOnly = false,
}: {
  children: ReactNode;
  isAdmin?: boolean;
  isSellerOnly?: boolean;
  isSdrOnly?: boolean;
  isCxOnly?: boolean;
  roles?: string[];
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const visibleNav = NAV.filter((item) => {
    if (isAdmin) return true;
    if (isSellerOnly || isCxOnly) return item.to === "/atendimento";
    if (isSdrOnly) return ["/prospeccao", "/leads", "/atendimento"].includes(item.to as string);
    return false;
  });

  const theme = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifications = useNotifications();
  const unread = notifications.filter((n) => !n.read).length;

  const countsFn = useServerFn(getSidebarCounts);
  const { data: counts } = useQuery({
    queryKey: ["sidebar-counts"],
    queryFn: () => countsFn(),
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  const searchFn = useServerFn(globalSearch);
  const [searchQ, setSearchQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { data: searchRes } = useQuery({
    queryKey: ["global-search", searchQ],
    queryFn: () => searchFn({ data: { q: searchQ } }),
    enabled: isAdmin && searchQ.trim().length >= 2,
  });

  useEffect(() => {
    hydrateTheme();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-bg-general">
      <aside className="fixed inset-y-0 left-0 flex flex-col bg-sidebar text-sidebar-foreground" style={{ width: 230 }}>
        <div className="flex h-14 items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">WF</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">LeadAI</div>
            <div className="text-[11px] text-sidebar-foreground/60">CRM</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {visibleNav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            const badge = item.to === "/leads" ? counts?.leads : undefined;
            return (
              <Link
                key={item.to}
                to={item.to as any}
                className={`mx-2 mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-border/60 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {badge && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold bg-hot text-white">{badge}</span>}
              </Link>
            );
          })}
        </nav>
        <UserPanel />
      </aside>

      <div className="flex-1" style={{ marginLeft: 230 }}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border-card bg-bg-card px-6">
          <div className="flex-1 max-w-md relative" ref={searchRef}>
            <div className="flex h-9 items-center gap-2 rounded-md border border-border-card bg-bg-general px-3">
              <SearchIcon className="h-4 w-4 text-text-ter" />
              <input
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Buscar leads, orçamentos..."
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-text-ter"
              />
            </div>
            {searchOpen && searchQ.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-11 z-40 max-h-[420px] overflow-y-auto rounded-lg border border-border-card bg-bg-card shadow-xl">
                <SearchResults res={searchRes} onPick={() => { setSearchOpen(false); setSearchQ(""); }} />
              </div>
            )}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-ia-bg px-3 py-1 text-[11px] font-medium text-ia">
              <span className="h-1.5 w-1.5 rounded-full bg-ia animate-pulse" />
              Ana está online
            </div>
            <button onClick={() => themeStore.toggle()} className="flex h-9 w-9 items-center justify-center rounded-md text-text-sec hover:bg-bg-general">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">F</div>
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
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? "");
        setName((data.user.user_metadata?.name as string) ?? data.user.email?.split("@")[0] ?? "Usuário");
      }
    });
  }, []);
  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
          {(name || email || "U")[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] text-white">{name}</div>
          <div className="truncate text-[11px] text-sidebar-foreground/60">{email}</div>
        </div>
        <button onClick={handleSignOut} className="text-sidebar-foreground/60 hover:text-white"><LogOut className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function SearchResults({ res, onPick }: { res: any; onPick: () => void }) {
  if (!res) return <div className="p-4 text-[12px] text-text-ter">Buscando…</div>;
  return (
    <div className="py-2">
      {res.leads.map((l: any) => (
        <Link key={l.id} to="/leads/$id" params={{ id: l.id }} onClick={onPick} className="block px-4 py-2 hover:bg-bg-general text-[13px]">
          {l.company}
        </Link>
      ))}
    </div>
  );
}
