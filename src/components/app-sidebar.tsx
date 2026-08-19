"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  FileSignature,
  FileText,
  Kanban,
  LogOut,
  ScrollText,
  Activity,
  Cable,
  Bell,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button-variants";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const groups = [
  {
    id: "gest",
    label: "Gest",
    items: [
      { href: "/leads", label: "Leads", icon: Kanban },
      { href: "/visitas", label: "Visitas", icon: CalendarDays },
      { href: "/proposals", label: "Propostas", icon: FileText },
      { href: "/contracts", label: "Contratos", icon: FileSignature },
      { href: "/settings/templates", label: "Modelos", icon: ScrollText },
    ],
  },
  {
    id: "pulse",
    label: "Pulse",
    items: [
      { href: "/pulse/alertas", label: "Alertas", icon: Bell },
      { href: "/pulse", label: "Casas", icon: Activity },
      { href: "/integracoes", label: "Integrações", icon: Cable },
    ],
  },
] as const;

const standalone = [{ href: "/settings/company", label: "Empresa", icon: Building2 }] as const;

function linkActive(pathname: string, href: string) {
  if (href === "/pulse") {
    return pathname === "/pulse" || (pathname.startsWith("/pulse/") && !pathname.startsWith("/pulse/alertas"));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  active,
}: {
  item: { href: string; label: string; icon: typeof Kanban };
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "w-full justify-start gap-2",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4" />
      {item.label}
    </Link>
  );
}

export function AppSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="px-4 py-4">
        <Link href="/leads" className="text-sm font-semibold tracking-tight">
          Larogest
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">CRM interno</p>
      </div>
      <Separator />
      <nav className="flex flex-1 flex-col gap-4 p-2">
        {groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-1">
            <p className="px-2 pt-1 text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} active={linkActive(pathname, item.href)} />
            ))}
          </div>
        ))}
        <div className="mt-auto flex flex-col gap-1">
          {standalone.map((item) => (
            <NavLink key={item.href} item={item} active={linkActive(pathname, item.href)} />
          ))}
        </div>
      </nav>
      <Separator />
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="truncate text-xs text-muted-foreground">{userName}</span>
        <button
          type="button"
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
          onClick={async () => {
            await authClient.signOut();
            router.push("/login");
            router.refresh();
          }}
          aria-label="Sair"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );
}
