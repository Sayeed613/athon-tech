"""Report service — business logic for reporting and analytics.

Provides:
    - Attendance reports (present %, absent %, monthly trends)
    - Homework reports (completion rate, missing submissions)
    - Test reports (average, highest, lowest, pass rate)
    - Student summary (consolidated attendance + homework + tests)
    - Class summary (consolidated class-level metrics)
    - Teacher summary (consolidated teacher-level metrics)
    - Role-based permission checks for all report types

All data aggregation is delegated to `app.repository.reports` module functions.
"""

from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.repository import reports as report_queries


class ReportService:
    """Service for generating reports with role-based access control."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_teacher_class_ids(
        self, teacher_id: str, school_id: str,
    ) -> list[str]:
        """Get the set of class IDs a teacher is assigned to."""
        from app.models.teacher import Teacher
        from app.models.teacher_class_subject import TeacherClassSubject
        from sqlalchemy import select

        # Get teacher profile
        result = await self.db.execute(
            select(Teacher).where(
                Teacher.user_id == teacher_id,
                Teacher.school_id == school_id,
                Teacher.deleted_at.is_(None),
            )
        )
        teacher = result.scalar_one_or_none()
        if teacher is None:
            return []

        # Get class IDs from TeacherClassSubject assignments
        tcs_result = await self.db.execute(
            select(TeacherClassSubject.class_id).where(
                TeacherClassSubject.teacher_id == teacher.id,
                TeacherClassSubject.deleted_at.is_(None),
            ).distinct()
        )
        return [str(row[0]) for row in tcs_result.all()]

    async def _get_student_class_id(
        self, student_id: str,
    ) -> str | None:
        """Get the class ID for a student."""
        from app.models.student import Student
        from sqlalchemy import select

        result = await self.db.execute(
            select(Student.class_id).where(
                Student.id == student_id,
                Student.deleted_at.is_(None),
            )
        )
        row = result.one_or_none()
        return str(row[0]) if row else None

    async def _get_teacher_profile_id(
        self, user_id: str, school_id: str,
    ) -> str | None:
        """Resolve a user_id to a teacher profile ID (UUID from teachers table)."""
        from app.models.teacher import Teacher
        from sqlalchemy import select

        result = await self.db.execute(
            select(Teacher.id).where(
                Teacher.user_id == user_id,
                Teacher.school_id == school_id,
                Teacher.deleted_at.is_(None),
            )
        )
        row = result.one_or_none()
        return str(row[0]) if row else None

    async def _get_student_profile_id(
        self, user_id: str, school_id: str,
    ) -> str | None:
        """Resolve a user_id to a student profile ID."""
        from app.models.student import Student
        from sqlalchemy import select

        result = await self.db.execute(
            select(Student.id).where(
                Student.user_id == user_id,
                Student.school_id == school_id,
                Student.deleted_at.is_(None),
            )
        )
        row = result.one_or_none()
        return str(row[0]) if row else None

    # ── Permission Checks ───────────────────────────────────────

    async def check_can_view_student_report(
        self,
        user_id: str,
        user_role: str,
        school_id: str,
        target_student_id: str,
    ) -> bool:
        """Check if a user can view a specific student's report."""
        # Principal/Admin — can view any student
        if user_role in ("principal", "school_admin", "super_admin"):
            return True

        # Teacher — can view if student is in a class they teach
        if user_role == "teacher":
            student_class_id = await self._get_student_class_id(target_student_id)
            if student_class_id is None:
                return False
            teacher_class_ids = await self._get_teacher_class_ids(user_id, school_id)
            return student_class_id in teacher_class_ids

        # Student — can only view their own report
        if user_role == "student":
            own_student_id = await self._get_student_profile_id(user_id, school_id)
            return own_student_id == target_student_id

        # Parent — delegated to parent dashboard logic
        return False

    async def check_can_view_class_report(
        self,
        user_id: str,
        user_role: str,
        school_id: str,
        target_class_id: str,
    ) -> bool:
        """Check if a user can view a class report."""
        if user_role in ("principal", "school_admin", "super_admin"):
            return True
        if user_role == "teacher":
            teacher_class_ids = await self._get_teacher_class_ids(user_id, school_id)
            return target_class_id in teacher_class_ids
        return False

    async def check_can_view_teacher_report(
        self,
        user_id: str,
        user_role: str,
        school_id: str,
        target_teacher_id: str,
    ) -> bool:
        """Check if a user can view a teacher's report."""
        if user_role in ("principal", "school_admin", "super_admin"):
            return True
        # Teachers can only see their own report
        if user_role == "teacher":
            own_teacher_id = await self._get_teacher_profile_id(user_id, school_id)
            return own_teacher_id == target_teacher_id
        return False

    # ── Attendance Report ────────────────────────────────────────

    async def get_attendance_report(
        self,
        school_id: str,
        *,
        class_id: str | None = None,
        student_id: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict:
        """Generate an attendance report."""
        scope_id = student_id or class_id or school_id
        scope_type = "student" if student_id else ("class" if class_id else "school")

        summary = await report_queries.get_attendance_summary(
            self.db,
            school_id,
            class_id=class_id,
            student_id=student_id,
            start_date=start_date,
            end_date=end_date,
        )

        return {
            "school_id": school_id,
            "scope_id": scope_id,
            "scope_type": scope_type,
            **summary,
        }

    # ── Homework Report ─────────────────────────────────────────

    async def get_homework_report(
        self,
        school_id: str,
        *,
        class_id: str | None = None,
        student_id: str | None = None,
        teacher_id: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict:
        """Generate a homework report."""
        scope_id = student_id or teacher_id or class_id or school_id
        scope_type = (
            "student" if student_id
            else ("teacher" if teacher_id else "class" if class_id else "school")
        )

        summary = await report_queries.get_homework_summary(
            self.db,
            school_id,
            class_id=class_id,
            student_id=student_id,
            teacher_id=teacher_id,
            start_date=start_date,
            end_date=end_date,
        )

        return {
            "school_id": school_id,
            "scope_id": scope_id,
            "scope_type": scope_type,
            **summary,
        }

    # ── Test Report ─────────────────────────────────────────────

    async def get_test_report(
        self,
        school_id: str,
        *,
        class_id: str | None = None,
        student_id: str | None = None,
        teacher_id: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict:
        """Generate a test report."""
        scope_id = student_id or teacher_id or class_id or school_id
        scope_type = (
            "student" if student_id
            else ("teacher" if teacher_id else "class" if class_id else "school")
        )

        summary = await report_queries.get_test_summary(
            self.db,
            school_id,
            class_id=class_id,
            student_id=student_id,
            teacher_id=teacher_id,
            start_date=start_date,
            end_date=end_date,
        )

        return {
            "school_id": school_id,
            "scope_id": scope_id,
            "scope_type": scope_type,
            **summary,
        }

    # ── Student Summary ─────────────────────────────────────────

    async def get_student_summary(
        self,
        school_id: str,
        student_id: str,
    ) -> dict:
        """Generate a consolidated student summary report."""
        from app.models.student import Student
        from app.models.academic_class import Class
        from app.models.homework import Homework
        from app.models.homework_submission import HomeworkSubmission
        from app.models.test import Test
        from app.models.test_attempt import TestAttempt
        from app.models.user import User
        from sqlalchemy import select, func

        # Get student info with user name
        student_result = await self.db.execute(
            select(Student, Class.name.label("class_name"), User.first_name, User.last_name)
            .join(Class, Student.class_id == Class.id)
            .join(User, Student.user_id == User.id)
            .where(
                Student.id == student_id,
                Student.school_id == school_id,
                Student.deleted_at.is_(None),
            )
        )
        student_row = student_result.one_or_none()
        if student_row is None:
            return {}

        student = student_row[0]
        class_name = student_row.class_name or ""
        student_name = f"{student_row.first_name} {student_row.last_name}".strip()

        # Attendance summary
        att = await report_queries.get_attendance_summary(
            self.db, school_id, student_id=student_id,
        )

        # Homework: count assigned vs submitted
        hw_result = await self.db.execute(
            select(func.count(Homework.id)).where(
                Homework.class_id == student.class_id,
                Homework.school_id == school_id,
                Homework.is_published.is_(True),
                Homework.deleted_at.is_(None),
            )
        )
        total_homeworks = hw_result.scalar() or 0

        sub_result = await self.db.execute(
            select(func.count(HomeworkSubmission.id)).where(
                HomeworkSubmission.student_id == student_id,
                HomeworkSubmission.school_id == school_id,
            )
        )
        submitted = sub_result.scalar() or 0

        avg_score = await report_queries.get_student_homework_average(self.db, student_id)

        # Test summary
        test_summary = await report_queries.get_student_test_summary(
            self.db, student_id, school_id,
        )

        # Count tests assigned to the student's class
        test_count_result = await self.db.execute(
            select(func.count(Test.id)).where(
                Test.class_id == student.class_id,
                Test.school_id == school_id,
                Test.is_published.is_(True),
                Test.deleted_at.is_(None),
            )
        )
        tests_total = test_count_result.scalar() or 0

        return {
            "student_id": student_id,
            "student_name": student_name,
            "class_id": str(student.class_id),
            "class_name": class_name,
            "attendance_present_percentage": att["present_percentage"],
            "attendance_absent_percentage": att["absent_percentage"],
            "attendance_total_records": att["total_records"],
            "homework_total_assigned": total_homeworks,
            "homework_submitted": submitted,
            "homework_completion_rate": round((submitted / total_homeworks) * 100, 2) if total_homeworks > 0 else 0.0,
            "homework_average_score": avg_score,
            "tests_total": tests_total,
            "tests_attempted": test_summary["attempted"],
            "tests_average_score": test_summary["average_score"],
            "tests_highest_score": test_summary["highest_score"],
            "tests_pass_rate": test_summary["pass_rate"],
        }

    # ── Class Summary ───────────────────────────────────────────

    async def get_class_summary(
        self,
        school_id: str,
        class_id: str,
    ) -> dict:
        """Generate a consolidated class summary report."""
        from app.models.student import Student
        from app.models.academic_class import Class
        from sqlalchemy import select, func

        # Get class info
        class_result = await self.db.execute(
            select(Class).where(
                Class.id == class_id,
                Class.school_id == school_id,
                Class.deleted_at.is_(None),
            )
        )
        cls = class_result.scalar_one_or_none()
        if cls is None:
            return {}

        # Count active students
        student_count = await self.db.execute(
            select(func.count(Student.id)).where(
                Student.class_id == class_id,
                Student.is_active.is_(True),
                Student.deleted_at.is_(None),
            )
        )
        total_students = student_count.scalar() or 0

        # Attendance
        att = await report_queries.get_attendance_summary(
            self.db, school_id, class_id=class_id,
        )

        # Homework
        hw = await report_queries.get_homework_summary(
            self.db, school_id, class_id=class_id,
        )

        # Tests
        test = await report_queries.get_test_summary(
            self.db, school_id, class_id=class_id,
        )

        return {
            "class_id": class_id,
            "class_name": f"{cls.name} {cls.section or ''}".strip(),
            "school_id": school_id,
            "total_students": total_students,
            "attendance_present_percentage": att["present_percentage"],
            "attendance_absent_percentage": att["absent_percentage"],
            "homework_total_assigned": hw["total_homeworks"],
            "homework_overall_completion": hw["overall_completion_rate"],
            "tests_total": test["total_tests"],
            "tests_overall_average": test["overall_average_score"],
            "tests_overall_pass_rate": test["overall_pass_rate"],
        }

    # ── Teacher Summary ─────────────────────────────────────────

    async def get_teacher_summary(
        self,
        school_id: str,
        teacher_id: str,
    ) -> dict:
        """Generate a consolidated teacher summary report."""
        from app.models.teacher import Teacher
        from app.models.academic_class import Class
        from sqlalchemy import select, func

        # Get teacher info
        teacher_result = await self.db.execute(
            select(Teacher).where(
                Teacher.id == teacher_id,
                Teacher.school_id == school_id,
                Teacher.deleted_at.is_(None),
            )
        )
        teacher = teacher_result.scalar_one_or_none()
        if teacher is None:
            return {}

        # Get teacher's user name
        from app.models.user import User

        user_result = await self.db.execute(
            select(User).where(User.id == teacher.user_id)
        )
        user = user_result.scalar_one_or_none()
        teacher_name = f"{user.first_name} {user.last_name}" if user else ""

        # Get assigned class names
        from app.models.teacher_class_subject import TeacherClassSubject

        class_result = await self.db.execute(
            select(Class.name, Class.section)
            .join(TeacherClassSubject, Class.id == TeacherClassSubject.class_id)
            .where(
                TeacherClassSubject.teacher_id == teacher_id,
                TeacherClassSubject.deleted_at.is_(None),
                Class.deleted_at.is_(None),
            )
            .distinct()
        )
        class_names = [
            f"{row.name} {row.section or ''}".strip()
            for row in class_result.all()
        ]
        class_ids = await self._get_teacher_class_ids(user.id if user else "", school_id)

        # Homework
        hw = await report_queries.get_homework_summary(
            self.db, school_id, teacher_id=teacher_id,
        )

        # Tests
        test = await report_queries.get_test_summary(
            self.db, school_id, teacher_id=teacher_id,
        )

        return {
            "teacher_id": teacher_id,
            "teacher_name": teacher_name,
            "school_id": school_id,
            "assigned_classes": class_ids,
            "assigned_class_names": class_names,
            "homeworks_created": hw["total_homeworks"],
            "homeworks_graded": sum(h["graded_count"] for h in hw["per_homework"]),
            "overall_homework_completion": hw["overall_completion_rate"],
            "tests_created": test["total_tests"],
            "tests_graded": sum(
                1 for pt in test["per_test"] if pt["attempted_count"] > 0
            ),
            "average_test_score": test["overall_average_score"],
            "overall_test_pass_rate": test["overall_pass_rate"],
        }
