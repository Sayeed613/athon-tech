"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Plus,
  RefreshCw,
  AlertCircle,
  Eye,
  Pencil,
  Calendar,
  FileText,
  Users,
  Search,
  Download,
  Clock,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useUserRole } from "@/hooks/use-auth";
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
import { queryKeys } from "@/lib/query-keys";
import { homeworkService } from "@/services/homework.service";
import { classService } from "@/services/class.service";
import { cn, toCSVRow } from "@/lib/utils";
import type { HomeworkItem } from "@/types/homework";

export default function HomeworkPage() {
  const router = useRouter();
  const role = useUserRole();
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [search, setSearch] = useState("");

  const isStudentView = role.isStudent;
  const isParentView = role.isParent;
  const isTeacherOrAdmin = role.isTeacher || role.isAdmin || role.isPrincipal;

  const { data: classesData } = useQuery({
    queryKey: queryKeys.classes.list({ limit: 200 }),
    queryFn: () => classService.list({ limit: 200 }),
    staleTime: 60_000,
    enabled: !isStudentView, // Students don't need class selector
  });
  const classes = classesData?.classes ?? [];

  // Students use their own endpoint; teachers/admins use class selector
  const studentHomeworkQuery = useQuery({
    queryKey: queryKeys.homework.all,
    queryFn: () => homeworkService.getMyHomework(),
    enabled: isStudentView,
    staleTime: 30_000,
  });

  const homeworkQuery = useQuery({
    queryKey: queryKeys.homework.byClass(selectedClassId),
    queryFn: () => homeworkService.getByClass(selectedClassId, {
      include_unpublished: isTeacherOrAdmin, // Only teachers/admins see drafts
    }),
    enabled: selectedClassId !== "all" && !isStudentView,
    staleTime: 30_000,
  });

  const allHomeworks = isStudentView
    ? (studentHomeworkQuery.data?.homeworks ?? [])
    : (homeworkQuery.data?.homeworks ?? []);

  const isLoading = isStudentView
    ? studentHomeworkQuery.isLoading
    : (selectedClassId !== "all" && homeworkQuery.isLoading);

  const isError = isStudentView
    ? studentHomeworkQuery.isError
    : (selectedClassId !== "all" && homeworkQuery.isError);

  // If no class selected, auto-select first available class
  const fallbackClassId = classes.length > 0 ? classes[0].id : "";
  useEffect(() => {
    if (selectedClassId === "all" && fallbackClassId && !isStudentView) {
      setSelectedClassId(fallbackClassId);
    }
  }, [selectedClassId, fallbackClassId, isStudentView]);

  const filtered = useMemo(() => {
    if (!search) return allHomeworks;
    const q = search.toLowerCase();
    return allHomeworks.filter(
      (h) =>
        h.title.toLowerCase().includes(q) ||
        h.subject?.name.toLowerCase().includes(q) ||
        h.teacher?.name.toLowerCase().includes(q)
    );
  }, [allHomeworks, search]);

  const handleExportCSV = () => {
    const header = ["Title","Subject","Teacher","Class","Due Date","Status","Max Score","Created"];
    const rows = filtered.map((h) =>
      toCSVRow([h.title, h.subject?.name ?? "", h.teacher?.name ?? "", h.class_?.name ?? "", h.due_date, h.is_published ? "Published" : "Draft", h.max_score, h.created_at])
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "homework.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatus = (hw: HomeworkItem) => {
    const due = new Date(hw.due_date);
    const now = new Date();
    if (!hw.is_published) return { label: "Draft", variant: "outline" as const };
    if (due < now) return { label: "Overdue", variant: "destructive" as const };
    return { label: "Active", variant: "default" as const };
  };

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title={isStudentView ? "My Homework" : "Homework"}
          description={isStudentView ? "View and submit your homework assignments." : "Create and manage homework assignments."}
        >
          {role.isTeacher && (
            <Button onClick={() => router.push("/homework/create")} size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> New Homework
            </Button>
          )}
        </PageHeader>

        {/* Filters — only show class selector for non-students */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search homework..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          {!isStudentView && (
            <>
              <Select value={selectedClassId} onValueChange={(v: string | null) => v && setSelectedClassId(v)}>
                <SelectTrigger className="h-9 w-48">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.section ? ` - ${c.section}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCSV} disabled={filtered.length === 0}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </>
          )}
        </div>

        {/* Summary Cards */}
        {!isLoading && !isError && allHomeworks.length > 0 && !isStudentView && (
          <div className="mt-6 grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{allHomeworks.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{allHomeworks.filter((h) => h.is_published).length}</p>
                  <p className="text-xs text-muted-foreground">Published</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-2xl font-bold text-amber-600">{allHomeworks.filter((h) => !h.is_published).length}</p>
                  <p className="text-xs text-muted-foreground">Drafts</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="flex-1 text-destructive">Failed to load homework.</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => isStudentView ? studentHomeworkQuery.refetch() : homeworkQuery.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && filtered.length === 0 && (
          <EmptyState
            variant="no-data"
            title={isStudentView ? "No homework assigned" : "No homework"}
            description={search ? "No homework matches your search." : isStudentView ? "You don't have any pending homework." : "No homework assigned to this class yet."}
            action={role.isTeacher && !isStudentView ? { label: "Create Homework", onClick: () => router.push("/homework/create") } : undefined}
          />
        )}

        {/* Homework List */}
        {!isLoading && !isError && filtered.length > 0 && (
          <div className="mt-6 space-y-3">
            {filtered.map((hw) => {
              const status = getStatus(hw);
              return (
                <div
                  key={hw.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => router.push(`/homework/${hw.id}`)}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{hw.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {hw.subject?.name ?? "—"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{hw.class_?.name ?? "—"}</span>
                        {!isStudentView && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{hw.teacher?.name ?? "—"}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Due {new Date(hw.due_date).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{hw.max_score} pts</p>
                    </div>
                    {isStudentView ? (
                      <Badge variant={status.variant} className="capitalize">{status.label}</Badge>
                    ) : (
                      <Badge variant={status.variant} className="capitalize">{status.label}</Badge>
                    )}
                    {!isStudentView && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); router.push(`/homework/${hw.id}`); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {role.isTeacher && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); router.push(`/homework/${hw.id}/edit`); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ContentContainer>
    </AdminLayout>
  );
}
