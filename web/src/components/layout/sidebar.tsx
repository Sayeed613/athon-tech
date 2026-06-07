"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  UserRound,
  GraduationCap,
  Crown,
  BookOpen,
  Building2,
  Book,
  Calendar,
  CalendarCheck,
  ClipboardList,
  CalendarRange,
  Megaphone,
  FileBarChart,
  Bell,
  Settings,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, PRINCIPAL_NAV, TEACHER_NAV, PARENT_NAV, STUDENT_NAV, ROLES } from "@/constants";
import { useAuthStore } from "@/hooks/use-auth-store";
import { useAuth } from "@/hooks/use-auth";
import { useUIStore } from "@/hooks/use-ui-store";
import { ScrollArea } from "@/components/ui/scroll-area";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  "user-round": UserRound,
  "graduation-cap": GraduationCap,
  crown: Crown,
  "book-open": BookOpen,
  "building-2": Building2,
  book: Book,
  calendar: Calendar,
  "calendar-check": CalendarCheck,
  "clipboard-list": ClipboardList,
  "calendar-range": CalendarRange,
  megaphone: Megaphone,
  "file-bar-chart": FileBarChart,
  bell: Bell,
  settings: Settings,
};

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();
  const { sidebarOpen, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore();

  const role = user?.role;
  const isAdmin = role === ROLES.SCHOOL_ADMIN || role === ROLES.SUPER_ADMIN;
  const navItems = isAdmin
    ? ADMIN_NAV
    : role === ROLES.PRINCIPAL
    ? PRINCIPAL_NAV
    : role === ROLES.TEACHER
    ? TEACHER_NAV
    : role === ROLES.PARENT
    ? PARENT_NAV
    : role === ROLES.STUDENT
    ? STUDENT_NAV
    : PRINCIPAL_NAV;

  return (
    <>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex h-full flex-col border-r bg-sidebar transition-all duration-200 md:relative md:z-0",
          sidebarOpen ? "w-64" : "w-16",
          mobileSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Logo area */}
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b px-4",
            !sidebarOpen && "justify-center px-0",
          )}
        >
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              A
            </div>
            {sidebarOpen && (
              <span className="text-sm font-semibold">Athon</span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-2 py-4">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavItem
                key={item.label}
                item={item}
                pathname={pathname}
                collapsed={!sidebarOpen}
              />
            ))}
          </nav>
        </ScrollArea>

        {/* User footer with logout */}
        <div
          className={cn(
            "shrink-0 border-t",
            !sidebarOpen && "flex flex-col items-center px-0",
          )}
        >
          <div className={cn("flex items-center gap-3 p-3", !sidebarOpen && "justify-center px-0")}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {user?.name?.charAt(0) ?? "U"}
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground capitalize">
                  {(user?.role ?? "").replace("_", " ")}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            className={cn(
              "flex items-center gap-3 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors",
              sidebarOpen ? "mx-3 mb-3 px-3 py-2" : "mx-1 mb-2 justify-center px-2 py-2",
            )}
            title="Sign out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

function NavItem({
  item,
  pathname,
  collapsed,
}: {
  item: (typeof ADMIN_NAV)[0];
  pathname: string;
  collapsed: boolean;
}) {
  const children = item.children ?? [];
  const [open, setOpen] = useState(
    children.some((c) => pathname?.startsWith(c.href)),
  );
  const hasChildren = children.length > 0;

  // Collapsed with children: show icon with tooltip
  if (collapsed && hasChildren) {
    return (
      <div className="relative group">
        <button
          onClick={() => setOpen(!open)}
          className="flex h-9 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer"
        >
          {(function Icon() { const IconCmp = iconMap[item.icon]; return IconCmp ? <IconCmp className="h-4 w-4" /> : <span className="text-sm">•</span> })()}
        </button>
        <div className="absolute left-full ml-2 top-0 hidden group-hover:block z-50">
          <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md whitespace-nowrap">
            {item.label}
          </div>
        </div>
        {open && (
          <div className="absolute left-full ml-2 top-10 z-50 rounded-md border bg-popover p-2 shadow-md min-w-40">
            {children.map((child) => {
              const isChildActive = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    isChildActive
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {(function Icon() { const IconCmp = iconMap[child.icon]; return IconCmp ? <IconCmp className="h-4 w-4" /> : <span className="text-sm">•</span> })()}
                  <span>{child.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Collapsed without children: show icon only
  if (collapsed) {
    const isActive = pathname === item.href;
    return (
      <Link
        href={item.href}
        className={cn(
          "flex h-9 w-full items-center justify-center rounded-md transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
        title={item.label}
      >
        {(function Icon() { const IconCmp = iconMap[item.icon]; return IconCmp ? <IconCmp className="h-4 w-4" /> : <span className="text-sm">•</span> })()}
      </Link>
    );
  }

  // Expanded with children (section header with expand/collapse)
  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {(function Icon() { const IconCmp = iconMap[item.icon]; return IconCmp ? <IconCmp className="h-4 w-4 shrink-0" /> : <span className="text-sm shrink-0">•</span> })()}
          <span className="flex-1 text-left font-medium">{item.label}</span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </button>
        {open && (
          <div className="ml-8 mt-1 space-y-1">
            {children.map((child) => {
              const isChildActive = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isChildActive
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {(function Icon() { const IconCmp = iconMap[child.icon]; return IconCmp ? <IconCmp className="h-4 w-4 shrink-0" /> : <span className="text-sm shrink-0">•</span> })()}
                  <span>{child.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Expanded without children (direct link)
  const isActive = pathname === item.href;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {(function Icon() { const IconCmp = iconMap[item.icon]; return IconCmp ? <IconCmp className="h-4 w-4 shrink-0" /> : <span className="text-sm shrink-0">•</span> })()}
      <span>{item.label}</span>
    </Link>
  );
}
