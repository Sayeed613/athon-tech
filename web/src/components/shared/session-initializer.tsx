/** Athon — Session Initializer
 *
 * Bootstrap component that runs once on mount to restore
 * the session from the persisted token. Called by RootLayout.
 */

"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/hooks/use-auth-store";
import { authService } from "@/services/auth.service";

export function SessionInitializer() {
  const { token, setUser, setSchoolContext, setLoading, logout } =
    useAuthStore();

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const restore = async () => {
      try {
        const [user, ctx] = await Promise.all([
          authService.me(),
          authService.context(),
        ]);

        if (cancelled) return;

        setUser(user);
        setSchoolContext(ctx);
        setLoading(false);
      } catch {
        if (!cancelled) {
          logout();
          setLoading(false);
        }
      }
    };

    restore();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
