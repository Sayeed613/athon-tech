"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Eye,
  MoreHorizontal,
  Pencil,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  CalendarCheck,
  Trash2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { academicService } from "@/services/academic.service";
import type { AcademicYear, AcademicTerm } from "@/types/academic";
import { cn } from "@/lib/utils";

export default function AcademicCalendarPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [expandedYear, setExpandedYear] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "year" | "term"; id: string; name: string } | null>(null);

  // ── Queries ─────────────────────────────────────────────────
  const yearsQuery = useQuery({
    queryKey: queryKeys.academicYears.list(),
    queryFn: () => academicService.listYears(),
    staleTime: 30_000,
  });

  const termsQuery = useQuery({
    queryKey: queryKeys.academicTerms.list(),
    queryFn: () => academicService.listTerms(),
    staleTime: 30_000,
  });

  const years = yearsQuery.data?.academic_years ?? [];
  const terms = termsQuery.data?.academic_terms ?? [];
  const isLoading = yearsQuery.isLoading;
  const isError = yearsQuery.isError;

  // Group terms by year
  const termsByYearId = useMemo(() => {
    const map = new Map<string, AcademicTerm[]>();
    for (const term of terms) {
      const list = map.get(term.academic_year_id) ?? [];
      list.push(term);
      map.set(term.academic_year_id, list);
    }
    return map;
  }, [terms]);

  // Toggle year expansion
  const toggleYear = useCallback((yearId: string) => {
    setExpandedYear((prev) => (prev === yearId ? null : yearId));
  }, []);

  // ── Activate Year Mutation ──────────────────────────────────
  const activateMutation = useMutation({
    mutationFn: (id: string) =>
      academicService.updateYear(id, { is_current: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academicYears.all });
      toast({ title: "Year activated", description: "The academic year is now the current year." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to activate", description: err.message, variant: "destructive" });
    },
  });

  // ── Delete Year Mutation ────────────────────────────────────
  const deleteYearMutation = useMutation({
    mutationFn: (id: string) => academicService.deleteYear(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academicYears.all });
      toast({ title: "Year deleted", description: "The academic year has been removed." });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
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

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "year") {
      deleteYearMutation.mutate(deleteTarget.id);
    } else {
      deleteTermMutation.mutate(deleteTarget.id);
    }
  };

  // ── Loading ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <AdminLayout>
        <ContentContainer>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-2 h-4 w-80" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  // ── Error ───────────────────────────────────────────────────
  if (isError) {
    return (
      <AdminLayout>
        <ContentContainer>
          <PageHeader title="Academic Calendar" description="Manage academic years and terms." />
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="mt-4 text-sm text-muted-foreground">Failed to load academic years.</p>
            <Button variant="outline" className="mt-4 gap-1.5" onClick={() => yearsQuery.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title="Academic Calendar"
          description="Manage academic years and their terms."
        >
          <Button onClick={() => router.push("/academic/years/create")} className="gap-2">
            <Plus className="h-4 w-4" /> Add Year
          </Button>
        </PageHeader>

        {years.length === 0 ? (
          <EmptyState
            variant="no-data"
            title="No academic years"
            description="Create your first academic year to get started."
            action={{ label: "Add Academic Year", onClick: () => router.push("/academic/years/create") }}
          />
        ) : (
          <div className="mt-6 space-y-4">
            {years.map((year) => {
              const yearTerms = termsByYearId.get(year.id) ?? [];
              const isExpanded = expandedYear === year.id;

              return (
                <Card key={year.id} className="overflow-hidden">
                  {/* Year Header */}
                  <div
                    className={cn(
                      "flex items-center justify-between p-4 cursor-pointer transition-colors hover:bg-accent/50",
                      year.is_current && "border-l-4 border-l-primary"
                    )}
                    onClick={() => toggleYear(year.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{year.name}</p>
                          {year.is_current && (
                            <Badge className="bg-success/15 text-success hover:bg-success/20 text-[10px] px-1.5 gap-1">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(year.start_date), "MMM d, yyyy")} — {format(parseISO(year.end_date), "MMM d, yyyy")}
                          <span className="mx-1.5">·</span>
                          {yearTerms.length} term{yearTerms.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {!year.is_current && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => activateMutation.mutate(year.id)}
                          disabled={activateMutation.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Activate
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => router.push(`/academic/years/${year.id}`)}>
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/academic/years/${year.id}/edit`)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget({ type: "year", id: year.id, name: year.name })}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Expanded Terms */}
                  {isExpanded && (
                    <>
                      <Separator />
                      <div className="p-4">
                        {yearTerms.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-4 text-center">
                            <CalendarDays className="mb-2 h-6 w-6 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">No terms defined for this year.</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 gap-1.5"
                              onClick={() => router.push(`/academic/years/${year.id}`)}
                            >
                              <Plus className="h-3.5 w-3.5" /> Add Term
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {yearTerms.map((term) => (
                              <div
                                key={term.id}
                                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent/50"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/5">
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
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => setDeleteTarget({ type: "term", id: term.id, name: term.name })}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                Delete {deleteTarget?.type === "year" ? "Academic Year" : "Term"}
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
                {deleteTarget?.type === "year" && " All associated terms will also be removed."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>
                {deleteYearMutation.isPending || deleteTermMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
