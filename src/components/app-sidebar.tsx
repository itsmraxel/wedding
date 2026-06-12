"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gem,
  Home,
  Map,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/guests", label: "Guests", icon: Users },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/guest-guide", label: "Guest guide", icon: Map },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "sticky top-0 h-screen shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-12" : "w-56"
      )}
    >
      <div className="flex h-full flex-col px-2 py-3">
        <div
          className={cn(
            "mb-4 flex items-center gap-2 px-2",
            collapsed && "justify-center px-0"
          )}
        >
          <Gem className="size-4 text-sidebar-foreground" strokeWidth={1.5} />
          {!collapsed && (
            <span className="truncate text-sm font-medium text-sidebar-accent-foreground">
              Our Wedding
            </span>
          )}
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-light text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
                  active &&
                    "bg-sidebar-accent font-normal text-sidebar-accent-foreground",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon className="size-4" strokeWidth={1.5} />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "mt-auto flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-light text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" strokeWidth={1.5} />
          ) : (
            <>
              <PanelLeftClose className="size-4" strokeWidth={1.5} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
