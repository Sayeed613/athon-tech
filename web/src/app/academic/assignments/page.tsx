"use client";

import { useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ClipboardList,
  Plus,
  RefreshCw,
  AlertCircle,
  MoreHorizontal,
  Eye,
  Trash2,
  ShieldAlert,
  UserRound,
  BookOpen,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { assignmentService } from "@/services/assignment.service";
import { teacherService } from "@/services/teacher.service";
import { classService } from "@/services/class.service";
import { subjectService } from "@/services/subject.service";
import { config } from "@/config";
import type { TeacherAssignmentItem } from "@/types/assignment";

const FETCH_LIMIT = 200;
const PAGE_SIZE = config.pagination.defaultPageSize;

export default function AssignmentsListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [selectedRows, setSelectedRows] = useState<TeacherAssignmentItem[]>([]);
  const [removeTarget, setRemoveTarget] = useState<TeacherAssignmentItem | null>(null);

  // ── Queries ─────────────────────────────────────────────────
  const assignmentsQuery = useQuery({
    queryKey: queryKeys.assignments.list({
      search,
      teacher_id: teacherFilter !== "all" ? teacherFilter : undefined,
      class_id: classFilter !== "all" ? classFilter : undefined,
      subject_id: subjectFilter !== "all" ? subjectFilter : undefined,
    }),
    queryFn: () =>
      assignmentService.list({
        search: search || undefined,
        teacher_id: teacherFilter !== "all" ? teacherFilter : undefined,
        class_id: classFilter !== "all" ? classFilter : undefined,
        subject_id: subjectFilter !== "all" ? subjectFilter : undefined,
      }),
    staleTime: 30_000,
  });

  const { data: teachersData } = useQuery({
    queryKey: queryKeys.teachers.list({ limit: 200 }),
    queryFn: () => teacherService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const { data: classesData } = useQuery({
    queryKey: queryKeys.classes.list({ limit: 200 }),
    queryFn: () => classService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const { data: subjectsData } = useQuery({
    queryKey: queryKeys.subjects.list(),
    queryFn: () => subjectService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const assignments = assignmentsQuery.data?.assignments ?? [];
  const total = assignmentsQuery.data?.total ?? 0;
  const teachers = teachersData?.teachers ?? [];
  const classes = classesData?.classes ?? [];
  const subjects = subjectsData?.subjects ?? [];

  // ── Remove Mutation ────────────────────────────────────────
  const removeMutation = useMutation({
    mutationFn: (id: string) => assignmentService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all });
      toast({ title: "Assignment removed", description: "The teacher assignment has been removed." });
      setRemoveTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    },
  });

  // ── CSV Export ──────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const headers = ["Teacher", "Employee Code", "Class", "Subject", "Term", "Academic Year", "Class Teacher"];
    const rows = assignments.map((a) => [
      a.teacher_name,
      a.teacher_code,
      a.class_name + (a.class_section ? ` - ${a.class_section}` : ""),
      a.subject_name,
      a.academic_term_name,
      a.academic_year_name,
      a.is_class_teacher ? "Yes" : "No",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assignments-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [assignments]);

  // ── Search ──────────────────────────────────────────────────
  const handleSearch = useCallback((query: string) => setSearch(query), []);

  // ── Columns ─────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<TeacherAssignmentItem>[]>(
    () => [
      {
        id: "teacher",
        header: "Teacher",
        accessorFn: (row) => row.teacher_name,
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <UserRound className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{a.teacher_name}</p>
                <p className="text-xs text-muted-foreground">{a.teacher_code}</p>
              </div>
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: "class",
        header: "Class",
        accessorFn: (row) => `${row.class_name}${row.class_section ? ` - ${row.class_section}` : ""}`,
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">
                {a.class_name}{a.class_section ? <span className="text-muted-foreground"> - {a.class_section}</span> : null}
              </span>
            </div>
          );
        },
      },
      {
        id: "subject",
        header: "Subject",
        accessorKey: "subject_name",
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm">{a.subject_name}</p>
                <p className="text-xs text-muted-foreground">{a.subject_code}</p>
              </div>
            </div>
          );
        },
      },
      {
        id: "academic_term_name",
        header: "Term",
        accessorKey: "academic_term_name",
      },
      {
        id: "is_class_teacher",
        header: "Class Teacher",
        accessorKey: "is_class_teacher",
        cell: ({ getValue }) => {
          const val = getValue<boolean>();
          return val ? (
            <Badge className="bg-primary/15 text-primary hover:bg-primary/20 text-[10px] px-1.5">Yes</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] px-1.5">No</Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const a = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => router.push(`/academic/assignments/${a.id}`)}>
                  <Eye className="mr-2 h-4 w-4" /> View Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setRemoveTarget(a)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [router]
  );

  const teacherFilterOptions = useMemo(
    () => [
      { value: "all", label: "All Teachers" },
      ...teachers.map((t) => ({
        value: t.id,
        label: `${t.first_name} ${t.last_name}`,
      })),
    ],
    [teachers]
  );

  const classFilterOptions = useMemo(
    () => [
      { value: "all", label: "All Classes" },
      ...classes.map((c) => ({
        value: c.id,
        label: c.section ? `${c.name} - ${c.section}` : c.name,
      })),
    ],
    [classes]
  );

  const subjectFilterOptions = useMemo(
    () => [
      { value: "all", label: "All Subjects" },
      ...subjects.map((s) => ({
        value: s.id,
        label: `${s.name} (${s.code})`,
      })),
    ],
    [subjects]
  );

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title="Teacher Assignments"
          description="Assign teachers to classes and subjects for each academic term."
        >
          <Button onClick={() => router.push("/academic/assignments/create")} className="gap-2">
            <Plus className="h-4 w-4" /> Create Assignment
          </Button>
        </PageHeader>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Select value={teacherFilter} onValueChange={(v) => { setTeacherFilter(v ?? "all"); setSelectedRows([]); }}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue placeholder="All Teachers" />
            </SelectTrigger>
            <SelectContent>
              {teacherFilterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={classFilter} onValueChange={(v) => { setClassFilter(v ?? "all"); setSelectedRows([]); }}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              {classFilterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={subjectFilter} onValueChange={(v) => { setSubjectFilter(v ?? "all"); setSelectedRows([]); }}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              {subjectFilterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Error Banner */}
        {assignmentsQuery.isError && !assignmentsQuery.isLoading && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="flex-1 text-destructive">
              {assignmentsQuery.error instanceof Error ? assignmentsQuery.error.message : "Failed to load assignments."}
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => assignmentsQuery.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="mt-4">
          <DataTable
            columns={columns}
            data={assignments}
            isLoading={assignmentsQuery.isLoading}
            totalCount={total}
            searchable
            searchPlaceholder="Search by teacher, class, or subject..."
            onSearch={handleSearch}
            exportable
            onExport={handleExport}
            selectable
            onSelectedRowsChange={setSelectedRows}
            pageSize={PAGE_SIZE}
          />
        </div>

        {selectedRows.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">{selectedRows.length} assignment(s) selected</p>
        )}

        {/* Remove Dialog */}
        <Dialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" /> Remove Assignment
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to remove <strong>{removeTarget?.teacher_name}</strong> from{" "}
                <strong>{removeTarget?.class_name}</strong> for <strong>{removeTarget?.subject_name}</strong>?
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-muted-foreground">
                This will also affect timetable entries linked to this assignment.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removeMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => removeTarget && removeMutation.mutate(removeTarget.id)}
                disabled={removeMutation.isPending}
              >
                {removeMutation.isPending ? "Removing..." : "Remove"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
