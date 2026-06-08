"""Notification Celery tasks."""

import asyncio
import logging
from app.workers.celery_app import celery_app
from app.infrastructure.messaging.whatsapp_provider import WhatsAppProvider

logger = logging.getLogger("athon")


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_absence_whatsapp(
    self,
    parent_phone: str,
    student_name: str,
    school_name: str,
    date_str: str,
):
    """Send WhatsApp absence alert to parent."""
    try:
        provider = WhatsAppProvider()
        result = asyncio.run(
            provider.send_absence_alert(
                parent_phone=parent_phone,
                student_name=student_name,
                school_name=school_name,
                date=date_str,
            )
        )
        if not result:
            raise Exception("WhatsApp provider returned False")
        logger.info("Absence alert sent to %s for student %s", parent_phone, student_name)
    except Exception as exc:
        logger.error("Absence alert failed: %s", exc)
        raise self.retry(exc=exc)
