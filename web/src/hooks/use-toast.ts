/** Athon — Toast Hook
 *
 * Thin wrapper around sonner for consistent toast API
 * across the application. Follows the shadcn/ui pattern.
 */

import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive" | "success";

interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

export function useToast() {
  const toast = ({ title, description, variant = "default", duration }: ToastOptions) => {
    const message = description ? `${title}: ${description}` : title;

    switch (variant) {
      case "destructive":
        sonnerToast.error(title, {
          description,
          duration,
        });
        break;
      case "success":
        sonnerToast.success(title, {
          description,
          duration,
        });
        break;
      default:
        sonnerToast(title, {
          description,
          duration,
        });
    }
  };

  return { toast };
}
