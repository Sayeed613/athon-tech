"""Dashboard service — consolidated data views for each user role.

Reuses existing services (ReportService, NotificationService) and
repository functions directly for maximum efficiency. No duplicated
aggregation logic. Each dashboard endpoint composes its response
from at most 5 DB round-trips.
"""

from datetime import date, datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.repository import reports as report_queries


class DashboardService:
    """Service for composing dashboard views from existing services.

    Each dashboard method orchestrates calls to existing services
    and repository functions. No new aggregation logic is added.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Count helpers (batched) ─────────────────────────────────

    async def _batch_counts(
        self, school_id: str, count_students: bool = True, count_teachers: bool = True, count_classes: bool = True,
    ) -> dict:
        """Fetch multiple school-level counts."""
        from app.models.student import Student
        from app.models.teacher import Teacher
        from app.models.academic_class import Class
        from app.models.parent import Parent

        result: dict[str, int] = {}

        if count_students:
            r = await self.db.execute(
                select(func.count(Student.id)).where(
                    Student.school_id == school_id,
                    Student.is_active.is_(True),
                    Student.deleted_at.is_(None),
                )
            )
            result["students"] = r.scalar() or 0

        if count_teachers:
            r = await self.db.execute(
                select(func.count(Teacher.id)).where(
                    Teacher.school_id == school_id,
                    Teacher.deleted_at.is_(None),
                )
            )
            result["teachers"] = r.scalar() or 0

        # Count parents always (lightweight query)
        if count_students:
            r = await self.db.execute(
                select(func.count(Parent.id)).where(
                    Parent.school_id == school_id,
                    Parent.deleted_at.is_(None),
                )
            )
            result["parents"] = r.scalar() or 0

        if count_classes:
            r = await self.db.execute(
                select(func.count(Class.id)).where(
                    Class.school_id == school_id,
                    Class.deleted_at.is_(None),
                )
            )
            result["classes"] = r.scalar() or 0

        return result

    async def _get_recent_announcements(
        self, school_id: str, limit: int = 5,
    ) -> list[dict]:
        from app.models.announcement import Announcement

        result = await self.db.execute(
            select(Announcement)
            .where(
                Announcement.school_id == school_id,
                Announcement.is_published.is_(True),
                Announcement.deleted_at.is_(None),
            )
            .where(
                (Announcement.expires_at.is_(None))
                | (Announcement.expires_at > datetime.now(timezone.utc))
            )
            .order_by(Announcement.created_at.desc())
            .limit(limit)
        )
        announcements = result.scalars().all()
        return [
            {
                "id": str(a.id),
                "title": a.title,
                "body": a.body,
                "priority": a.priority,
                "created_at": a.created_at.isoformat() if a.created_at else "",
            }
            for a in announcements
        ]

    async def _count_unread_notifications(
        self, user_id: str, school_id: str,
    ) -> int:
        from app.models.notification import Notification
        from app.models.notification_recipient import NotificationRecipient

        result = await self.db.execute(
            select(func.count(NotificationRecipient.id))
            .join(Notification, NotificationRecipient.notification_id == Notification.id)
            .where(
                NotificationRecipient.user_id == user_id,
                Notification.school_id == school_id,
                NotificationRecipient.is_read.is_(False),
            )
        )
        return result.scalar() or 0

    # ── Teacher-specific helpers ────────────────────────────────

    async def _get_teacher_class_info(self, teacher_profile_id: str) -> tuple[list[str], list[str]]:
        """Get both class IDs and class names for a teacher in one query.

        Returns (class_ids, class_names).
        """
        from app.models.academic_class import Class
        from app.models.teacher_class_subject import TeacherClassSubject

        result = await self.db.execute(
            select(Class.id, Class.name, Class.section)
            .select_from(Class)
            .join(TeacherClassSubject, Class.id == TeacherClassSubject.class_id)
            .where(
                TeacherClassSubject.teacher_id == teacher_profile_id,
                TeacherClassSubject.deleted_at.is_(None),
                Class.deleted_at.is_(None),
            )
            .distinct()
        )
        class_ids: list[str] = []
        class_names: list[str] = []
        for row in result.all():
            class_ids.append(str(row.id))
            class_names.append(f"{row.name} {row.section or ''}".strip())
        return class_ids, class_names

    async def _get_teacher_profile_id(self, user_id: str, school_id: str) -> str | None:
        from app.models.teacher import Teacher

        result = await self.db.execute(
            select(Teacher.id).where(
                Teacher.user_id == user_id,
                Teacher.school_id == school_id,
                Teacher.deleted_at.is_(None),
            )
        )
        row = result.one_or_none()
        return str(row[0]) if row else None

    async def _get_student_profile_id(self, user_id: str, school_id: str) -> str | None:
        from app.models.student import Student

        result = await self.db.execute(
            select(Student.id).where(
                Student.user_id == user_id,
                Student.school_id == school_id,
                Student.deleted_at.is_(None),
            )
        )
        row = result.one_or_none()
        return str(row[0]) if row else None

    async def _get_student_class_id(self, student_profile_id: str) -> str | None:
        from app.models.student import Student

        result = await self.db.execute(
            select(Student.class_id).where(
                Student.id == student_profile_id,
                Student.deleted_at.is_(None),
            )
        )
        row = result.one_or_none()
        return str(row[0]) if row else None

    # ── Dashboard: Principal ────────────────────────────────────

    async def get_principal_dashboard(
        self,
        school_id: str,
        user_id: str,
    ) -> dict:
        """Compose principal dashboard data."""
        # Round-trip 1: Batch counts (students + teachers in one method)
        counts = await self._batch_counts(school_id, count_classes=False)
        total_students = counts.get("students", 0)
        total_teachers = counts.get("teachers", 0)

        # Round-trip 2: Attendance summary (via report repository)
        att = await report_queries.get_attendance_summary(
            self.db, school_id,
        )

        # Round-trip 3: Homework summary
        hw = await report_queries.get_homework_summary(
            self.db, school_id,
        )

        # Round-trip 4: Test summary
        test = await report_queries.get_test_summary(
            self.db, school_id,
        )

        # Round-trip 5: Announcements + unread notifications (batched)
        announcements = await self._get_recent_announcements(school_id)
        unread = await self._count_unread_notifications(user_id, school_id)

        return {
            "total_students": total_students,
            "total_teachers": total_teachers,
            "attendance_percentage": att["present_percentage"],
            "homework_completion_rate": hw["overall_completion_rate"],
            "test_pass_rate": test["overall_pass_rate"],
            "recent_announcements": announcements,
            "unread_notifications": {"count": unread},
        }

    # ── Dashboard: Teacher ──────────────────────────────────────

    async def get_teacher_dashboard(
        self,
        school_id: str,
        user_id: str,
    ) -> dict:
        """Compose teacher dashboard data."""
        teacher_profile_id = await self._get_teacher_profile_id(user_id, school_id)

        # Round-trip 1: Profile + class info (IDs + names in one query)
        class_names: list[str] = []
        class_ids: list[str] = []
        if teacher_profile_id:
            class_ids, class_names = await self._get_teacher_class_info(teacher_profile_id)

        # Round-trip 2: Today's schedule
        today_schedule = await self._get_teacher_today_schedule(teacher_profile_id or "", school_id)

        # Round-trip 3: Attendance pending — students in teacher's classes without today's attendance
        attendance_pending = 0
        if class_ids:
            attendance_pending = await self._count_attendance_pending(class_ids, school_id)

        # Round-trip 4: Homework pending review + upcoming tests
        homework_pending = await self._count_homework_pending_review(teacher_profile_id or "")
        upcoming_tests = await self._count_upcoming_tests_for_teacher(teacher_profile_id or "")

        # Round-trip 5: Unread notifications
        unread = await self._count_unread_notifications(user_id, school_id)

        return {
            "classes_assigned": class_names,
            "today_schedule": today_schedule,
            "attendance_pending_count": attendance_pending,
            "homework_pending_review": homework_pending,
            "upcoming_tests": upcoming_tests,
            "unread_notifications": {"count": unread},
        }

    async def _get_teacher_today_schedule(
        self, teacher_profile_id: str, school_id: str,
    ) -> list[dict]:
        """Get today's timetable for a teacher."""
        from app.models.timetable_entry import TimetableEntry
        from app.models.academic_class import Class
        from app.models.subject import Subject
        from app.models.period import Period

        py_day = date.today().weekday()
        if py_day == 6:
            day_of_week = 1
        else:
            day_of_week = py_day + 1

        result = await self.db.execute(
            select(
                Subject.name.label("subject_name"),
                Class.name.label("class_name"),
                Class.section.label("class_section"),
                Period.start_time,
                Period.end_time,
                Class.room_number,
            )
            .select_from(TimetableEntry)
            .join(Class, TimetableEntry.class_id == Class.id)
            .join(Subject, TimetableEntry.subject_id == Subject.id)
            .join(Period, TimetableEntry.period_id == Period.id)
            .where(
                TimetableEntry.teacher_id == teacher_profile_id,
                TimetableEntry.school_id == school_id,
                TimetableEntry.day_of_week == day_of_week,
                TimetableEntry.deleted_at.is_(None),
                Class.deleted_at.is_(None),
                Subject.deleted_at.is_(None),
                Period.deleted_at.is_(None),
            )
            .order_by(Period.start_time)
        )
        rows = result.all()
        return [
            {
                "subject_name": str(r.subject_name),
                "class_name": f"{r.class_name} {r.class_section or ''}".strip(),
                "start_time": str(r.start_time) if r.start_time else "",
                "end_time": str(r.end_time) if r.end_time else "",
                "room_number": r.room_number,
            }
            for r in rows
        ]

    async def _count_attendance_pending(
        self, class_ids: list[str], school_id: str,
    ) -> int:
        """Count students in the given classes without today's attendance record."""
        from app.models.student import Student
        from app.models.attendance import Attendance

        today = date.today()
        result = await self.db.execute(
            select(func.count(Student.id))
            .where(
                Student.class_id.in_(class_ids),
                Student.school_id == school_id,
                Student.is_active.is_(True),
                Student.deleted_at.is_(None),
                ~Student.id.in_(
                    select(Attendance.student_id).where(
                        Attendance.date == today,
                        Attendance.school_id == school_id,
                    )
                ),
            )
        )
        return result.scalar() or 0

    async def _count_homework_pending_review(self, teacher_profile_id: str) -> int:
        """Count homework submissions awaiting grading for a teacher."""
        from app.models.homework_submission import HomeworkSubmission
        from app.models.homework import Homework

        result = await self.db.execute(
            select(func.count(HomeworkSubmission.id))
            .select_from(HomeworkSubmission)
            .join(Homework, HomeworkSubmission.homework_id == Homework.id)
            .where(
                Homework.teacher_id == teacher_profile_id,
                HomeworkSubmission.is_graded.is_(False),
                HomeworkSubmission.status.in_(["submitted", "pending"]),
                Homework.deleted_at.is_(None),
            )
        )
        return result.scalar() or 0

    async def _count_upcoming_tests_for_teacher(self, teacher_profile_id: str) -> int:
        """Count upcoming (future) tests for a teacher."""
        from app.models.test import Test

        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(func.count(Test.id))
            .select_from(Test)
            .where(
                Test.teacher_id == teacher_profile_id,
                Test.scheduled_at > now,
                Test.deleted_at.is_(None),
            )
        )
        return result.scalar() or 0

    # ── Dashboard: Student ──────────────────────────────────────

    async def get_student_dashboard(
        self,
        school_id: str,
        user_id: str,
    ) -> dict:
        """Compose student dashboard data."""
        student_profile_id = await self._get_student_profile_id(user_id, school_id)

        # Round-trip 1: Profile info + class ID
        class_id = None
        if student_profile_id:
            class_id = await self._get_student_class_id(student_profile_id)

        # Round-trip 2: Today's timetable
        today_timetable: list[dict] = []
        # Round-trip 3: Homework due + upcoming tests
        homework_due: list[dict] = []
        upcoming_tests: list[dict] = []

        if class_id:
            today_timetable = await self._get_student_today_timetable(class_id, school_id)
            homework_due = await self._get_student_homework_due(class_id, school_id)
            upcoming_tests = await self._get_student_upcoming_tests(class_id, school_id)

        # Round-trip 4: Attendance percentage (pass None if no profile found)
        att_summary = await report_queries.get_attendance_summary(
            self.db, school_id, student_id=student_profile_id,
        )

        # Round-trip 5: Announcements + unread notifications
        announcements = await self._get_recent_announcements(school_id)
        unread = await self._count_unread_notifications(user_id, school_id)

        return {
            "today_timetable": today_timetable,
            "homework_due": homework_due,
            "upcoming_tests": upcoming_tests,
            "attendance_percentage": att_summary["present_percentage"],
            "recent_announcements": announcements,
            "unread_notifications": {"count": unread},
        }

    async def _get_student_today_timetable(
        self, class_id: str, school_id: str,
    ) -> list[dict]:
        """Get today's timetable for a student's class."""
        from app.models.timetable_entry import TimetableEntry
        from app.models.subject import Subject
        from app.models.period import Period

        py_day = date.today().weekday()
        if py_day == 6:
            day_of_week = 1
        else:
            day_of_week = py_day + 1

        result = await self.db.execute(
            select(
                Subject.name.label("subject_name"),
                Period.start_time,
                Period.end_time,
            )
            .select_from(TimetableEntry)
            .join(Subject, TimetableEntry.subject_id == Subject.id)
            .join(Period, TimetableEntry.period_id == Period.id)
            .where(
                TimetableEntry.class_id == class_id,
                TimetableEntry.school_id == school_id,
                TimetableEntry.day_of_week == day_of_week,
                TimetableEntry.deleted_at.is_(None),
                Subject.deleted_at.is_(None),
                Period.deleted_at.is_(None),
            )
            .order_by(Period.start_time)
        )
        rows = result.all()
        return [
            {
                "subject_name": str(r.subject_name),
                "class_name": "",
                "start_time": str(r.start_time) if r.start_time else "",
                "end_time": str(r.end_time) if r.end_time else "",
                "room_number": None,
            }
            for r in rows
        ]

    async def _get_student_homework_due(
        self, class_id: str, school_id: str, limit: int = 10,
    ) -> list[dict]:
        """Get upcoming homework for a student's class."""
        from app.models.homework import Homework
        from app.models.subject import Subject

        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(Homework.id, Homework.title, Homework.due_date, Subject.name.label("subject_name"))
            .join(Subject, Homework.subject_id == Subject.id)
            .where(
                Homework.class_id == class_id,
                Homework.school_id == school_id,
                Homework.is_published.is_(True),
                Homework.due_date > now,
                Homework.deleted_at.is_(None),
                Subject.deleted_at.is_(None),
            )
            .order_by(Homework.due_date)
            .limit(limit)
        )
        rows = result.all()
        return [
            {
                "id": str(r.id),
                "title": str(r.title),
                "subject_name": str(r.subject_name),
                "due_date": r.due_date.isoformat() if r.due_date else "",
                "days_remaining": (r.due_date - now).days if r.due_date else 0,
            }
            for r in rows
        ]

    async def _get_student_upcoming_tests(
        self, class_id: str, school_id: str, limit: int = 10,
    ) -> list[dict]:
        """Get upcoming tests for a student's class."""
        from app.models.test import Test
        from app.models.subject import Subject

        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(Test.id, Test.title, Test.scheduled_at, Test.total_marks, Subject.name.label("subject_name"))
            .join(Subject, Test.subject_id == Subject.id)
            .where(
                Test.class_id == class_id,
                Test.school_id == school_id,
                Test.is_published.is_(True),
                Test.scheduled_at > now,
                Test.deleted_at.is_(None),
                Subject.deleted_at.is_(None),
            )
            .order_by(Test.scheduled_at)
            .limit(limit)
        )
        rows = result.all()
        return [
            {
                "id": str(r.id),
                "title": str(r.title),
                "subject_name": str(r.subject_name),
                "scheduled_at": r.scheduled_at.isoformat() if r.scheduled_at else None,
                "total_marks": float(r.total_marks) if r.total_marks else 0.0,
            }
            for r in rows
        ]

    # ── Dashboard: Parent ────────────────────────────────────────

    async def get_parent_dashboard(
        self,
        school_id: str,
        user_id: str,
    ) -> dict:
        """Compose parent dashboard data.

        Shows school-wide attendance percentage, recent announcements,
        and unread notifications. Child-specific data will be added
        when parent-child linking is implemented.
        """
        # Round-trip 1: Attendance summary
        att = await report_queries.get_attendance_summary(
            self.db, school_id,
        )

        # Round-trip 2: Announcements + unread notifications
        announcements = await self._get_recent_announcements(school_id)
        unread = await self._count_unread_notifications(user_id, school_id)

        return {
            "attendance_percentage": att["present_percentage"],
            "recent_announcements": announcements,
            "unread_notifications": {"count": unread},
        }

    # ── Dashboard: Admin ────────────────────────────────────────

    async def get_admin_dashboard(
        self,
        school_id: str,
        user_id: str,
    ) -> dict:
        """Compose school admin dashboard data."""
        # Round-trip 1: Batch counts (students + teachers + classes in one method)
        counts = await self._batch_counts(school_id, count_students=True, count_teachers=True, count_classes=True)
        total_students = counts.get("students", 0)
        total_teachers = counts.get("teachers", 0)
        total_parents = counts.get("parents", 0)
        active_classes = counts.get("classes", 0)

        # Round-trip 2: Attendance summary
        att = await report_queries.get_attendance_summary(
            self.db, school_id,
        )

        # Round-trip 3: Announcements + unread (batched in same round)
        announcements = await self._get_recent_announcements(school_id)
        unread = await self._count_unread_notifications(user_id, school_id)

        return {
            "total_students": total_students,
            "total_teachers": total_teachers,
            "total_parents": total_parents,
            "active_classes": active_classes,
            "attendance_percentage": att["present_percentage"],
            "recent_announcements": announcements,
            "unread_notifications": {"count": unread},
        }
