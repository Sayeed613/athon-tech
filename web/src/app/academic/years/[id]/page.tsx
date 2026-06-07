"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Calendar,
  CalendarCheck,
  Plus,
  ShieldAlert,
  RefreshCw,
  AlertCircle,
  Trash2,
  Loader2,
  Check,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FormInput } from "@/components/forms/form-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { academicService } from "@/services/academic.service";
import type { AcademicTerm } from "@/types/academic";

// ── Term Creation Schema ──────────────────────────────────────
const createTermSchema = z.object({
  name: z.string().min(1, "Term name is required").max(50),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
});

type CreateTermFormData = z.infer<typeof createTermSchema>;

export default function AcademicYearDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const yearId = params?.id as string;
  const [deleteTarget, setDeleteTarget] = useState<AcademicTerm | null>(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  // ── Queries ─────────────────────────────────────────────────
  const yearQuery = useQuery({
    queryKey: queryKeys.academicYears.detail(yearId),
    queryFn: () => academicService.getYear(yearId),
    enabled: !!yearId,
    staleTime: 30_000,
  });

  const termsQuery = useQuery({
    queryKey: queryKeys.academicTerms.list({ academic_year_id: yearId }),
    queryFn: () => academicService.listTerms(yearId),
    enabled: !!yearId,
    staleTime: 30_000,
  });

  const year = yearQuery.data ?? null;
  const terms = termsQuery.data?.academic_terms ?? [];
  const isLoading = yearQuery.isLoading || termsQuery.isLoading;

  // ── Create Term Form ────────────────────────────────────────
  const termForm = useForm<CreateTermFormData>({
    resolver: zodResolver(createTermSchema),
    defaultValues: { name: "", start_date: "", end_date: "" },
    mode: "onBlur",
  });

  const { reset: resetTermForm } = termForm;

  const createTermMutation = useMutation({
    mutationFn: (data: CreateTermFormData) =>
      academicService.createTerm({
        academic_year_id: yearId,
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academicTerms.all });
      toast({ title: "Term created", description: "The term has been added.", variant: "success" });
      setShowCreateSheet(false);
      resetTermForm({ name: "", start_date: "", end_date: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create term", description: err.message, variant: "destructive" });
    },
  });

  // ── Delete Term Mutation ────────────────────────────────────
  const deleteTermMutation = useMutation({
    mutationFn: (id: string) => academicService.deleteTerm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academicTerms.all });
      toast({ title: "Term deleted", description: "The term has been removed." });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  // ── Loading ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <AdminLayout>
        <ContentContainer>
          <Skeleton className="h-6 w-48" />
          <div className="mt-6 space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  // ── Error ───────────────────────────────────────────────────
  if (!year) {
    return (
      <AdminLayout>
        <ContentContainer>
          <PageHeader title="Year not found" description="The academic year could not be loaded." />
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="mt-4 text-sm text-muted-foreground">Academic year not found.</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
            </Button>
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ContentContainer>
        <Link
          href="/academic/years"
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Academic Calendar
        </Link>

        {/* Year Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{year.name}</h1>
                {year.is_current && (
                  <Badge className="bg-success/15 text-success hover:bg-success/20 gap-1">
                    <Check className="h-3 w-3" /> Current
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {format(parseISO(year.start_date), "MMM d, yyyy")} — {format(parseISO(year.end_date), "MMM d, yyyy")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/academic/years/${year.id}/edit`)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Terms Section */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  Academic Terms
                </CardTitle>
                <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
                  <SheetTrigger>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Add Term
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Add Term</SheetTitle>
                      <SheetDescription>
                        Create a new term for {year.name}.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6">
                      <FormProvider {...termForm}>
                        <form
                          onSubmit={termForm.handleSubmit((data) => createTermMutation.mutate(data))}
                          className="space-y-5"
                        >
                          <FormInput<CreateTermFormData>
                            name="name"
                            label="Term Name"
                            placeholder="e.g., Term 1"
                            required
                          />
                          <FormInput<CreateTermFormData>
                            name="start_date"
                            label="Start Date"
                            type="date"
                            required
                          />
                          <FormInput<CreateTermFormData>
                            name="end_date"
                            label="End Date"
                            type="date"
                            required
                          />
                          <Button
                            type="submit"
                            className="w-full gap-2"
                            disabled={createTermMutation.isPending}
                          >
                            {createTermMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                            {createTermMutation.isPending ? "Creating..." : "Create Term"}
                          </Button>
                        </form>
                      </FormProvider>
                    </div>
                  </SheetContent>
                </Sheet>
              </CardHeader>
              <CardContent>
                {terms.length === 0 ? (
                  <EmptyState
                    variant="no-data"
                    title="No terms defined"
                    description="Add terms to this academic year."
                    action={{ label: "Add Term", onClick: () => setShowCreateSheet(true) }}
                  />
                ) : (
                  <div className="space-y-3">
                    {terms.map((term) => (
                      <div
                        key={term.id}
                        className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <CalendarCheck className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{term.name}</p>
                              {term.is_current && (
                                <Badge className="bg-success/15 text-success hover:bg-success/20 text-[10px] px-1.5">
                                  Current
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(term.start_date), "MMM d")} — {format(parseISO(term.end_date), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(term)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Year Metadata */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Year Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="text-sm font-medium">{format(parseISO(year.start_date), "MMMM d, yyyy")}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">End Date</p>
                  <p className="text-sm font-medium">{format(parseISO(year.end_date), "MMMM d, yyyy")}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm font-medium">{year.is_current ? "Current Year" : "Inactive"}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Terms</p>
                  <p className="text-sm font-medium">{terms.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => router.push(`/academic/years/${year.id}/edit`)}
                >
                  <Pencil className="h-4 w-4" /> Edit Year
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setShowCreateSheet(true)}
                >
                  <Plus className="h-4 w-4" /> Add Term
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Delete Term Dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" /> Delete Term
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteTarget && deleteTermMutation.mutate(deleteTarget.id)}
                disabled={deleteTermMutation.isPending}
              >
                {deleteTermMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
