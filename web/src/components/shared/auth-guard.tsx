"use client";

import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/hooks/use-auth-store";
import { PUBLIC_ROUTES, ROUTE_ROLES } from "@/constants";
import { useUIStore } from "@/hooks/use-ui-store";

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Client-side auth guard with prefix-based route matching.
 *
 * Matching strategy (in order of precedence):
 * 1. Exact match — pathname equals a ROUTE_ROLES key
 * 2. Longest prefix match — pathname starts with a ROUTE_ROLES key
 * 3. No match — access granted (public or unrecognised route)
 *
 * This ensures dynamic routes like /homework/abc-123 inherit the
 * roles of /homework, and more specific routes like /homework/create
 * (teacher-only) take precedence over the broader /homework (all roles).
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const setGlobalLoading = useUIStore((s) => s.setGlobalLoading);

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname?.startsWith(route),
  );

  // Route keys sorted by length descending — longest match wins
  const sortedRouteKeys = useMemo(
    () => Object.keys(ROUTE_ROLES).sort((a, b) => b.length - a.length),
    [],
  );

  const checkAccess = useCallback((): boolean => {
    if (isPublicRoute) return true;
    if (!isAuthenticated || !user) return false;

    const currentPath = pathname ?? "";

    // 1. Exact match first
    let allowedRoles = ROUTE_ROLES[currentPath];

    // 2. Longest prefix match
    if (!allowedRoles) {
      for (const key of sortedRouteKeys) {
        if (currentPath.startsWith(key)) {
          allowedRoles = ROUTE_ROLES[key];
          break;
        }
      }
    }

    // 3. No match at all — grant access (fallback for unknown routes)
    if (!allowedRoles) return true;

    return allowedRoles.includes(user.role);
  }, [isAuthenticated, isPublicRoute, pathname, user, sortedRouteKeys]);

  const hasAccess = checkAccess();

  useEffect(() => {
    if (isLoading) {
      setGlobalLoading(true);
      return;
    }

    setGlobalLoading(false);

    if (isPublicRoute) return;

    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }

    if (!hasAccess) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, isPublicRoute, pathname, user, hasAccess, router, setGlobalLoading]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated && !isPublicRoute) {
    return null;
  }

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}
