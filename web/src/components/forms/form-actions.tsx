"use client";

import { useFormContext, type FieldValues, type SubmitHandler } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FormActionsProps<T extends FieldValues> {
  onSubmit: SubmitHandler<T>;
  isPending?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  className?: string;
}

/**
 * Standard form submit/cancel action bar.
 * Must be used inside a <form> with <FormProvider>.
 */
export function FormActions<T extends FieldValues>({
  onSubmit,
  isPending = false,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  onCancel,
  className,
}: FormActionsProps<T>) {
  const { handleSubmit } = useFormContext<T>();

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 border-t pt-4",
        className,
      )}
    >
      {onCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          {cancelLabel}
        </Button>
      )}
      <Button
        type="submit"
        onClick={handleSubmit(onSubmit)}
        disabled={isPending}
        className="gap-2"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );
}
