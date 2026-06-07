"use client";

import { useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Building2,
  Plus,
  RefreshCw,
  AlertCircle,
  MoreHorizontal,
  Eye,
  Pencil,
  Ban,
  CheckCircle2,
  ShieldAlert,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { classService } from "@/services/class.service";
import { config } from "@/config";
import type { ClassItem } from "@/types/class";

const FETCH_LIMIT = 200;
const PAGE_SIZE = config.pagination.defaultPageSize;

export default function ClassesListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [selectedRows, setSelectedRows] = useState<ClassItem[]>([]);
  const [archiveTarget, setArchiveTarget] = useState<ClassItem | null>(null);

  // ── Query ───────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.classes.list({ search, limit: FETCH_LIMIT }),
    queryFn: () => classService.list({ search: search || undefined, skip: 0, limit: FETCH_LIMIT }),
    staleTime: 30_000,
  });

  const classes = data?.classes ?? [];
  const total = data?.total ?? 0;

  // ── Archive Mutation ────────────────────────────────────────
  const archiveMutation = useMutation({
    mutationFn: (id: string) => classService.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      toast({ title: "Class archived", description: "The class has been archived." });
      setArchiveTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to archive", description: err.message, variant: "destructive" });
    },
  });

  // ── CSV Export ──────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const headers = ["Name", "Section", "Academic Year", "Room", "Capacity", "Students", "Status"];
    const rows = classes.map((c) => [
      c.name,
      c.section ?? "",
      c.academic_year_name,
      c.room_number ?? "",
      String(c.capacity),
      String(c.student_count),
      "Active",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `classes-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [classes]);

  // ── Search ──────────────────────────────────────────────────
  const handleSearch = useCallback((query: string) => {
    setSearch(query);
  }, []);

  // ── Columns ─────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<ClassItem>[]>(
    () => [
      {
        id: "name",
        header: "Class",
        accessorFn: (row) => `${row.name}${row.section ? ` - ${row.section}` : ""}`,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {c.name}{c.section ? <span className="text-muted-foreground"> - {c.section}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">{c.academic_year_name}</p>
              </div>
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: "class_teacher_name",
        header: "Class Teacher",
        accessorKey: "class_teacher_name",
        cell: ({ getValue }) => {
          const val = getValue<string | null>();
          return val ? (
            <span className="text-sm">{val}</span>
          ) : (
            <span className="text-sm text-muted-foreground italic">Not assigned</span>
          );
        },
      },
      {
        id: "room_number",
        header: "Room",
        accessorKey: "room_number",
        cell: ({ getValue }) => {
          const val = getValue<string | null>();
          return val ?? <span className="text-muted-foreground italic">—</span>;
        },
      },
      {
        id: "capacity",
        header: "Capacity",
        accessorKey: "capacity",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{c.student_count}</span>
              <span className="text-xs text-muted-foreground">/ {c.capacity}</span>
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: () => (
          <Badge className="gap-1 bg-success/15 text-success hover:bg-success/20"><CheckCircle2 className="h-3 w-3" /> Active</Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => router.push(`/academic/classes/${c.id}`)}>
                  <Eye className="mr-2 h-4 w-4" /> View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/academic/classes/${c.id}/edit`)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setArchiveTarget(c)}
                >
                  <Ban className="mr-2 h-4 w-4" /> Archive
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
          title="Classes"
          description="Manage class groups, sections, and assignments."
        >
          <Button
            onClick={() => router.push("/academic/classes/create")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Class
          </Button>
        </PageHeader>

        {/* Error Banner */}
        {isError && !isLoading && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="flex-1 text-destructive">
              {error instanceof Error ? error.message : "Failed to load classes."}
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="mt-6">
          <DataTable
            columns={columns}
            data={classes}
            isLoading={isLoading}
            totalCount={total}
            searchable
            searchPlaceholder="Search by name or section..."
            onSearch={handleSearch}
            exportable
            onExport={handleExport}
            selectable
            onSelectedRowsChange={setSelectedRows}
            pageSize={PAGE_SIZE}
          />
        </div>

        {/* Archive Dialog */}
        <Dialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                Archive Class
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to archive{" "}
                <strong>{archiveTarget?.name}{archiveTarget?.section ? ` - ${archiveTarget.section}` : ""}</strong>?
                Students assigned to this class will be affected.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-muted-foreground">
                This action can be reversed. No data will be permanently deleted.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setArchiveTarget(null)} disabled={archiveMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
                disabled={archiveMutation.isPending}
              >
                {archiveMutation.isPending ? "Archiving..." : "Archive"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
