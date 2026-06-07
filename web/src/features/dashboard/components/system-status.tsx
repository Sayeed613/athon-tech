/** Athon — System Status Widget */

import {
  Building2,
  Calendar,
  CalendarCheck,
  Clock,
  Wifi,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface SystemStatusProps {
  schoolName: string;
  activeAcademicYear: string | null;
  currentTerm: string | null;
  lastLogin: string | null;
  attendancePercentage: number;
  timetableHasEntries: boolean;
}

/**
 * System status panel showing school identity, academic context,
 * and key system indicators.
 */
export function SystemStatus({
  schoolName,
  activeAcademicYear,
  currentTerm,
  lastLogin,
  attendancePercentage,
  timetableHasEntries,
}: SystemStatusProps) {
  const statusItems = [
    {
      icon: Building2,
      label: "School",
      value: schoolName,
    },
    {
      icon: Calendar,
      label: "Active Year",
      value: activeAcademicYear ?? (
        <span className="text-muted-foreground italic">Not set</span>
      ),
    },
    {
      icon: CalendarCheck,
      label: "Current Term",
      value: currentTerm ?? (
        <span className="text-muted-foreground italic">Not set</span>
      ),
    },
    {
      icon: Clock,
      label: "Last Login",
      value: lastLogin ?? (
        <span className="text-muted-foreground italic">N/A</span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {statusItems.map((item, idx) => (
        <div key={item.label}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                {item.label}
              </p>
              <p className="text-sm font-medium truncate">
                {item.value}
              </p>
            </div>
          </div>
          {idx < statusItems.length - 1 && (
            <Separator className="mt-3" />
          )}
        </div>
      ))}

      <Separator />

      {/* Status indicators */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Badge
          variant="outline"
          className="flex items-center gap-1.5 text-xs"
        >
          <Wifi className="h-3 w-3 text-success" />
          System Online
        </Badge>
        <Badge
          variant="outline"
          className="flex items-center gap-1.5 text-xs"
        >
          <Calendar className="h-3 w-3" />
          Attendance: {attendancePercentage.toFixed(1)}%
        </Badge>
        <Badge
          variant={
            timetableHasEntries ? "default" : "secondary"
          }
          className="flex items-center gap-1.5 text-xs"
        >
          <CalendarCheck className="h-3 w-3" />
          {timetableHasEntries
            ? "Timetable Active"
            : "No Timetable"}
        </Badge>
      </div>
    </div>
  );
}
