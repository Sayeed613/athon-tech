"""WhatsApp provider using Meta Cloud API."""

import logging
import httpx
from app.core.config import settings

logger = logging.getLogger("athon")


class WhatsAppProvider:
    """HTTP-based WhatsApp Business message sender."""

    async def send_text(self, to_phone: str, message: str) -> bool:
        """Send a plain text WhatsApp message.

        Uses Meta Cloud API if WHATSAPP_PHONE_NUMBER_ID is set.
        Falls back to logging if not configured (dev mode).
        """
        if not settings.whatsapp_api_key or not settings.whatsapp_phone_number:
            logger.info("[WhatsApp DEV] To: %s | Message: %s", to_phone, message)
            return True  # Silently succeed in dev

        # Meta Cloud API
        url = f"https://graph.facebook.com/v18.0/{settings.whatsapp_phone_number}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone.lstrip("+"),
            "type": "text",
            "text": {"body": message},
        }
        headers = {
            "Authorization": f"Bearer {settings.whatsapp_api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return True
        except Exception as exc:
            logger.error("WhatsApp send failed to %s: %s", to_phone, exc)
            return False

    async def send_absence_alert(self, parent_phone: str, student_name: str, school_name: str, date: str) -> bool:
        """Send absence alert to parent via WhatsApp."""
        message = (
            f"Dear Parent,\n\n"
            f"Your child *{student_name}* was marked *absent* today ({date}) "
            f"at {school_name}.\n\n"
            f"If this is incorrect, please contact the school.\n\n"
            f"— Athon School System"
        )
        return await self.send_text(parent_phone, message)
