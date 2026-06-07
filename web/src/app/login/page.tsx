"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/hooks/use-auth-store";
import { useAuth } from "@/hooks/use-auth";
import { useZodForm } from "@/hooks/use-zod-form";
import { z } from "zod";
import { FormProvider } from "@/components/ui/form";
import { FormInput } from "@/components/forms/form-fields";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoggingIn, loginError } = useAuth();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const form = useZodForm({
    schema: loginSchema,
    defaultValues: { email: "", password: "" },
  });

  // Already authenticated — redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  // Show a brief loading state instead of blank page while redirecting
  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Redirecting...
      </div>
    );
  }

  const onSubmit = async (data: LoginFormData) => {
    await login(data);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to Athon</CardTitle>
          <CardDescription>
            Sign in to your school management portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormProvider {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormInput
                name="email"
                label="Email"
                placeholder="admin@school.edu"
                required
                type="email"
              />

              <FormInput
                name="password"
                label="Password"
                placeholder="Enter your password"
                required
                type="password"
              />

              {/* Field-level validation errors */}
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}

              {loginError && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {loginError.message || "Invalid email or password"}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full gap-2"
                >
                  {isLoggingIn && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isLoggingIn ? "Signing in..." : "Sign In"}
                </Button>
              </div>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
    </div>
  );
}
