"""Python enums matching PostgreSQL ENUM types for Phase 1 models.

These enums are mapped to SQLAlchemy using
sa.Enum(EnumClass, name="pg_enum_name", create_type=False)
to match the existing database enum types without attempting to create them.
"""

import enum


class UserRole(str, enum.Enum):
    """Matches the user_role PostgreSQL ENUM type."""

    SUPER_ADMIN = "super_admin"
    SCHOOL_ADMIN = "school_admin"
    PRINCIPAL = "principal"
    TEACHER = "teacher"
    STUDENT = "student"
    PARENT = "parent"


class AttendanceStatus(str, enum.Enum):
    """Matches the attendance_status PostgreSQL ENUM type.

    Used by Attendance to record daily attendance:
        - present:  student was present
        - absent:   student was absent
        - late:     student arrived late
        - half_day: student attended half the day
    """

    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    HALF_DAY = "half_day"


class QuestionType(str, enum.Enum):
    """Matches the question_type PostgreSQL ENUM type.

    Used by homework and test questions:
        - multiple_choice: MCQ with predefined options
        - true_false: binary true/false question
        - short_answer: brief written response
        - long_answer: detailed written response
        - essay: extended writing exercise
    """

    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    LONG_ANSWER = "long_answer"
    ESSAY = "essay"


class AttemptStatus(str, enum.Enum):
    """Matches the attempt_status PostgreSQL ENUM type.

    Lifecycle state of a homework or test attempt:
        - pending:           not yet started
        - in_progress:       currently being worked on
        - submitted:         submitted by student, awaiting grading
        - graded:            teacher has completed grading
        - results_published: results released to students/parents
    """

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    GRADED = "graded"
    RESULTS_PUBLISHED = "results_published"


class NotificationType(str, enum.Enum):
    """Matches the notification_type PostgreSQL ENUM type.

    Category of notification for routing and filtering:
        - academic:     homework, test results, grades
        - attendance:   attendance alerts
        - fee_reminder: fee payment reminders
        - announcement: school-wide announcements
        - behavioral:   behavioral reports
        - emergency:    emergency alerts
        - system:       system/account notifications
        - other:        uncategorised
    """

    ACADEMIC = "academic"
    ATTENDANCE = "attendance"
    FEE_REMINDER = "fee_reminder"
    ANNOUNCEMENT = "announcement"
    BEHAVIORAL = "behavioral"
    EMERGENCY = "emergency"
    SYSTEM = "system"
    OTHER = "other"


class NotificationChannel(str, enum.Enum):
    """Matches the notification_channel PostgreSQL ENUM type.

    Delivery channel for notifications:
        - whatsapp: WhatsApp Business API
        - email:    SMTP email delivery
        - push:     Mobile push notification
        - sms:      SMS text message
    """

    WHATSAPP = "whatsapp"
    EMAIL = "email"
    PUSH = "push"
    SMS = "sms"


class NotificationStatus(str, enum.Enum):
    """Matches the notification_status PostgreSQL ENUM type.

    Delivery status of an outbound notification:
        - pending:   awaiting delivery
        - sent:      dispatched to channel
        - delivered: confirmed delivered
        - failed:    delivery failed
    """

    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"


class Gender(str, enum.Enum):
    """Matches the gender PostgreSQL ENUM type."""

    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class ParentRelationship(str, enum.Enum):
    """Matches the parent_relationship PostgreSQL ENUM type.

    Used by StudentParent to track the relationship type:
        - father:  biological or legal father
        - mother:  biological or legal mother
        - guardian: legal guardian not a parent
        - other:   other relationship type
    """

    FATHER = "father"
    MOTHER = "mother"
    GUARDIAN = "guardian"
    OTHER = "other"


class EnrollmentStatus(str, enum.Enum):
    """Matches the enrollment_status PostgreSQL ENUM type.

    Used by ClassEnrollment to track student lifecycle:
        - active:      currently enrolled in the class
        - promoted:    moved to the next grade/class
        - transferred: moved to a different class/school
        - graduated:   completed the final year
        - withdrawn:   removed from the class
    """

    ACTIVE = "active"
    PROMOTED = "promoted"
    TRANSFERRED = "transferred"
    GRADUATED = "graduated"
    WITHDRAWN = "withdrawn"
