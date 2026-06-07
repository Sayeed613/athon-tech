"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  RefreshCw,
  AlertCircle,
  Plus,
  Trash2,
  Building2,
  UserRound,
  BookOpen,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query-keys";
import { timetableService } from "@/services/timetable.service";
import { classService } from "@/services/class.service";
import { teacherService } from "@/services/teacher.service";
import { cn } from "@/lib/utils";
import type { TimetableEntry } from "@/types/timetable";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_INDICES = [1, 2, 3, 4, 5];

type ViewMode = "class" | "teacher";

export default function TimetablePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>("class");
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [selectedTeacherId, setSelectedTeacherId] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<TimetableEntry | null>(null);

  // Fetch reference data
  const { data: classesData } = useQuery({
    queryKey: queryKeys.classes.list({ limit: 200 }),
    queryFn: () => classService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const { data: teachersData } = useQuery({
    queryKey: queryKeys.teachers.list({ limit: 200 }),
    queryFn: () => teacherService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const classes = classesData?.classes ?? [];
  const teachers = teachersData?.teachers ?? [];

  // Fetch timetable data
  const classQuery = useQuery({
    queryKey: queryKeys.timetable.byClass(selectedClassId),
    queryFn: () => timetableService.getByClass(selectedClassId),
    enabled: viewMode === "class" && !!selectedClassId && selectedClassId !== "all",
    staleTime: 30_000,
  });

  const teacherQuery = useQuery({
    queryKey: queryKeys.timetable.byTeacher(selectedTeacherId),
    queryFn: () => timetableService.getByTeacher(selectedTeacherId),
    enabled: viewMode === "teacher" && !!selectedTeacherId && selectedTeacherId !== "all",
    staleTime: 30_000,
  });

  const entries = viewMode === "class" ? (classQuery.data?.entries ?? []) : (teacherQuery.data?.entries ?? []);
  const isLoading = viewMode === "class" ? classQuery.isLoading : teacherQuery.isLoading;
  const isError = viewMode === "class" ? classQuery.isError : teacherQuery.isError;

  // Group entries by day_of_week
  const grid = useMemo(() => {
    const periodsMap = new Map<number, { id: string; name: string; number: number; start: string; end: string; is_break: boolean }>();
    const byDay = new Map<number, Map<string, TimetableEntry[]>>();

    for (const entry of entries) {
      const day = entry.day_of_week;
      if (!byDay.has(day)) byDay.set(day, new Map());
      const periodId = entry.period.id;
      const dayPeriods = byDay.get(day)!;
      if (!dayPeriods.has(periodId)) dayPeriods.set(periodId, []);
      dayPeriods.get(periodId)!.push(entry);

      if (!periodsMap.has(entry.period.period_number)) {
        periodsMap.set(entry.period.period_number, {
          id: entry.period.id,
          name: entry.period.name,
          number: entry.period.period_number,
          start: entry.period.start_time.slice(0, 5),
          end: entry.period.end_time.slice(0, 5),
          is_break: entry.period.is_break,
        });
      }
    }

    const periods = Array.from(periodsMap.values()).sort((a, b) => a.number - b.number);
    return { periods, byDay };
  }, [entries]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => timetableService.deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.all });
      toast({ title: "Entry deleted", description: "The timetable entry has been removed." });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  // Auto-select first class/teacher when switching modes
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "class" && selectedClassId === "all" && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
    if (mode === "teacher" && selectedTeacherId === "all" && teachers.length > 0) {
      setSelectedTeacherId(teachers[0].id);
    }
  }, [classes, teachers, selectedClassId, selectedTeacherId]);

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title="Timetable"
          description="Manage weekly class and teacher schedules."
        >
          <Button onClick={() => router.push("/academic/assignments")} variant="outline" size="sm" className="gap-2">
            <Building2 className="h-4 w-4" /> Manage Assignments
          </Button>
        </PageHeader>

        {/* View Mode & Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border p-0.5 bg-muted">
            <Button
              variant={viewMode === "class" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("class")}
              className="rounded-md px-3"
            >
              <Building2 className="mr-1.5 h-4 w-4" /> Class View
            </Button>
            <Button
              variant={viewMode === "teacher" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("teacher")}
              className="rounded-md px-3"
            >
              <UserRound className="mr-1.5 h-4 w-4" /> Teacher View
            </Button>
          </div>

          {viewMode === "class" ? (              <Select value={selectedClassId} onValueChange={(v: string | null) => v && setSelectedClassId(v)}>
              <SelectTrigger className="h-9 w-52">
                <SelectValue placeholder="Select class..." />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.section ? ` - ${c.section}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (              <Select value={selectedTeacherId} onValueChange={(v: string | null) => v && setSelectedTeacherId(v)}>
              <SelectTrigger className="h-9 w-52">
                <SelectValue placeholder="Select teacher..." />
              </SelectTrigger>
              <SelectContent>
                {teachers.filter((t) => t.is_active).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.first_name} {t.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="mt-6">
            <Skeleton className="h-8 w-48" />
            <div className="mt-4 grid grid-cols-5 gap-3">
              {Array.from({ length: 15 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="flex-1 text-destructive">Failed to load timetable.</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              if (viewMode === "class") classQuery.refetch();
              else teacherQuery.refetch();
            }}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        )}

        {/* Timetable Grid */}
        {!isLoading && !isError && (selectedClassId === "all" || selectedTeacherId === "all") ? (
          <EmptyState
            variant="no-data"
            title={viewMode === "class" ? "Select a class" : "Select a teacher"}
            description={`Choose a ${viewMode} from the dropdown above to view their weekly schedule.`}
          />
        ) : !isLoading && !isError && entries.length === 0 ? (
          <EmptyState
            variant="no-data"
            title="No timetable entries"
            description={`No classes scheduled for this ${viewMode}. Start by adding entries.`}
          />
        ) : !isLoading && !isError ? (
          <div className="mt-6 overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header Row */}
              <div className="grid grid-cols-[120px_repeat(5,1fr)] gap-px bg-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 p-3 text-xs font-medium text-muted-foreground">Period</div>
                {DAYS.map((day) => (
                  <div key={day} className="bg-muted/50 p-3 text-center text-xs font-semibold">{day}</div>
                ))}

                {/* Time Slots */}
                {grid.periods.map((period) => (
                  <div key={period.id} className="contents">
                    <div className={cn(
                      "bg-card p-2 text-xs border-b border-r",
                      period.is_break && "bg-muted/30"
                    )}>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-medium">{period.name}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {period.start} - {period.end}
                      </p>
                    </div>
                    {DAY_INDICES.map((day) => {
                      const dayEntries = grid.byDay.get(day)?.get(period.id) ?? [];
                      return (
                        <div
                          key={`${day}-${period.id}`}
                          className={cn(
                            "bg-card p-1.5 border-b border-r min-h-[80px]",
                            period.is_break && "bg-muted/20"
                          )}
                        >
                          {period.is_break ? (
                            <div className="flex h-full items-center justify-center">
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">Break</Badge>
                            </div>
                          ) : dayEntries.length === 0 ? (
                            <div className="flex h-full items-center justify-center">
                              <span className="text-[10px] text-muted-foreground italic">—</span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {dayEntries.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="group relative rounded-md border border-primary/20 bg-primary/5 p-1.5 hover:bg-primary/10 transition-colors cursor-pointer"
                                  onClick={() => setDeleteTarget(entry)}
                                >
                                  <div className="flex items-center gap-1">
                                    <BookOpen className="h-2.5 w-2.5 text-primary shrink-0" />
                                    <span className="text-[10px] font-medium truncate">{entry.subject.name}</span>
                                  </div>
                                  <p className="text-[9px] text-muted-foreground truncate">
                                    {viewMode === "class" ? entry.teacher.name : entry.class_.name}
                                  </p>
                                  {entry.room_number && (
                                    <p className="text-[9px] text-muted-foreground">Room {entry.room_number}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Delete Entry Dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" /> Delete Entry
              </DialogTitle>
              <DialogDescription>
                Remove {deleteTarget?.subject.name} ({deleteTarget?.teacher.name}) from{" "}
                {DAYS[(deleteTarget?.day_of_week ?? 1) - 1]} {deleteTarget?.period.name}?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
