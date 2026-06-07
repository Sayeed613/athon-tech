"use client";

import { useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Book,
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
import { subjectService } from "@/services/subject.service";
import { config } from "@/config";
import type { Subject } from "@/types/subject";

const FETCH_LIMIT = 200;
const PAGE_SIZE = config.pagination.defaultPageSize;

export default function SubjectsListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<Subject | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.subjects.list({ search }),
    queryFn: () => subjectService.list({ search: search || undefined, limit: FETCH_LIMIT }),
    staleTime: 30_000,
  });

  const subjects = data?.subjects ?? [];
  const total = data?.total ?? 0;

  const archiveMutation = useMutation({
    mutationFn: (id: string) => subjectService.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subjects.all });
      toast({ title: "Subject archived", description: "The subject has been archived." });
      setArchiveTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to archive", description: err.message, variant: "destructive" });
    },
  });

  const handleExport = useCallback(() => {
    const headers = ["Code", "Name", "Description", "Core Subject", "Created"];
    const rows = subjects.map((s) => [
      s.code,
      s.name,
      s.description ?? "",
      s.is_core ? "Yes" : "No",
      s.created_at ? format(new Date(s.created_at), "yyyy-MM-dd") : "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subjects-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [subjects]);

  const handleSearch = useCallback((query: string) => setSearch(query), []);

  const columns = useMemo<ColumnDef<Subject>[]>(
    () => [
      {
        id: "name",
        header: "Subject",
        accessorKey: "name",
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Book className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.code}</p>
              </div>
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: "code",
        header: "Code",
        accessorKey: "code",
      },
      {
        id: "description",
        header: "Description",
        accessorKey: "description",
        cell: ({ getValue }) => {
          const val = getValue<string | null>();
          return val ? (
            <span className="text-sm line-clamp-2">{val}</span>
          ) : (
            <span className="text-sm text-muted-foreground italic">—</span>
          );
        },
      },
      {
        id: "is_core",
        header: "Core",
        accessorKey: "is_core",
        cell: ({ getValue }) => {
          const val = getValue<boolean>();
          return val ? (
            <Badge className="text-[10px] px-1.5 bg-primary/15 text-primary hover:bg-primary/20">Core</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] px-1.5">Elective</Badge>
          );
        },
      },
      {
        id: "created_at",
        header: "Created",
        accessorKey: "created_at",
        cell: ({ getValue }) => {
          const val = getValue<string>();
          return val ? format(new Date(val), "MMM d, yyyy") : "—";
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const s = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => router.push(`/academic/subjects/${s.id}`)}>
                  <Eye className="mr-2 h-4 w-4" /> View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/academic/subjects/${s.id}/edit`)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setArchiveTarget(s)}
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
          title="Subjects"
          description="Manage academic subjects offered at the school."
        >
          <Button onClick={() => router.push("/academic/subjects/create")} className="gap-2">
            <Plus className="h-4 w-4" /> Add Subject
          </Button>
        </PageHeader>

        {isError && !isLoading && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="flex-1 text-destructive">
              {error instanceof Error ? error.message : "Failed to load subjects."}
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        )}

        <div className="mt-6">
          <DataTable
            columns={columns}
            data={subjects}
            isLoading={isLoading}
            totalCount={total}
            searchable
            searchPlaceholder="Search by name or code..."
            onSearch={handleSearch}
            exportable
            onExport={handleExport}
            pageSize={PAGE_SIZE}
          />
        </div>

        <Dialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" /> Archive Subject
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to archive <strong>{archiveTarget?.name}</strong>?
              </DialogDescription>
            </DialogHeader>
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
