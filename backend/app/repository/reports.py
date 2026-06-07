"""Report repository — data aggregation queries for reporting and analytics.

All queries operate on existing domain tables (attendance, homeworks,
homework_submissions, tests, test_attempts) using SQLAlchemy aggregate
functions. School-scoped for tenant isolation.

This repository does **not** extend BaseRepository because it reads
across multiple unrelated models and returns aggregate result sets
rather than ORM instances.
"""

from datetime import date, datetime, timezone

from sqlalchemy import func, select, case, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance
from app.models.homework import Homework
from app.models.homework_submission import HomeworkSubmission
from app.models.test import Test
from app.models.test_attempt import TestAttempt


# ── Attendance Aggregations ─────────────────────────────────────-


async def get_attendance_summary(
    db: AsyncSession,
    school_id: str,
    *,
    class_id: str | None = None,
    student_id: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    """Aggregate attendance records into summary metrics.

    Returns a dict with:
        total_records, present_count, absent_count,
        present_percentage, absent_percentage, monthly_trends
    """
    conditions = [Attendance.school_id == school_id]

    if class_id is not None:
        conditions.append(Attendance.class_id == class_id)
    if student_id is not None:
        conditions.append(Attendance.student_id == student_id)
    if start_date is not None:
        conditions.append(Attendance.date >= start_date)
    if end_date is not None:
        conditions.append(Attendance.date <= end_date)

    # Overall counts
    present_case = case(
        (Attendance.status.in_(["present", "late", "half_day"]), 1),
        else_=0,
    )
    absent_case = case(
        (Attendance.status == "absent", 1),
        else_=0,
    )

    count_query = select(
        func.count(Attendance.id).label("total_records"),
        func.coalesce(func.sum(present_case), 0).label("present_count"),
        func.coalesce(func.sum(absent_case), 0).label("absent_count"),
    ).where(*conditions)

    result = await db.execute(count_query)
    row = result.one()

    total_records = int(row.total_records)
    present_count = int(row.present_count)
    absent_count = int(row.absent_count)

    present_pct = 0.0
    absent_pct = 0.0
    if total_records > 0:
        present_pct = round((present_count / total_records) * 100, 2)
        absent_pct = round((absent_count / total_records) * 100, 2)

    # Monthly trends — use date_trunc with text() literal
    # PostgreSQL requires the first arg to date_trunc to be a string literal, not a bound parameter
    month_trunc = func.date_trunc(text("'month'"), Attendance.date)
    month_query = (
        select(
            month_trunc.label("month_start"),
            func.coalesce(func.sum(present_case), 0).label("present_count"),
            func.coalesce(func.sum(absent_case), 0).label("absent_count"),
            func.count(Attendance.id).label("total_count"),
        )
        .where(*conditions)
        .group_by(month_trunc)
        .order_by(month_trunc)
    )

    month_result = await db.execute(month_query)
    monthly_trends = []
    for mrow in month_result:
        m_present = int(mrow.present_count)
        m_absent = int(mrow.absent_count)
        m_total = int(mrow.total_count)
        m_pct = round((m_present / m_total) * 100, 2) if m_total > 0 else 0.0
        month_label = str(mrow.month_start)[:7] if mrow.month_start else ""
        monthly_trends.append({
            "month": month_label,
            "present_count": m_present,
            "absent_count": m_absent,
            "total_count": m_total,
            "present_percentage": m_pct,
        })

    return {
        "total_records": total_records,
        "present_count": present_count,
        "absent_count": absent_count,
        "present_percentage": present_pct,
        "absent_percentage": absent_pct,
        "monthly_trends": monthly_trends,
    }


# ── Homework Aggregations ────────────────────────────────────────


async def get_homework_summary(
    db: AsyncSession,
    school_id: str,
    *,
    class_id: str | None = None,
    student_id: str | None = None,
    teacher_id: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    """Aggregate homework and submission data into summary metrics.

    Returns a dict with:
        total_homeworks, total_submissions, missing_submissions,
        overall_completion_rate, per_homework
    """
    hw_conditions = [Homework.school_id == school_id, Homework.is_published.is_(True)]
    if class_id is not None:
        hw_conditions.append(Homework.class_id == class_id)
    if teacher_id is not None:
        hw_conditions.append(Homework.teacher_id == teacher_id)
    if start_date is not None:
        hw_conditions.append(Homework.due_date >= start_date)
    if end_date is not None:
        hw_conditions.append(Homework.due_date <= end_date)

    # Get all matching homeworks with submission counts
    sub_count_subq = (
        select(
            HomeworkSubmission.homework_id,
            func.count(HomeworkSubmission.id).label("sub_count"),
            func.count(case((HomeworkSubmission.is_graded.is_(True), 1), else_=0)).label("graded_count"),
        )
        .group_by(HomeworkSubmission.homework_id)
        .subquery()
    )

    query = (
        select(
            Homework.id,
            Homework.title,
            Homework.max_score,
            Homework.class_id,
            func.coalesce(sub_count_subq.c.sub_count, 0).label("submitted_count"),
            func.coalesce(sub_count_subq.c.graded_count, 0).label("graded_count"),
        )
        .outerjoin(sub_count_subq, Homework.id == sub_count_subq.c.homework_id)
        .where(*hw_conditions)
        .order_by(Homework.due_date.desc())
    )

    result = await db.execute(query)
    rows = result.all()

    total_homeworks = len(rows)
    total_submissions = sum(int(r.submitted_count) for r in rows)

    # Batch-fetch student counts per class to avoid N+1 queries
    class_ids = list({str(r.class_id) for r in rows})
    student_counts = await _count_students_in_classes(db, class_ids)

    per_homework_list = []
    for r in rows:
        student_count = student_counts.get(str(r.class_id), 0)
        missing = max(0, student_count - int(r.submitted_count))
        completion = round((int(r.submitted_count) / student_count) * 100, 2) if student_count > 0 else 0.0
        per_homework_list.append({
            "homework_id": str(r.id),
            "title": str(r.title),
            "max_score": float(r.max_score) if r.max_score else 0.0,
            "total_students": student_count,
            "submitted_count": int(r.submitted_count),
            "graded_count": int(r.graded_count),
            "completion_rate": completion,
        })

    total_estimated_students = sum(h["total_students"] for h in per_homework_list)
    total_assigned = total_estimated_students
    missing_submissions = max(0, total_assigned - total_submissions)
    overall_completion = round((total_submissions / total_assigned) * 100, 2) if total_assigned > 0 else 0.0

    return {
        "total_homeworks": total_homeworks,
        "total_submissions": total_submissions,
        "missing_submissions": missing_submissions,
        "overall_completion_rate": overall_completion,
        "per_homework": per_homework_list,
    }


# ── Test Aggregations ────────────────────────────────────────────


async def get_test_summary(
    db: AsyncSession,
    school_id: str,
    *,
    class_id: str | None = None,
    student_id: str | None = None,
    teacher_id: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    """Aggregate test and attempt data into summary metrics.

    Returns a dict with:
        total_tests, total_attempts, overall_average_score,
        overall_highest_score, overall_lowest_score,
        overall_pass_rate, per_test
    """
    test_conditions = [Test.school_id == school_id, Test.is_published.is_(True)]
    if class_id is not None:
        test_conditions.append(Test.class_id == class_id)
    if teacher_id is not None:
        test_conditions.append(Test.teacher_id == teacher_id)
    if start_date is not None:
        test_conditions.append(Test.scheduled_at >= start_date)
    if end_date is not None:
        test_conditions.append(Test.scheduled_at <= end_date)

    # Subquery for attempt stats per test
    attempt_stats_subq = (
        select(
            TestAttempt.test_id,
            func.count(TestAttempt.id).label("attempt_count"),
            func.avg(TestAttempt.total_score).label("avg_score"),
            func.max(TestAttempt.total_score).label("max_score"),
            func.min(TestAttempt.total_score).label("min_score"),
        )
        .where(TestAttempt.total_score.isnot(None))
        .group_by(TestAttempt.test_id)
        .subquery()
    )

    query = (
        select(
            Test.id,
            Test.title,
            Test.total_marks,
            Test.passing_percentage,
            Test.class_id,
            func.coalesce(attempt_stats_subq.c.attempt_count, 0).label("attempt_count"),
            attempt_stats_subq.c.avg_score,
            attempt_stats_subq.c.max_score,
            attempt_stats_subq.c.min_score,
        )
        .outerjoin(attempt_stats_subq, Test.id == attempt_stats_subq.c.test_id)
        .where(*test_conditions)
        .order_by(Test.scheduled_at.desc().nullslast())
    )

    result = await db.execute(query)
    rows = result.all()

    total_tests = len(rows)
    total_attempts = sum(int(r.attempt_count) for r in rows)

    per_test_list = []
    all_scores: list[float] = []
    pass_count_total = 0

    # Batch-fetch student counts per class to avoid N+1 queries
    class_ids = list({str(r.class_id) for r in rows})
    student_counts = await _count_students_in_classes(db, class_ids)

    for r in rows:
        student_count = student_counts.get(str(r.class_id), 0)
        avg = float(r.avg_score) if r.avg_score is not None else 0.0
        hi = float(r.max_score) if r.max_score is not None else 0.0
        lo = float(r.min_score) if r.min_score is not None else 0.0
        attempted = int(r.attempt_count)
        passing = float(r.passing_percentage) if r.passing_percentage else 40.0
        total_marks = float(r.total_marks) if r.total_marks else 0.0
        pass_mark = (passing / 100.0) * total_marks if total_marks > 0 else 0.0

        # Count passing attempts
        pass_count = 0
        if attempted > 0 and total_marks > 0:
            pass_result = await db.execute(
                select(func.count(TestAttempt.id)).where(
                    TestAttempt.test_id == r.id,
                    TestAttempt.total_score.isnot(None),
                    TestAttempt.total_score >= pass_mark,
                )
            )
            pass_count = pass_result.scalar() or 0
            pass_count_total += pass_count
            if avg > 0:
                all_scores.append(avg)

        pass_rate = round((pass_count / attempted) * 100, 2) if attempted > 0 else 0.0

        per_test_list.append({
            "test_id": str(r.id),
            "title": str(r.title),
            "total_marks": total_marks,
            "total_students": student_count,
            "attempted_count": attempted,
            "average_score": avg,
            "highest_score": hi,
            "lowest_score": lo,
            "pass_count": pass_count,
            "pass_rate": pass_rate,
        })

    overall_avg = round(
        sum(pt["average_score"] for pt in per_test_list) / len(per_test_list), 2
    ) if per_test_list else 0.0

    overall_hi = max(pt["highest_score"] for pt in per_test_list) if per_test_list else 0.0
    overall_lo = min(pt["lowest_score"] for pt in per_test_list) if per_test_list else 0.0
    overall_pass_rate = round((pass_count_total / total_attempts) * 100, 2) if total_attempts > 0 else 0.0

    return {
        "total_tests": total_tests,
        "total_attempts": total_attempts,
        "overall_average_score": overall_avg,
        "overall_highest_score": overall_hi,
        "overall_lowest_score": overall_lo,
        "overall_pass_rate": overall_pass_rate,
        "per_test": per_test_list,
    }


# ── Student Totals (batch helper) ───────────────────────────────


async def _count_students_in_class(db: AsyncSession, class_id: str) -> int:
    """Count active students enrolled in a single class (single-query convenience)."""
    counts = await _count_students_in_classes(db, [class_id])
    return counts.get(class_id, 0)


async def _count_students_in_classes(
    db: AsyncSession, class_ids: list[str],
) -> dict[str, int]:
    """Count active students for multiple classes in one query.

    Returns {class_id: count} mapping. Avoids N+1 queries
    when generating per-homework/per-test student counts.
    """
    from app.models.student import Student

    if not class_ids:
        return {}

    result = await db.execute(
        select(
            Student.class_id,
            func.count(Student.id).label("cnt"),
        ).where(
            Student.class_id.in_(class_ids),
            Student.is_active.is_(True),
            Student.deleted_at.is_(None),
        ).group_by(Student.class_id)
    )
    return {str(row.class_id): int(row.cnt) for row in result.all()}


async def get_student_homework_average(
    db: AsyncSession, student_id: str,
) -> float:
    """Calculate the average score across graded homework submissions for a student."""
    result = await db.execute(
        select(func.avg(HomeworkSubmission.total_score)).where(
            HomeworkSubmission.student_id == student_id,
            HomeworkSubmission.is_graded.is_(True),
            HomeworkSubmission.total_score.isnot(None),
        )
    )
    avg = result.scalar()
    return round(float(avg), 2) if avg else 0.0


async def get_student_test_summary(
    db: AsyncSession, student_id: str, school_id: str,
) -> dict:
    """Get test summary for a single student."""
    result = await db.execute(
        select(
            func.count(TestAttempt.id).label("attempted"),
            func.avg(TestAttempt.total_score).label("avg_score"),
            func.max(TestAttempt.total_score).label("max_score"),
        ).where(
            TestAttempt.student_id == student_id,
            TestAttempt.school_id == school_id,
            TestAttempt.total_score.isnot(None),
        )
    )
    row = result.one()

    attempted = int(row.attempted)
    avg = float(row.avg_score) if row.avg_score else 0.0
    hi = float(row.max_score) if row.max_score else 0.0

    # Pass count
    pass_result = await db.execute(
        select(func.count(TestAttempt.id)).where(
            TestAttempt.student_id == student_id,
            TestAttempt.school_id == school_id,
            TestAttempt.total_score.isnot(None),
        )
    )
    total_graded = pass_result.scalar() or 0

    # Count passing — need to check each attempt's score against its test's passing_percentage
    # For simplicity, use a subquery
    pass_query = (
        select(func.count(TestAttempt.id))
        .join(Test, TestAttempt.test_id == Test.id)
        .where(
            TestAttempt.student_id == student_id,
            TestAttempt.school_id == school_id,
            TestAttempt.total_score.isnot(None),
            TestAttempt.total_score
            >= (Test.passing_percentage / 100.0) * Test.total_marks,
        )
    )
    pass_result2 = await db.execute(pass_query)
    pass_count = pass_result2.scalar() or 0
    pass_rate = round((pass_count / total_graded) * 100, 2) if total_graded > 0 else 0.0

    return {
        "attempted": attempted,
        "average_score": round(avg, 2),
        "highest_score": round(hi, 2),
        "pass_rate": pass_rate,
    }
