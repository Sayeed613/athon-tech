"""Report Pydantic schemas — response models for analytics and reporting endpoints.

Each report type has its own response schema with the relevant metrics.
All responses include school_id for tenant-scoped aggregation.
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


# ── Shared ──────────────────────────────────────────────────────


class DateRangeFilter(BaseModel):
    """Optional date range filter for reports."""

    start_date: date | None = None
    end_date: date | None = None


# ── Attendance Report ────────────────────────────────────────────


class AttendanceMonthlyTrend(BaseModel):
    """Per-month attendance summary."""

    month: str = Field(..., description="Year-month label (e.g. 2026-01)")
    present_count: int = Field(0, description="Days with present/late/half_day")
    absent_count: int = Field(0, description="Days with absent")
    total_count: int = Field(0, description="Total attendance days")
    present_percentage: float = Field(0.0, description="(present+late+half_day) / total * 100")


class AttendanceReportResponse(BaseModel):
    """Attendance report for a class, student, or school."""

    school_id: str = Field(..., description="Tenant scope")
    scope_id: str = Field(..., description="UUID of the scope (class/student/school)")
    scope_type: str = Field(..., description="class, student, or school")
    total_records: int = Field(0, description="Total attendance records")
    present_count: int = Field(0, description="Present + late + half_day count")
    absent_count: int = Field(0, description="Absent count")
    present_percentage: float = Field(0.0, description="(present+late+half_day) / total * 100")
    absent_percentage: float = Field(0.0, description="absent / total * 100")
    monthly_trends: list[AttendanceMonthlyTrend] = Field(
        default_factory=list, description="Per-month breakdown"
    )


# ── Homework Report ──────────────────────────────────────────────


class HomeworkPerHomework(BaseModel):
    """Per-homework summary within a report."""

    homework_id: str = Field(..., description="Homework UUID")
    title: str = Field(..., description="Homework title")
    max_score: float = Field(0.0, description="Maximum possible score")
    total_students: int = Field(0, description="Number of students assigned")
    submitted_count: int = Field(0, description="Number of submissions")
    graded_count: int = Field(0, description="Number of graded submissions")
    completion_rate: float = Field(0.0, description="submitted / total_students * 100")


class HomeworkReportResponse(BaseModel):
    """Homework report for a class, student, or teacher."""

    school_id: str = Field(..., description="Tenant scope")
    scope_id: str = Field(..., description="UUID of the scope")
    scope_type: str = Field(..., description="class, student, or teacher")
    total_homeworks: int = Field(0, description="Total homework assignments")
    total_submissions: int = Field(0, description="Total submissions across all homeworks")
    missing_submissions: int = Field(0, description="Assigned but not submitted")
    overall_completion_rate: float = Field(0.0, description="submissions / assigned * 100")
    per_homework: list[HomeworkPerHomework] = Field(
        default_factory=list, description="Breakdown per homework"
    )


# ── Test Report ──────────────────────────────────────────────────


class TestPerTest(BaseModel):
    """Per-test summary within a report."""

    test_id: str = Field(..., description="Test UUID")
    title: str = Field(..., description="Test title")
    total_marks: float = Field(0.0, description="Maximum marks")
    total_students: int = Field(0, description="Number of students assigned")
    attempted_count: int = Field(0, description="Number of attempts")
    average_score: float = Field(0.0, description="Mean score among attempts")
    highest_score: float = Field(0.0, description="Highest achieved score")
    lowest_score: float = Field(0.0, description="Lowest achieved score")
    pass_count: int = Field(0, description="Number of students who passed")
    pass_rate: float = Field(0.0, description="pass_count / attempted_count * 100")


class TestReportResponse(BaseModel):
    """Test report for a class, student, or teacher."""

    school_id: str = Field(..., description="Tenant scope")
    scope_id: str = Field(..., description="UUID of the scope")
    scope_type: str = Field(..., description="class, student, or teacher")
    total_tests: int = Field(0, description="Total published tests")
    total_attempts: int = Field(0, description="Total attempts across all tests")
    overall_average_score: float = Field(0.0, description="Mean score across all graded attempts")
    overall_highest_score: float = Field(0.0, description="Highest score across all tests")
    overall_lowest_score: float = Field(0.0, description="Lowest score across all tests")
    overall_pass_rate: float = Field(0.0, description="Passing attempts / total * 100")
    per_test: list[TestPerTest] = Field(
        default_factory=list, description="Breakdown per test"
    )


# ── Student Summary Report ───────────────────────────────────────


class StudentSummaryReport(BaseModel):
    """Consolidated report for a single student."""

    student_id: str = Field(..., description="Student UUID")
    student_name: str = Field("", description="Student full name")
    class_id: str = Field("", description="Student's class UUID")
    class_name: str = Field("", description="Student's class name")

    # Attendance
    attendance_present_percentage: float = Field(0.0, description="Attendance present %")
    attendance_absent_percentage: float = Field(0.0, description="Attendance absent %")
    attendance_total_records: int = Field(0, description="Total attendance records")

    # Homework
    homework_total_assigned: int = Field(0, description="Homeworks assigned")
    homework_submitted: int = Field(0, description="Homeworks submitted")
    homework_completion_rate: float = Field(0.0, description="submitted / assigned * 100")
    homework_average_score: float = Field(0.0, description="Avg score on graded submissions")

    # Tests
    tests_total: int = Field(0, description="Tests available")
    tests_attempted: int = Field(0, description="Tests attempted")
    tests_average_score: float = Field(0.0, description="Average test score")
    tests_highest_score: float = Field(0.0, description="Highest test score")
    tests_pass_rate: float = Field(0.0, description="Pass rate on attempted tests")


# ── Class Summary Report ─────────────────────────────────────────


class ClassSummaryReport(BaseModel):
    """Consolidated report for a class."""

    class_id: str = Field(..., description="Class UUID")
    class_name: str = Field("", description="Class name")
    school_id: str = Field(..., description="Tenant scope")
    total_students: int = Field(0, description="Active student count")

    # Attendance
    attendance_present_percentage: float = Field(0.0, description="Average present % across class")
    attendance_absent_percentage: float = Field(0.0, description="Average absent % across class")

    # Homework
    homework_total_assigned: int = Field(0, description="Homeworks created for this class")
    homework_overall_completion: float = Field(0.0, description="Overall completion rate")

    # Tests
    tests_total: int = Field(0, description="Tests created for this class")
    tests_overall_average: float = Field(0.0, description="Average test score")
    tests_overall_pass_rate: float = Field(0.0, description="Overall pass rate")


# ── Teacher Summary Report ───────────────────────────────────────


class TeacherSummaryReport(BaseModel):
    """Consolidated report for a teacher."""

    teacher_id: str = Field(..., description="Teacher UUID")
    teacher_name: str = Field("", description="Teacher full name")
    school_id: str = Field(..., description="Tenant scope")
    assigned_classes: list[str] = Field(default_factory=list, description="Class IDs taught")
    assigned_class_names: list[str] = Field(default_factory=list, description="Class names taught")

    # Homework
    homeworks_created: int = Field(0, description="Homeworks created")
    homeworks_graded: int = Field(0, description="Homeworks fully graded")
    overall_homework_completion: float = Field(0.0, description="Student completion rate (avg)")

    # Tests
    tests_created: int = Field(0, description="Tests created")
    tests_graded: int = Field(0, description="Tests fully graded")
    average_test_score: float = Field(0.0, description="Average score across all tests")
    overall_test_pass_rate: float = Field(0.0, description="Overall pass rate")


# ── Generic Wrapper ──────────────────────────────────────────────


class ReportListResponse(BaseModel):
    """Wrapper for lists of reports (used for trends)."""

    reports: list
    total: int = 0
