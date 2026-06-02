"""create_periods_and_timetable_entries

Revision ID: a1b2c3d4e5f6
Revises: f65f053e7d10
Create Date: 2026-06-02 12:00:00.000000

Migration naming convention:
    YYYYMMDD_HHMM_short_description

Adds the timetable module to the Athon schema:
  - periods:         School day time slots (reference data)
  - timetable_entries: Unified class and teacher schedule

This migration is APPLIED AFTER the SQL schema files (enums.sql → tables.sql
→ indexes.sql → triggers.sql → rls.sql) have been executed. It uses raw SQL
via op.execute() because ORM models have not been created yet.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f65f053e7d10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # periods — School day time slots
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE periods (
            id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id       UUID            NOT NULL,
            name            VARCHAR(50)     NOT NULL,
            period_number   INTEGER         NOT NULL,
            start_time      TIME            NOT NULL,
            end_time        TIME            NOT NULL,
            is_break        BOOLEAN         NOT NULL DEFAULT FALSE,
            created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
            deleted_at      TIMESTAMPTZ,

            CONSTRAINT periods_school_number_uk UNIQUE (school_id, period_number),
            CONSTRAINT periods_time_check CHECK (end_time > start_time)
        );

        COMMENT ON TABLE  periods IS 'School day time slots — each school defines its own period structure';
        COMMENT ON COLUMN periods.name IS 'Display name: "Period 1", "Morning Break", "Lunch", etc.';
        COMMENT ON COLUMN periods.period_number IS 'Chronological order (1 = first period of the day)';
        COMMENT ON COLUMN periods.is_break IS 'TRUE for recess/lunch periods (no subject assigned)';
    """)

    # ------------------------------------------------------------------
    # timetable_entries — Unified class and teacher schedule
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE timetable_entries (
            id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id         UUID            NOT NULL,
            academic_term_id  UUID            NOT NULL,
            class_id          UUID            NOT NULL,
            subject_id        UUID            NOT NULL,
            teacher_id        UUID            NOT NULL,
            period_id         UUID            NOT NULL,
            day_of_week       SMALLINT        NOT NULL,
            room_number       VARCHAR(20),
            is_active         BOOLEAN         NOT NULL DEFAULT TRUE,
            created_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
            updated_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
            deleted_at        TIMESTAMPTZ,

            CONSTRAINT tt_class_period_uk
                UNIQUE (academic_term_id, class_id, day_of_week, period_id),
            CONSTRAINT tt_teacher_period_uk
                UNIQUE (academic_term_id, teacher_id, day_of_week, period_id),
            CONSTRAINT tt_day_of_week_check
                CHECK (day_of_week >= 1 AND day_of_week <= 6)
        );

        COMMENT ON TABLE  timetable_entries IS 'Unified timetable — single source of truth for class and teacher schedules';
        COMMENT ON COLUMN timetable_entries.day_of_week IS '1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday';
        COMMENT ON COLUMN timetable_entries.is_active IS 'Allows disabling entries for temporary adjustments without deleting';
        COMMENT ON COLUMN timetable_entries.room_number IS 'Optional per-period room override; defaults to class default if NULL';
    """)

    # ------------------------------------------------------------------
    # Foreign keys
    # ------------------------------------------------------------------
    op.execute("""
        ALTER TABLE periods
            ADD CONSTRAINT periods_school_fk
            FOREIGN KEY (school_id) REFERENCES schools(id);

        ALTER TABLE timetable_entries
            ADD CONSTRAINT tt_school_fk
            FOREIGN KEY (school_id) REFERENCES schools(id);
        ALTER TABLE timetable_entries
            ADD CONSTRAINT tt_academic_term_fk
            FOREIGN KEY (academic_term_id) REFERENCES academic_terms(id);
        ALTER TABLE timetable_entries
            ADD CONSTRAINT tt_class_fk
            FOREIGN KEY (class_id) REFERENCES classes(id);
        ALTER TABLE timetable_entries
            ADD CONSTRAINT tt_subject_fk
            FOREIGN KEY (subject_id) REFERENCES subjects(id);
        ALTER TABLE timetable_entries
            ADD CONSTRAINT tt_teacher_fk
            FOREIGN KEY (teacher_id) REFERENCES teachers(id);
        ALTER TABLE timetable_entries
            ADD CONSTRAINT tt_period_fk
            FOREIGN KEY (period_id) REFERENCES periods(id);
    """)

    # ------------------------------------------------------------------
    # Indexes
    # ------------------------------------------------------------------
    op.execute("""
        CREATE INDEX idx_periods_school
            ON periods(school_id, period_number)
            WHERE deleted_at IS NULL;

        CREATE INDEX idx_tt_class_term
            ON timetable_entries(academic_term_id, class_id, day_of_week, period_id)
            INCLUDE (subject_id, teacher_id, room_number)
            WHERE deleted_at IS NULL AND is_active = TRUE;

        CREATE INDEX idx_tt_teacher_term
            ON timetable_entries(academic_term_id, teacher_id, day_of_week, period_id)
            INCLUDE (class_id, subject_id, room_number)
            WHERE deleted_at IS NULL AND is_active = TRUE;

        CREATE INDEX idx_tt_school_term
            ON timetable_entries(school_id, academic_term_id, day_of_week, class_id, period_id)
            WHERE deleted_at IS NULL AND is_active = TRUE;

        CREATE INDEX idx_tt_subject_term
            ON timetable_entries(academic_term_id, subject_id, day_of_week, period_id)
            INCLUDE (class_id, teacher_id)
            WHERE deleted_at IS NULL AND is_active = TRUE;
    """)

    # ------------------------------------------------------------------
    # Triggers — updated_at
    # ------------------------------------------------------------------
    op.execute("""
        DO $$ BEGIN
            DROP TRIGGER IF EXISTS trg_periods_updated ON periods;
            CREATE TRIGGER trg_periods_updated
                BEFORE UPDATE ON periods
                FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END $$;

        DO $$ BEGIN
            DROP TRIGGER IF EXISTS trg_timetable_entries_updated ON timetable_entries;
            CREATE TRIGGER trg_timetable_entries_updated
                BEFORE UPDATE ON timetable_entries
                FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END $$;
    """)

    # ------------------------------------------------------------------
    # Triggers — audit log (timetable_entries only)
    # ------------------------------------------------------------------
    op.execute("""
        DO $$ BEGIN
            DROP TRIGGER IF EXISTS trg_timetable_entries_audit ON timetable_entries;
            CREATE TRIGGER trg_timetable_entries_audit
                AFTER INSERT OR UPDATE OR DELETE ON timetable_entries
                FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
        END $$;
    """)

    # ------------------------------------------------------------------
    # RLS enablement
    # ------------------------------------------------------------------
    op.execute("""
        ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
        ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
    """)

    # ------------------------------------------------------------------
    # RLS policies — periods
    # ------------------------------------------------------------------
    op.execute("""
        CREATE POLICY p_periods_select ON periods
            FOR SELECT USING (school_id = app.current_school_id());

        CREATE POLICY p_periods_insert ON periods
            FOR INSERT WITH CHECK (
                school_id = app.current_school_id()
                AND app.user_has_role('school_admin', 'principal')
            );

        CREATE POLICY p_periods_update ON periods
            FOR UPDATE USING (
                school_id = app.current_school_id()
                AND app.user_has_role('school_admin', 'principal')
            );

        CREATE POLICY p_periods_delete ON periods
            FOR DELETE USING (
                school_id = app.current_school_id()
                AND app.user_has_role('school_admin')
            );
    """)

    # ------------------------------------------------------------------
    # RLS policies — timetable_entries
    # ------------------------------------------------------------------
    op.execute("""
        CREATE POLICY p_tt_select ON timetable_entries
            FOR SELECT USING (school_id = app.current_school_id());

        CREATE POLICY p_tt_insert ON timetable_entries
            FOR INSERT WITH CHECK (
                school_id = app.current_school_id()
                AND app.user_has_role('school_admin', 'principal')
            );

        CREATE POLICY p_tt_update ON timetable_entries
            FOR UPDATE USING (
                school_id = app.current_school_id()
                AND app.user_has_role('school_admin', 'principal')
            );

        CREATE POLICY p_tt_delete ON timetable_entries
            FOR DELETE USING (
                school_id = app.current_school_id()
                AND app.user_has_role('school_admin')
            );
    """)


def downgrade() -> None:
    """Reverse the migration — drop timetable tables and their artifacts."""
    op.execute("""
        DROP TABLE IF EXISTS timetable_entries CASCADE;
        DROP TABLE IF EXISTS periods CASCADE;
    """)
