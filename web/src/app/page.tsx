import { redirect } from "next/navigation";

/**
 * Root path redirects to dashboard.
 * The AuthGuard in the layout will handle unauthenticated redirects to /login.
 */
export default function RootPage() {
  redirect("/dashboard");
}
