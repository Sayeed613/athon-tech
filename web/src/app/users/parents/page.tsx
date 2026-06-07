"use client";

import { useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
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
import { parentService } from "@/services/parent.service";
import { config } from "@/config";
import type { Parent } from "@/types/parent";

const FETCH_LIMIT = 200;
const PAGE_SIZE = config.pagination.defaultPageSize;

export default function ParentsListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRows, setSelectedRows] = useState<Parent[]>([]);
  const [deactivateTarget, setDeactivateTarget] = useState<Parent | null>(null);

  // ── Query ───────────────────────────────────────────────────
  const queryParams = {
    search: search || undefined,
    is_active:
      statusFilter === "active"
        ? true
        : statusFilter === "inactive"
        ? false
        : undefined,
    skip: 0,
    limit: FETCH_LIMIT,
  };

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.parents.list(queryParams),
    queryFn: () => parentService.list(queryParams),
    staleTime: 30_000,
  });

  const parents = data?.parents ?? [];
  const total = data?.total ?? 0;

  // ── Deactivation Mutation ───────────────────────────────────
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => parentService.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parents.all });
      toast({ title: "Parent deactivated", description: "The parent account has been deactivated." });
      setDeactivateTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to deactivate", description: err.message, variant: "destructive" });
    },
  });

  // ── CSV Export ──────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const headers = ["First Name", "Last Name", "Email", "Phone", "Occupation", "Status"];
    const rows = parents.map((p) => [
      p.first_name,
      p.last_name,
      p.email,
      p.phone ?? "",
      p.occupation ?? "",
      p.is_active ? "Active" : "Inactive",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `parents-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [parents]);

  // ── Search ──────────────────────────────────────────────────
  const handleSearch = useCallback((query: string) => setSearch(query), []);

  // ── Columns ─────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<Parent>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (row) => `${row.first_name} ${row.last_name}`,
        cell: ({ row }) => {
          const p = row.original;
          const initials = `${p.first_name.charAt(0)}${p.last_name.charAt(0)}`.toUpperCase();
          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {initials || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{p.first_name} {p.last_name}</p>
                <p className="text-xs text-muted-foreground">{p.email}</p>
              </div>
            </div>
          );
        },
      },
      {
        id: "phone",
        header: "Phone",
        accessorKey: "phone",
        cell: ({ getValue }) => {
          const val = getValue<string | null>();
          return val ? <span className="text-sm">{val}</span> : <span className="text-sm text-muted-foreground italic">—</span>;
        },
      },
      {
        id: "occupation",
        header: "Occupation",
        accessorKey: "occupation",
        cell: ({ getValue }) => {
          const val = getValue<string | null>();
          return val ? <span className="text-sm">{val}</span> : <span className="text-sm text-muted-foreground italic">—</span>;
        },
      },

      {
        id: "is_verified",
        header: "Verified",
        accessorKey: "is_verified",
        cell: ({ getValue }) => {
          const val = getValue<boolean>();
          return val ? (
            <Badge className="gap-1 bg-success/15 text-success hover:bg-success/20">
              <CheckCircle2 className="h-3 w-3" /> Verified
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              Pending
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
            <Badge className="gap-1 bg-success/15 text-success hover:bg-success/20">
              <CheckCircle2 className="h-3 w-3" /> Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Ban className="h-3 w-3" /> Inactive
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const p = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => router.push(`/users/parents/${p.id}`)}>
                  <Eye className="mr-2 h-4 w-4" /> View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/users/parents/${p.id}/edit`)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeactivateTarget(p)} disabled={!p.is_active}>
                  <Ban className="mr-2 h-4 w-4" /> Deactivate
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
          title="Parents & Guardians"
          description="Manage parent profiles, student links, and contact information."
        >
          <Button className="gap-2" onClick={() => router.push("/users/parents/create")}>
            <Plus className="h-4 w-4" /> Add Parent
          </Button>
        </PageHeader>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Error Banner */}
        {isError && !isLoading && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="flex-1 text-destructive">{error instanceof Error ? error.message : "Failed to load parents."}</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="mt-4">
          <DataTable
            columns={columns}
            data={parents}
            isLoading={isLoading}
            totalCount={total}
            searchable
            searchPlaceholder="Search by name or email..."
            onSearch={handleSearch}
            exportable
            onExport={handleExport}
            selectable
            onSelectedRowsChange={setSelectedRows}
            pageSize={PAGE_SIZE}
          />
        </div>

        {/* Deactivate Dialog */}
        <Dialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" /> Deactivate Parent
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to deactivate <strong>{deactivateTarget?.first_name} {deactivateTarget?.last_name}</strong>?
                They will lose access to their account.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-muted-foreground">This action can be reversed by reactivating the parent from their profile.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeactivateTarget(null)} disabled={deactivateMutation.isPending}>Cancel</Button>
              <Button variant="destructive" onClick={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)} disabled={deactivateMutation.isPending}>
                {deactivateMutation.isPending ? "Deactivating..." : "Deactivate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentContainer>
    </AdminLayout>
  );
}
