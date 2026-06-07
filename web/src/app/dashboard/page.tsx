"use client";

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
} from "lucide-react";
import Link from "next/link";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthStore } from "@/hooks/use-auth-store";
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

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const schoolId = user?.school_id ?? "";

  // ── Dashboard Data Query ───────────────────────────────────
  const {
    data: dashboard,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.dashboard.admin,
    queryFn: () => dashboardService.getAdminDashboardData(schoolId),
    enabled: !!schoolId,
    staleTime: 30_000, // 30s — dashboard auto-refreshes
    retry: 2,
  });

  // ── Derived helper ─────────────────────────────────────────
  const formatCount = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  // ── Full-page Loading ──────────────────────────────────────
  if (isLoading) {
    return (
      <AdminLayout>
        <ContentContainer>
          <SkeletonLayout variant="dashboard" />
        </ContentContainer>
      </AdminLayout>
    );
  }

  // ── Full-page Error ────────────────────────────────────────
  if (isError && !dashboard) {
    return (
      <AdminLayout>
        <ContentContainer>
          <PageHeader
            title="Dashboard"
            description="An error occurred while loading your dashboard."
          />
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <TrendingUp className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">
              Failed to load dashboard
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {error instanceof Error
                ? error.message
                : "Could not connect to the server. Please try again."}
            </p>
            <Button
              variant="outline"
              className="mt-6 gap-2"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </ContentContainer>
      </AdminLayout>
    );
  }

  // ── Safe render with null guard ────────────────────────────
  if (!dashboard) {
    return (
      <AdminLayout>
        <ContentContainer>
          <SkeletonLayout variant="dashboard" />
        </ContentContainer>
      </AdminLayout>
    );
  }

  const d = dashboard;

  return (
    <AdminLayout>
      <ContentContainer>
        {/* ── Header ───────────────────────────────────────── */}
        <PageHeader
          title={`Welcome back, ${user?.name?.split(" ")[0] ?? "User"}`}
          description="Here's what's happening at your school today."
        >
          <div className="flex items-center gap-2">
            {d.unread_count > 0 && (
              <Badge
                variant="outline"
                className="gap-1.5 text-xs"
              >
                <Bell className="h-3 w-3" />
                {d.unread_count} unread
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </PageHeader>

        {/* ── Section 1: KPI Cards ───────────────────────────── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            title="Total Students"
            value={formatCount(d.total_students)}
            icon={GraduationCap}
          />
          <KpiCard
            title="Total Teachers"
            value={formatCount(d.total_teachers)}
            icon={Users}
          />
          <KpiCard
            title="Total Parents"
            value="—"
            icon={Users}
            trend={{ value: "API not yet available", direction: "neutral" }}
          />
          <KpiCard
            title="Active Classes"
            value={formatCount(d.active_classes)}
            icon={Building2}
          />
          <KpiCard
            title={d.active_academic_year ?? "Active Year"}
            value={d.active_academic_year ?? "Not set"}
            icon={Calendar}
          />
        </div>

        {/* ── Section 2 & 4: Operational Widgets + System Status ── */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Left column — Recent Students + Recent Teachers */}
          <div className="space-y-6 lg:col-span-2">
            <div className="grid gap-6 sm:grid-cols-2">
              <DashboardWidget
                title="Recent Students"
                action={{
                  label: "View all",
                  onClick: () => router.push("/users/students"),
                }}
              >
                <RecentStudentsWidget
                  students={d.recent_students}
                />
              </DashboardWidget>

              <DashboardWidget
                title="Recent Teachers"
                action={{
                  label: "View all",
                  onClick: () => router.push("/users/teachers"),
                }}
              >
                <RecentTeachersWidget
                  teachers={d.recent_teachers}
                />
              </DashboardWidget>
            </div>

            {/* Announcements */}
            <DashboardWidget
              title="Recent Announcements"
              isEmpty={d.announcements.length === 0}
              emptyMessage="No announcements yet."
            >
              <AnnouncementsWidget
                announcements={d.announcements}
              />
            </DashboardWidget>
          </div>

          {/* Right column — System Status + Attendance */}
          <div className="space-y-6">
            <DashboardWidget title="System Status">
              <SystemStatus
                schoolName={d.school_name}
                activeAcademicYear={d.active_academic_year}
                currentTerm={d.current_term}
                lastLogin={null}
                attendancePercentage={d.attendance_percentage}
                timetableHasEntries={
                  d.timetable_status.has_entries
                }
              />
            </DashboardWidget>

            {/* Attendance Snapshot */}
            <DashboardWidget
              title="Attendance Snapshot"
              isEmpty={d.attendance_percentage === 0}
              emptyMessage="No attendance records yet."
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    School-wide attendance
                  </span>
                  <span className="text-2xl font-bold">
                    {d.attendance_percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.min(d.attendance_percentage, 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span className="font-medium text-primary">
                    Target: 90%
                  </span>
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

            {/* Timetable Status */}
            <DashboardWidget
              title="Timetable Status"
              isEmpty={!d.timetable_status.has_entries}
              emptyMessage="No timetable entries yet. Create your first timetable to get started."
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Today's entries
                </span>
                <Badge
                  variant={
                    d.timetable_status.has_entries
                      ? "default"
                      : "secondary"
                  }
                  className="text-xs"
                >
                  {d.timetable_status.has_entries
                    ? `${d.timetable_status.entry_count} scheduled`
                    : "Not configured"}
                </Badge>
              </div>
              {d.timetable_status.has_entries && (
                <Link
                  href="/timetable"
                  className="mt-3 block text-center text-xs text-primary hover:underline"
                >
                  View full timetable →
                </Link>
              )}
            </DashboardWidget>
          </div>
        </div>

        {/* ── Section 3: Quick Actions ──────────────────────── */}
        <div className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-base font-semibold">
              Quick Actions
            </h2>
            <Separator className="flex-1" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickActionCard
              title="Add Teacher"
              description="Create a new teacher account"
              icon={UserPlus}
              href="/users/teachers"
              shortcut="⌘T"
              variant="primary"
            />
            <QuickActionCard
              title="Add Student"
              description="Enroll a new student"
              icon={GraduationCap}
              href="/users/students"
              shortcut="⌘S"
              variant="primary"
            />
            <QuickActionCard
              title="Create Class"
              description="Set up a new class group"
              icon={Building2}
              href="/academic/classes"
              shortcut="⌘C"
            />
            <QuickActionCard
              title="Create Timetable"
              description="Build or update the schedule"
              icon={CalendarRange}
              href="/timetable"
              shortcut="⌘E"
            />
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────── */}
        <div className="mt-8 border-t pt-4 pb-6">
          <p className="text-center text-xs text-muted-foreground">
            Athon v0.1.0 · School Management Platform
          </p>
        </div>
      </ContentContainer>
    </AdminLayout>
  );
}
