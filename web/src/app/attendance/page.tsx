"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  RefreshCw,
  AlertCircle,
  ClipboardList,
  Users,
  UserCheck,
  UserX,
  Clock,
  ArrowRight,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useUserRole } from "@/hooks/use-auth";
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
import { queryKeys } from "@/lib/query-keys";
import { attendanceService } from "@/services/attendance.service";
import { classService } from "@/services/class.service";
import { cn } from "@/lib/utils";

export default function AttendancePage() {
  const router = useRouter();
  const role = useUserRole();
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const canMark = role.isTeacher;

  const { data: classesData } = useQuery({
    queryKey: queryKeys.classes.list({ limit: 200 }),
    queryFn: () => classService.list({ limit: 200 }),
    staleTime: 60_000,
  });
  const classes = classesData?.classes ?? [];

  const todayQuery = useQuery({
    queryKey: queryKeys.attendance.today(),
    queryFn: () => attendanceService.getToday(),
    staleTime: 15_000,
  });

  // Filter records by selected class client-side (backend /attendance/today doesn't support class_id param)
  const records = useMemo(() => {
    const all = todayQuery.data?.records ?? [];
    if (selectedClassId === "all") return all;
    return all.filter((r) => r.class_id === selectedClassId);
  }, [todayQuery.data?.records, selectedClassId]);
  const isLoading = todayQuery.isLoading;
  const isError = todayQuery.isError;

  const stats = useMemo(() => {
    const total = records.length;
    const present = records.filter((r) => r.status === "present").length;
    const absent = records.filter((r) => r.status === "absent").length;
    const late = records.filter((r) => r.status === "late").length;
    const halfDay = records.filter((r) => r.status === "half_day").length;
    return {
      total,
      present,
      absent,
      late,
      halfDay,
      presentPct: total > 0 ? Math.round((present / total) * 100) : 0,
      absentPct: total > 0 ? Math.round((absent / total) * 100) : 0,
      latePct: total > 0 ? Math.round((late / total) * 100) : 0,
    };
  }, [records]);

  return (
    <AdminLayout>
      <ContentContainer>
        <PageHeader
          title="Attendance"
          description="Track and manage daily student attendance."
        >
          {role.isTeacher && (
            <Button onClick={() => router.push("/attendance/mark")} size="sm" className="gap-2">
              <ClipboardList className="h-4 w-4" /> Mark Attendance
            </Button>
          )}
        </PageHeader>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Select value={selectedClassId} onValueChange={(v: string | null) => v && setSelectedClassId(v)}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.section ? ` - ${c.section}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
            <CalendarCheck className="h-4 w-4" />
            <span>{today}</span>
          </div>
        </div>

        {/* Stats Cards */}
        {isLoading ? (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="flex-1 text-destructive">Failed to load attendance data.</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => todayQuery.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" /> Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground mt-1">Records today</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-green-600" /> Present
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">{stats.presentPct}%</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.present} students</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <UserX className="h-4 w-4 text-red-600" /> Absent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">{stats.absentPct}%</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.absent} students</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" /> Late
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-amber-600">{stats.latePct}%</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.late} students</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Today's Records */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3">Today&apos;s Records</h3>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              variant="no-data"
              title="No records for today"
              description="Attendance hasn't been marked for today yet."
              action={canMark ? { label: "Mark Now", onClick: () => router.push("/attendance/mark") } : undefined}
            />
          ) : (
            <div className="space-y-2">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/attendance/student/${record.student_id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {record.student?.first_name?.[0]}{record.student?.last_name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {record.student?.first_name} {record.student?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {record.student?.admission_number}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      record.status === "present" ? "default" :
                      record.status === "absent" ? "destructive" :
                      record.status === "late" ? "secondary" :
                      "outline"
                    }
                    className="capitalize"
                  >
                    {record.status === "half_day" ? "Half Day" : record.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {canMark && (
            <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => router.push("/attendance/mark")}>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <ClipboardList className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Mark Attendance</p>
                  <p className="text-xs text-muted-foreground">Batch mark for a class</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          )}
          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => {
            if (classes.length > 0) router.push(`/attendance/class/${classes[0].id}`);
          }}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Class View</p>
                <p className="text-xs text-muted-foreground">View attendance by class</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      </ContentContainer>
    </AdminLayout>
  );
}
