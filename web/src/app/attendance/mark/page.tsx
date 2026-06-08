"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  Save,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { useUserRole } from "@/hooks/use-auth";
import { useAuthStore } from "@/hooks/use-auth-store";
import { timetableService } from "@/services/timetable.service";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { attendanceService } from "@/services/attendance.service";
import { classService } from "@/services/class.service";
import { studentService } from "@/services/student.service";
import { academicService } from "@/services/academic.service";
import { cn } from "@/lib/utils";
import type { BatchAttendanceItem } from "@/types/attendance";

// ── Mobile-friendly tap-to-cycle status implementation ─────────

const STATUS_CYCLE = ['present', 'absent', 'late', 'half_day'] as const;

type CycleStatus = typeof STATUS_CYCLE[number];

const STATUS_CONFIG: Record<CycleStatus, { label: string; fullLabel: string; className: string }> = {
  present: { label: 'P', fullLabel: 'Present', className: 'bg-green-100 text-green-700 border-green-300' },
  absent:  { label: 'A', fullLabel: 'Absent',  className: 'bg-red-100 text-red-700 border-red-300' },
  late:    { label: 'L', fullLabel: 'Late',    className: 'bg-amber-100 text-amber-700 border-amber-300' },
  half_day:{ label: 'H', fullLabel: 'Half Day',className: 'bg-orange-100 text-orange-700 border-orange-300' },
};

function cycleStatus(current: string): string {
  const idx = STATUS_CYCLE.indexOf(current as CycleStatus);
  if (idx === -1 || idx === STATUS_CYCLE.length - 1) return STATUS_CYCLE[0];
  return STATUS_CYCLE[idx + 1];
}

const STATUS_OPTIONS = [
  { value: "present", label: "Present", color: "text-green-600 bg-green-50" },
  { value: "absent", label: "Absent", color: "text-red-600 bg-red-50" },
  { value: "late", label: "Late", color: "text-amber-600 bg-amber-50" },
  { value: "half_day", label: "Half Day", color: "text-orange-600 bg-orange-50" },
] as const;

