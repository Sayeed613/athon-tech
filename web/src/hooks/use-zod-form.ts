"use client";

import { useForm, type UseFormProps, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodSchema, z } from "zod";

/**
 * Use a Zod-validated form with full type inference.
 *
 * @example
 * const formSchema = z.object({ email: z.string().email() });
 * const form = useZodForm({ schema: formSchema, defaultValues: { email: "" } });
 * // `form.handleSubmit` is typed to the inferred schema type
 */
export function useZodForm<T extends Record<string, unknown> = any>({
  schema,
  defaultValues,
  mode = "onBlur",
  ...props
}: {
  schema: ZodSchema<T>;
  defaultValues?: T;
  mode?: UseFormProps<T>["mode"];
} & Omit<UseFormProps<T>, "resolver" | "defaultValues" | "mode">): UseFormReturn<T> {
  return useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as any,
    mode,
    ...(props as any),
  });
}
