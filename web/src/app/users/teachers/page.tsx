"use client";

import { useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  UserRound,
  Plus,
  RefreshCw,
  AlertCircle,
  MoreHorizontal,
  Eye,
  Pencil,
  Ban,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { format } from "date-fns";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { teacherService } from "@/services/teacher.service";
import { config } from "@/config";
import type { Teacher } from "@/types/teacher";

// Use backend max limit (200) so client-side pagination works for most schools.
// For schools with 200+ teachers, a server-side pagination enhancement is needed.
const FETCH_LIMIT = 200;
const PAGE_SIZE = config.pagination.defaultPageSize;

export default function TeachersListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(0);
  const [selectedRows, setSelectedRows] = useState<Teacher[]>([]);
  const [deactivateTarget, setDeactivateTarget] =
    useState<Teacher | null>(null);

  // ── Query ───────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.teachers.list({ search, skip, limit: PAGE_SIZE }),
    queryFn: () =>
      teacherService.list({ search: search || undefined, skip: 0, limit: FETCH_LIMIT }),
    staleTime: 30_000,
  });

  const teachers = data?.teachers ?? [];
  const total = data?.total ?? 0;

  // ── Deactivation Mutation ───────────────────────────────────
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => teacherService.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all });
      toast({
        title: "Teacher deactivated",
        description: "The teacher account has been deactivated.",
      });
      setDeactivateTarget(null);
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to deactivate",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // ── CSV Export Handler ──────────────────────────────────────
  const handleExport = useCallback(() => {
    const headers = [
      "Employee Code",
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Qualification",
      "Specialization",
      "Hire Date",
      "Status",
    ];
    const rows = teachers.map((t) => [
      t.employee_code,
      t.first_name,
      t.last_name,
      t.email,
      t.phone ?? "",
      t.qualification ?? "",
      t.specialization ?? "",
      t.hire_date ? format(new Date(t.hire_date), "yyyy-MM-dd") : "",
      t.is_active ? "Active" : "Inactive",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teachers-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [teachers]);

  // ── Search Handler ──────────────────────────────────────────
  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setSkip(0);
  }, []);

  // ── Columns ─────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<Teacher>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (row) =>
          `${row.first_name} ${row.last_name}`,
        cell: ({ row }) => {
          const t = row.original;
          const initials = `${t.first_name.charAt(0)}${t.last_name.charAt(0)}`.toUpperCase();
          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {initials || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">
                  {t.first_name} {t.last_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.email}
                </p>
              </div>
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: "employee_code",
        header: "Employee Code",
        accessorKey: "employee_code",
        enableSorting: true,
      },
      {
        id: "specialization",
        header: "Specialization",
        accessorKey: "specialization",
        cell: ({ getValue }) => {
          const val = getValue<string | null>();
          return val ? (
            <span className="text-sm">{val}</span>
          ) : (
            <span className="text-sm text-muted-foreground italic">
              Not specified
            </span>
          );
        },
      },
      {
        id: "hire_date",
        header: "Hire Date",
        accessorKey: "hire_date",
        cell: ({ getValue }) => {
          const val = getValue<string>();
          return val
            ? format(new Date(val), "MMM d, yyyy")
            : "—";
        },
      },
      {
        id: "is_class_teacher",
        header: "Class Teacher",
        accessorKey: "is_class_teacher",
        cell: ({ getValue }) => {
          const val = getValue<boolean>();
          return val ? (
            <Badge variant="default" className="text-[10px] px-1.5">
              Yes
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] px-1.5">
              No
            </Badge>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "is_active",
        cell: ({ getValue }) => {
          const val = getValue<boolean>();
          return val ? (
            <Badge
              variant="default"
              className="gap-1 bg-success/15 text-success hover:bg-success/20"
            >
              <CheckCircle2 className="h-3 w-3" />
              Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Ban className="h-3 w-3" />
              Inactive
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const t = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => router.push(`/users/teachers/${t.id}`)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push(`/users/teachers/${t.id}/edit`)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeactivateTarget(t)}
                  disabled={!t.is_active}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Deactivate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [router]
  );

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title="Teachers"
          description="Manage teacher profiles, assignments, and accounts."
        >
          <Button
            onClick={() => router.push("/users/teachers/create")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Teacher
          </Button>
        </PageHeader>

        {/* Error Banner */}
        {isError && !isLoading && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="flex-1 text-destructive">
              {error instanceof Error
                ? error.message
                : "Failed to load teachers. Please try again."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="mt-6">
          <DataTable
            columns={columns}
            data={teachers}
            isLoading={isLoading}
            totalCount={total}
            searchable
            searchPlaceholder="Search by name or employee code..."
            onSearch={handleSearch}
            exportable
            onExport={handleExport}
            selectable
            onSelectedRowsChange={setSelectedRows}
            pageSize={PAGE_SIZE}
          />
        </div>

        {/* Selected count footer */}
        {selectedRows.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {selectedRows.length} teacher(s) selected
          </p>
        )}

        {/* ── Deactivate Confirmation Dialog ───────────────── */}

        <Dialog
          open={!!deactivateTarget}
          onOpenChange={(open) => !open && setDeactivateTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                Deactivate Teacher
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to deactivate{" "}
                <strong>
                  {deactivateTarget?.first_name}{" "}
                  {deactivateTarget?.last_name}
                </strong>
                ? They will lose access to their account.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-muted-foreground">
                This action can be reversed by reactivating the
                teacher from their profile. No data will be lost.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeactivateTarget(null)}
                disabled={deactivateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  deactivateTarget &&
                  deactivateMutation.mutate(deactivateTarget.id)
                }
                disabled={deactivateMutation.isPending}
                className="gap-2"
              >
                {deactivateMutation.isPending
                  ? "Deactivating..."
                  : "Deactivate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