export default function MarkAttendancePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useUserRole();
  const { toast } = useToast();

  // Only teachers can mark attendance — redirect in useEffect to avoid React warning
  useEffect(() => {
    if (!role.isTeacher) {
      router.replace("/attendance");
    }
  }, [role.isTeacher, router]);

  if (!role.isTeacher) return null;
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [date, setDate] = useState(today);
  const [studentStatuses, setStudentStatuses] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch reference data
  const { data: classesData } = useQuery({
    queryKey: queryKeys.classes.list({ limit: 200 }),
    queryFn: () => classService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  // For teachers: fetch timetable to get assigned classes
  const user = useAuthStore((s) => s.user);
  const { data: timetableData } = useQuery({
    queryKey: queryKeys.timetable.byTeacher(user?.id ?? ''),
    queryFn: () => timetableService.getByTeacher(user?.id ?? ''),
    enabled: role.isTeacher && !!user?.id,
    staleTime: 60_000,
  });

  const { data: termsData } = useQuery({
    queryKey: queryKeys.academicTerms.list(),
    queryFn: () => academicService.listTerms(),
    staleTime: 60_000,
  });

  const classes = classesData?.classes ?? [];

  // Filter to teacher's assigned classes based on timetable
  const assignedClassIds = useMemo(() => {
    if (!role.isTeacher || !timetableData?.entries) return null;
    return new Set(timetableData.entries.map((e: { class_id: string }) => e.class_id));
  }, [role.isTeacher, timetableData]);

  const visibleClasses = useMemo(() => {
    if (!assignedClassIds) return classes; // admin sees all
    return classes.filter((c) => assignedClassIds.has(c.id));
  }, [classes, assignedClassIds]);
  const terms = termsData?.academic_terms ?? [];
  const currentTermId = terms.find((t) => t.is_current)?.id ?? terms[0]?.id ?? "";

  // Fetch students for the selected class
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: queryKeys.students.list({ class_id: selectedClassId, limit: 100 }),
    queryFn: () => studentService.list({ class_id: selectedClassId, limit: 100 }),
    enabled: !!selectedClassId,
    staleTime: 30_000,
  });

  const students = studentsData?.students ?? [];

  // Initialize statuses when class changes
  const initStatuses = useCallback(() => {
    const statuses: Record<string, string> = {};
    students.forEach((s) => { statuses[s.id] = "present"; });
    setStudentStatuses(statuses);
  }, [students]);

  // Auto-init on class select
  useEffect(() => {
    if (selectedClassId && students.length > 0) {
      initStatuses();
    }
  }, [selectedClassId, students.length, initStatuses]);

  const batchMutation = useMutation({
    mutationFn: (records: BatchAttendanceItem[]) =>
      attendanceService.batchMark({
        class_id: selectedClassId,
        academic_term_id: currentTermId,
        date,
        records,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
      toast({ title: "Attendance marked", description: `Records saved for ${date}.` });
      setShowConfirm(false);
      router.push("/attendance");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const setAllStatus = (status: string) => {
    const updated: Record<string, string> = {};
    students.forEach((s) => { updated[s.id] = status; });
    setStudentStatuses(updated);
  };

  const setStudentStatus = (studentId: string, status: string) => {
    setStudentStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const records: BatchAttendanceItem[] = students
    .filter((s) => studentStatuses[s.id])
    .map((s) => ({
      student_id: s.id,
      status: studentStatuses[s.id] as BatchAttendanceItem["status"],
      remarks: undefined,
    }));

  const pendingCount = records.length;
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title="Mark Attendance"
          description="Batch mark attendance for a class."
        >
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push("/attendance")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </PageHeader>

        {/* Class & Date Selection */}
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Class</label>
            <Select value={selectedClassId} onValueChange={(v: string | null) => v && setSelectedClassId(v)}>
              <SelectTrigger className="h-9 w-52">
                <SelectValue placeholder="Select class..." />
              </SelectTrigger>
              <SelectContent>
                {visibleClasses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.section ? ` - ${c.section}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          {students.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">Set all:</span>
              {STATUS_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setAllStatus(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Student List */}
        {!selectedClassId ? (
          <EmptyState
            variant="no-data"
            title="Select a class"
            description="Choose a class to start marking attendance."
          />
        ) : studentsLoading ? (
          <div className="mt-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <EmptyState
            variant="no-data"
            title="No students"
            description="This class has no enrolled students."
          />
        ) : (
          <div className="mt-6 space-y-2">
            {students.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {student.first_name?.[0]}{student.last_name?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {student.first_name} {student.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {student.admission_number}
                    </p>
                  </div>
                </div>
                {/* Mobile-friendly tap-to-cycle status badge */}
                <button
                  onClick={() => setStudentStatus(student.id, cycleStatus(studentStatuses[student.id] ?? 'present'))}
                  className={cn(
                    "flex h-10 w-20 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold transition-all touch-manipulation select-none",
                    STATUS_CONFIG[(studentStatuses[student.id] ?? 'present') as CycleStatus]?.className ?? ''
                  )}
                >
                  {STATUS_CONFIG[(studentStatuses[student.id] ?? 'present') as CycleStatus]?.fullLabel ?? 'Present'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Summary & Submit */}
        {students.length > 0 && (
          <>
            {/* Summary bar */}
            <div className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/10 px-4 py-3 text-sm">
              <span className="font-medium text-muted-foreground mr-1">Summary:</span>
              <span className="font-semibold text-green-600">
                {Object.values(studentStatuses).filter((s) => s === "present").length} P
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="font-semibold text-red-600">
                {Object.values(studentStatuses).filter((s) => s === "absent").length} A
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="font-semibold text-amber-600">
                {Object.values(studentStatuses).filter((s) => s === "late").length} L
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="font-semibold text-orange-600">
                {Object.values(studentStatuses).filter((s) => s === "half_day").length} H
              </span>
            </div>

            {/* Submit */}
            <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{pendingCount}</span> students ready to mark
                {selectedClass && <span> for <strong>{selectedClass.name}</strong></span>}
              </p>
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={batchMutation.isPending || pendingCount === 0}
                className="gap-2"
              >
                {batchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {batchMutation.isPending ? "Saving..." : `Save Attendance (${pendingCount})`}
              </Button>
            </div>
          </>
        )}

        {/* Confirm Dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Attendance</DialogTitle>
              <DialogDescription>
                Mark {pendingCount} students for {selectedClass?.name} on {date}.
                {records.filter((r) => r.status !== "present").length > 0 && (
                  <span className="block mt-1 text-amber-600">
                    Note: {records.filter((r) => r.status !== "present").length} students marked as not present.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={batchMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={() => batchMutation.mutate(records)}
                disabled={batchMutation.isPending}
                className="gap-2"
              >
                {batchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
