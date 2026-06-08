"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  GraduationCap,
  Users,
  Building2,
  TrendingUp,
  UserPlus,
  CalendarRange,
  Bell,
  RefreshCw,
  School,
  Calendar,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  AlertTriangle,
  ArrowRight,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthStore } from "@/hooks/use-auth-store";
import { useUserRole } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { queryKeys } from "@/lib/query-keys";
import { dashboardService } from "@/services/dashboard.service";
import {
  KpiCard,
} from "@/features/dashboard/components/kpi-card";
import { SkeletonLayout } from "@/components/ui/skeleton-layout";
import { DashboardWidget } from "@/features/dashboard/components/dashboard-widget";
import { QuickActionCard } from "@/features/dashboard/components/quick-action-card";
import { SystemStatus } from "@/features/dashboard/components/system-status";
import { RecentStudentsWidget } from "@/features/dashboard/components/recent-students-widget";
import { RecentTeachersWidget } from "@/features/dashboard/components/recent-teachers-widget";
import { AnnouncementsWidget } from "@/features/dashboard/components/announcements-widget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Admin Dashboard ───────────────────────────────────────────

function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const schoolId = user?.school_id ?? "";

  const { data: dashboard, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.dashboard.admin,
    queryFn: () => dashboardService.getAdminDashboardData(schoolId),
    enabled: !!schoolId,
    staleTime: 30_000,
    retry: 2,
  });

  const formatCount = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  if (isLoading) {
    return (
      <ContentContainer>
        <SkeletonLayout variant="dashboard" />
      </ContentContainer>
    );
  }

  if (isError && !dashboard) {
    return (
      <ContentContainer>
        <PageHeader title="Dashboard" description="An error occurred while loading your dashboard." />
        <div className="mt-12 flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <TrendingUp className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Failed to load dashboard</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Could not connect to the server. Please try again."}
          </p>
          <Button variant="outline" className="mt-6 gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </ContentContainer>
    );
  }

  if (!dashboard) {
    return (
      <ContentContainer>
        <SkeletonLayout variant="dashboard" />
      </ContentContainer>
    );
  }

  const d = dashboard;

  return (
    <ContentContainer>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(" ")[0] ?? "User"}`}
        description="Here's what's happening at your school today."
      >
        <div className="flex items-center gap-2">
          {d.unread_count > 0 && (
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Bell className="h-3 w-3" /> {d.unread_count} unread
            </Badge>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard title="Total Students" value={formatCount(d.total_students)} icon={GraduationCap} />
        <KpiCard title="Total Teachers" value={formatCount(d.total_teachers)} icon={Users} />
        <KpiCard title="Active Classes" value={formatCount(d.active_classes)} icon={Building2} />
        <KpiCard
          title="Academic Year"
          value={d.active_academic_year ?? "Not set"}
          icon={Calendar}
        />
      </div>

      {/* Main Content */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-6 sm:grid-cols-2">
            <DashboardWidget title="Recent Students" action={{ label: "View all", onClick: () => router.push("/users/students") }}>
              <RecentStudentsWidget students={d.recent_students} />
            </DashboardWidget>
            <DashboardWidget title="Recent Teachers" action={{ label: "View all", onClick: () => router.push("/users/teachers") }}>
              <RecentTeachersWidget teachers={d.recent_teachers} />
            </DashboardWidget>
          </div>
          <DashboardWidget title="Recent Announcements" isEmpty={d.announcements.length === 0} emptyMessage="No announcements yet.">
            <AnnouncementsWidget announcements={d.announcements} />
          </DashboardWidget>
        </div>
        <div className="space-y-6">
          <DashboardWidget title="System Status">
            <SystemStatus
              schoolName={d.school_name}
              activeAcademicYear={d.active_academic_year}
              currentTerm={d.current_term}
              lastLogin={null}
              attendancePercentage={d.attendance_percentage}
              timetableHasEntries={d.timetable_status.has_entries}
            />
          </DashboardWidget>
          <DashboardWidget title="Attendance Snapshot" isEmpty={d.attendance_percentage === 0} emptyMessage="No attendance records yet.">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">School-wide attendance</span>
                <span className="text-2xl font-bold">{d.attendance_percentage.toFixed(1)}%</span>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
                <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(d.attendance_percentage, 100)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span className="font-medium text-primary">Target: 90%</span>
                <span>100%</span>
              </div>
              <Separator />
              <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-3">
                <School className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">
                  {d.attendance_percentage >= 90
                    ? "Your school is meeting the attendance target."
                    : "Attendance is below the 90% target. Consider reviewing attendance policies."}
                </p>
              </div>
            </div>
          </DashboardWidget>
          <DashboardWidget title="Timetable Status" isEmpty={!d.timetable_status.has_entries} emptyMessage="No timetable entries yet.">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Today's entries</span>
              <Badge variant={d.timetable_status.has_entries ? "default" : "secondary"} className="text-xs">
                {d.timetable_status.has_entries ? `${d.timetable_status.entry_count} scheduled` : "Not configured"}
              </Badge>
            </div>
            {d.timetable_status.has_entries && (
              <Link href="/timetable" className="mt-3 block text-center text-xs text-primary hover:underline">
                View full timetable →
              </Link>
            )}
          </DashboardWidget>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold">Quick Actions</h2>
          <Separator className="flex-1" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard title="Add Teacher" description="Create a new teacher account" icon={UserPlus} href="/users/teachers" variant="primary" />
          <QuickActionCard title="Add Student" description="Enroll a new student" icon={GraduationCap} href="/users/students" variant="primary" />
          <QuickActionCard title="Create Class" description="Set up a new class group" icon={Building2} href="/academic/classes" />
          <QuickActionCard title="Create Timetable" description="Build or update the schedule" icon={CalendarRange} href="/timetable" />
        </div>
      </div>

      <div className="mt-8 border-t pt-4 pb-6">
        <p className="text-center text-xs text-muted-foreground">Athon v0.1.0 · School Management Platform</p>
      </div>
    </ContentContainer>
  );
}

// ── Teacher Dashboard ─────────────────────────────────────────

function TeacherDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data: dashboard, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.dashboard.teacher,
    queryFn: () => dashboardService.getTeacherDashboard(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <ContentContainer>
        <SkeletonLayout variant="list" />
      </ContentContainer>
    );
  }

  if (isError || !dashboard) {
    return (
      <ContentContainer>
        <PageHeader title="Dashboard" description="Teacher overview" />
        <div className="mt-12 flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <TrendingUp className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Failed to load dashboard</h2>
          <Button variant="outline" className="mt-6 gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </ContentContainer>
    );
  }

  const d = dashboard;

  return (
    <ContentContainer>
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? "Teacher"}`}
        description="Here's your class overview for today."
      >
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push("/attendance/mark")}>
          <CardContent className="p-4 flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{d.attendance_pending_count}</p>
              <p className="text-xs text-muted-foreground">Attendance Pending</p>
              {d.attendance_pending_count > 0 && (
                <span className="text-xs text-primary font-medium">Mark now →</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push("/homework")}>
          <CardContent className="p-4 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{d.homework_pending_review}</p>
              <p className="text-xs text-muted-foreground">Homework to Review</p>
              {d.homework_pending_review > 0 && (
                <span className="text-xs text-primary font-medium">Review →</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{d.upcoming_tests}</p>
              <p className="text-xs text-muted-foreground">Upcoming Tests</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm font-medium">Classes</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {d.classes_assigned.map((cls, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{cls}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule */}
      <div className="mt-6">
        <h2 className="text-base font-semibold mb-3">Today's Schedule</h2>
        {d.today_schedule.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No classes scheduled for today.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {d.today_schedule.map((entry, i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg border p-3">
                <div className="flex flex-col items-center justify-center w-16 shrink-0">
                  <span className="text-xs font-semibold text-primary">{entry.start_time}</span>
                  <span className="text-xs text-muted-foreground">-</span>
                  <span className="text-xs text-muted-foreground">{entry.end_time}</span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{entry.subject_name}</p>
                  <p className="text-xs text-muted-foreground">{entry.class_name}</p>
                </div>
                {entry.room_number && (
                  <Badge variant="outline" className="text-xs">Room {entry.room_number}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-base font-semibold mb-3">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <QuickActionCard title="Mark Attendance" description="Record today's attendance" icon={ClipboardList} href="/attendance/mark" variant="primary" />
          <QuickActionCard title="Create Homework" description="Assign new homework" icon={BookOpen} href="/homework/create" variant="primary" />
          <QuickActionCard title="My Timetable" description="View your schedule" icon={CalendarRange} href="/timetable" />
        </div>
      </div>
    </ContentContainer>
  );
}

// ── Student Dashboard ─────────────────────────────────────────

function StudentDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data: dashboard, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.dashboard.student,
    queryFn: () => dashboardService.getStudentDashboard(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <ContentContainer>
        <SkeletonLayout variant="list" />
      </ContentContainer>
    );
  }

  if (isError || !dashboard) {
    return (
      <ContentContainer>
        <PageHeader title="Dashboard" description="Student overview" />
        <div className="mt-12 flex flex-col items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <TrendingUp className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Failed to load dashboard</h2>
          <Button variant="outline" className="mt-6 gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </ContentContainer>
    );
  }

  const d = dashboard;

  return (
    <ContentContainer>
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? "Student"}`}
        description="Stay on top of your assignments and tests."
      >
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{d.homework_due.length}</p>
              <p className="text-xs text-muted-foreground">Homework Due</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{d.upcoming_tests.length}</p>
              <p className="text-xs text-muted-foreground">Upcoming Tests</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{d.attendance_percentage.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Attendance</p>
            </div>
          </CardContent>
        </Card>
        {d.unread_notifications.count > 0 && (
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push("/notifications")}>
            <CardContent className="p-4 flex items-center gap-3">
              <Bell className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{d.unread_notifications.count}</p>
                <p className="text-xs text-muted-foreground">Unread</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Homework Due */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Homework Due</h2>
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => router.push("/homework")}>
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        {d.homework_due.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No pending homework. Good job!
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {d.homework_due.map((hw) => (
              <div
                key={hw.id}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => router.push(`/homework/${hw.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{hw.title}</p>
                    <p className="text-xs text-muted-foreground">{hw.subject_name}</p>
                  </div>
                </div>
                <Badge variant={hw.days_remaining <= 1 ? "destructive" : "outline"} className={cn(hw.days_remaining <= 1 ? "" : "text-xs")}>
                  {hw.days_remaining <= 0 ? "Overdue" : `${hw.days_remaining}d left`}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Tests */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Upcoming Tests</h2>
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => router.push("/tests")}>
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        {d.upcoming_tests.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No upcoming tests.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {d.upcoming_tests.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => router.push(`/tests/${t.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.subject_name} · {t.total_marks} marks</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {t.scheduled_at ? new Date(t.scheduled_at).toLocaleDateString() : "TBD"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's Timetable */}
      <div className="mt-6">
        <h2 className="text-base font-semibold mb-3">Today's Classes</h2>
        {d.today_timetable.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No classes scheduled for today.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {d.today_timetable.map((entry, i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg border p-3">
                <div className="flex flex-col items-center justify-center w-16 shrink-0">
                  <span className="text-xs font-semibold text-primary">{entry.start_time}</span>
                  <span className="text-xs text-muted-foreground">-</span>
                  <span className="text-xs text-muted-foreground">{entry.end_time}</span>
                </div>
                <div className="h-8 w-px bg-border" />
                <p className="text-sm font-medium">{entry.subject_name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </ContentContainer>
  );
}

// ── Principal Dashboard ───────────────────────────────────────

function PrincipalDashboard() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const { data: dashboard, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.dashboard.principal,
    queryFn: () => dashboardService.getPrincipalDashboard(),
    staleTime: 30_000,
  });

  const formatCount = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  if (isLoading) {
    return (
      <ContentContainer>
        <SkeletonLayout variant="dashboard" />
      </ContentContainer>
    );
  }

  if (isError || !dashboard) {
    return (
      <ContentContainer>
        <PageHeader title="Dashboard" description="School overview" />
        <div className="mt-12 flex flex-col items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <TrendingUp className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Failed to load dashboard</h2>
          <Button variant="outline" className="mt-6 gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </ContentContainer>
    );
  }

  const d = dashboard;

  return (
    <ContentContainer>
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? "Principal"}`}
        description="School-wide performance overview."
      >
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total Students" value={formatCount(d.total_students)} icon={GraduationCap} />
        <KpiCard title="Total Teachers" value={formatCount(d.total_teachers)} icon={Users} />
        <KpiCard
          title="Attendance"
          value={`${d.attendance_percentage.toFixed(1)}%`}
          icon={CheckCircle2}
          trend={{ value: `${d.attendance_percentage.toFixed(0)}%`, direction: d.attendance_percentage >= 90 ? "up" : "down" }}
        />
        <KpiCard title="Test Pass Rate" value={`${d.test_pass_rate.toFixed(0)}%`} icon={TrendingUp} />
      </div>

      {/* Detailed Metrics */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <DashboardWidget title="Recent Announcements" isEmpty={d.recent_announcements.length === 0} emptyMessage="No recent announcements.">
            <div className="space-y-2">
              {d.recent_announcements.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <Bell className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{a.title}</p>
                    {a.body && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.body}</p>}
                  </div>
                </div>
              ))}
            </div>
          </DashboardWidget>
        </div>
        <div className="space-y-6">
          <DashboardWidget title="Performance Metrics">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Homework Completion</span>
                  <span className="text-sm font-bold">{d.homework_completion_rate.toFixed(0)}%</span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(d.homework_completion_rate, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Test Pass Rate</span>
                  <span className="text-sm font-bold">{d.test_pass_rate.toFixed(0)}%</span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-green-500 transition-all" style={{ width: `${Math.min(d.test_pass_rate, 100)}%` }} />
                </div>
              </div>
            </div>
          </DashboardWidget>
          {d.unread_notifications.count > 0 && (
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push("/notifications")}>
              <CardContent className="p-4 flex items-center gap-3">
                <Bell className="h-5 w-5 text-primary" />
                <p className="text-sm font-medium">{d.unread_notifications.count} unread notifications</p>
                <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ContentContainer>
  );
}

// ── Parent Dashboard ──────────────────────────────────────────

function ParentDashboard() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const schoolId = user?.school_id ?? "";

  const { data: dashboard, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.dashboard.admin,
    queryFn: () => dashboardService.getAdminDashboardData(schoolId),
    enabled: !!schoolId,
    staleTime: 30_000,
    retry: 2,
  });

  if (isLoading) {
    return (
      <ContentContainer>
        <SkeletonLayout variant="dashboard" />
      </ContentContainer>
    );
  }

  if (isError || !dashboard) {
    return (
      <ContentContainer>
        <PageHeader title="Dashboard" description="Family overview" />
        <div className="mt-12 flex flex-col items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <TrendingUp className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Failed to load dashboard</h2>
          <Button variant="outline" className="mt-6 gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </ContentContainer>
    );
  }

  const d = dashboard;

  return (
    <ContentContainer>
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? "Parent"}`}
        description="Stay updated on your child's academic journey."
      >
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard title="Attendance" value={`${d.attendance_percentage.toFixed(1)}%`} icon={CheckCircle2} />
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push("/homework")}>
          <CardContent className="p-4 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm font-medium">Homework</p>
              <p className="text-xs text-muted-foreground">View assignments</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push("/attendance")}>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm font-medium">Attendance</p>
              <p className="text-xs text-muted-foreground">View records</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Announcements */}
      <div className="mt-6">
        <DashboardWidget title="Recent Announcements" isEmpty={d.announcements.length === 0} emptyMessage="No announcements yet.">
          <AnnouncementsWidget announcements={d.announcements} />
        </DashboardWidget>
      </div>
    </ContentContainer>
  );
}

// ── Main Dashboard Page (Role Router) ─────────────────────────

export default function DashboardPage() {
  const role = useUserRole();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  // Select the correct dashboard component based on role
  const DashboardComponent = useMemo(() => {
    if (role.isTeacher) return TeacherDashboard;
    if (role.isStudent) return StudentDashboard;
    if (role.isPrincipal) return PrincipalDashboard;
    if (role.isParent) return ParentDashboard;
    return AdminDashboard; // admin, super_admin
  }, [role]);

  return (
    <AdminLayout>
      <DashboardComponent />
    </AdminLayout>
  );
}
