/** Athon — Recent Teachers Widget */

import { Users, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { RecentTeacher } from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface RecentTeachersWidgetProps {
  teachers: RecentTeacher[];
}

/**
 * Mini teacher list widget for the dashboard, showing the 5 most
 * recently created teacher records.
 */
export function RecentTeachersWidget({
  teachers,
}: RecentTeachersWidgetProps) {
  if (teachers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Users className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No teachers added yet.
        </p>
        <Link
          href="/users/teachers"
          className="mt-2 text-xs text-primary hover:underline"
        >
          Add your first teacher
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {teachers.map((teacher) => {
        const initials = `${teacher.first_name.charAt(0)}${teacher.last_name.charAt(0)}`.toUpperCase();
        return (
          <Link
            key={teacher.id}
            href={`/users/teachers/${teacher.id}`}
            className="group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                {teacher.first_name} {teacher.last_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {teacher.employee_code}
                {teacher.email && ` · ${teacher.email}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={teacher.is_active ? "default" : "secondary"}
                className="h-5 text-[10px] px-1.5"
              >
                {teacher.is_active ? "Active" : "Inactive"}
              </Badge>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        );
      })}

    </div>
  );
}
