"""SQLAlchemy ORM models for the Athon platform.

Phase 1 (Identity & Auth):
    - School     — Tenant root entity
    - User       — Unified authentication principal (all roles)
    - Teacher    — Teacher-specific profile (1:1 with User)
    - Principal  — Principal-specific profile (1:1 with User)
    - Parent     — Parent/guardian profile (1:1 with User)
    - Student    — Student-specific profile (1:1 with User)

Phase 2 (Academic):
    - AcademicYear       — Academic calendar years per school
    - AcademicTerm       — Terms within an academic year
    - Class              — Class groups (e.g. "Grade 10-A")
    - Subject            — Academic subjects offered
    - Period             — School day time slots
    - TeacherClassSubject — Teacher ↔ Class ↔ Subject mapping
    - TimetableEntry     — Unified class and teacher schedule
    - ClassEnrollment    — Student enrollment history

Phase 3 (Homework):
    - Homework           — Homework assignments
    - HomeworkQuestion   — Questions within a homework
    - HomeworkSubmission — Student homework submissions
    - HomeworkAnswer     — Per-question answers within a submission

Phase 4 (Tests):
    - Test               — Test/exam definitions
    - TestQuestion       — Questions within a test
    - TestAttempt        — Student test attempts
    - TestAnswer         — Per-question answers within an attempt

Phase 5 (Notifications):
    - Notification               — Outbound notification records
    - NotificationRecipient      — Per-recipient delivery tracking

Phase 6 (Announcements):
    - Announcement               — School announcements with audience targeting

Phase 7 (Enrichment):
    - StudentParent              — Many-to-many student ↔ parent junction
    - AuditLog                   — Immutable audit trail for compliance
    - AiGeneration               — AI content generation audit trail
"""

from app.models.base import Base
from app.models.school import School
from app.models.user import User
from app.models.teacher import Teacher
from app.models.principal import Principal
from app.models.parent import Parent
from app.models.student import Student
from app.models.academic_year import AcademicYear
from app.models.academic_term import AcademicTerm
from app.models.academic_class import Class
from app.models.subject import Subject
from app.models.period import Period
from app.models.teacher_class_subject import TeacherClassSubject
from app.models.timetable_entry import TimetableEntry
from app.models.attendance import Attendance
from app.models.class_enrollment import ClassEnrollment
from app.models.homework import Homework
from app.models.homework_question import HomeworkQuestion
from app.models.homework_submission import HomeworkSubmission
from app.models.homework_answer import HomeworkAnswer
from app.models.test import Test
from app.models.test_question import TestQuestion
from app.models.test_attempt import TestAttempt
from app.models.test_answer import TestAnswer
from app.models.notification import Notification
from app.models.notification_recipient import NotificationRecipient
from app.models.announcement import Announcement
from app.models.student_parent import StudentParent
from app.models.audit_log import AuditLog
from app.models.ai_generation import AiGeneration

__all__ = [
    "Base",
    "School",
    "User",
    "Teacher",
    "Principal",
    "Parent",
    "Student",
    "AcademicYear",
    "AcademicTerm",
    "Class",
    "Subject",
    "Period",
    "TeacherClassSubject",
    "TimetableEntry",
    "ClassEnrollment",
    "Attendance",
    "Homework",
    "HomeworkQuestion",
    "HomeworkSubmission",
    "HomeworkAnswer",
    "Test",
    "TestQuestion",
    "TestAttempt",
    "TestAnswer",
    "Notification",
    "NotificationRecipient",
    "Announcement",
    "StudentParent",
    "AuditLog",
    "AiGeneration",
]
