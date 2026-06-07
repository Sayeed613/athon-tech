/** Athon — Recent Students Widget */

import { GraduationCap, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { RecentStudent } from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface RecentStudentsWidgetProps {
  students: RecentStudent[];
}

/**
 * Mini student list widget for the dashboard, showing the 5 most
 * recently created student records with name, admission number,
 * class, and status.
 */
export function RecentStudentsWidget({
  students,
}: RecentStudentsWidgetProps) {
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <GraduationCap className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No students enrolled yet.
        </p>
        <Link
          href="/users/students"
          className="mt-2 text-xs text-primary hover:underline"
        >
          Add your first student
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {students.map((student) => {
        const initials = `${student.first_name.charAt(0)}${student.last_name.charAt(0)}`.toUpperCase();
        return (
          <Link
            key={student.id}
            href={`/users/students/${student.id}`}
            className="group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                {student.first_name} {student.last_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {student.admission_number}
                {student.class_name && ` · ${student.class_name}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={student.is_active ? "default" : "secondary"}
                className="h-5 text-[10px] px-1.5"
              >
                {student.is_active ? "Active" : "Inactive"}
              </Badge>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        );
      })}

    </div>
  );
}
