"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "./use-auth-store";
import { authService } from "@/services/auth.service";
import type { LoginRequest } from "@/types/auth";

/**
 * Primary auth hook for login/logout and session state.
 */
export function useAuth() {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading, login, logout, setLoading } =
    useAuthStore();

  /** POST /auth/login → on success persist token + user */
  const loginMutation = useMutation({
    mutationFn: (payload: LoginRequest) => authService.login(payload),
    onSuccess: (response) => {
      login(response.access_token, response.user);
      router.push("/dashboard");
    },
  });

  /** Clear session and redirect to login */
  const handleLogout = useCallback(() => {
    logout();
    router.push("/login");
  }, [logout, router]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    logout: handleLogout,
  };
}

/**
 * Quick check: is the current user a specific role?
 */
export function useUserRole() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin";
  const isPrincipal = user?.role === "principal";
  const isTeacher = user?.role === "teacher";
  const isStudent = user?.role === "student";
  const isParent = user?.role === "parent";

  return {
    role: user?.role ?? null,
    isAdmin,
    isPrincipal,
    isTeacher,
    isStudent,
    isParent,
  };
}
