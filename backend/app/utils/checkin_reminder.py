from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta
import logging
from app.services import supabase_service as svc
from app.config import settings
from app.utils.email import send_email

logger = logging.getLogger("apscheduler")

scheduler = BackgroundScheduler()

# --- Email template ---
CHECKIN_SUBJECT = "📝 Weekly Check-In Reminder"
CHECKIN_BODY = """
Hello {name},

It's time for your weekly health check-in! Regular check-ins help you and your coach track progress, spot trends, and adjust your protocol for best results.

Take 2 minutes to fill out your check-in here: {checkin_url}

Stay healthy!
Vitaloop Team
"""


def weekly_checkin_reminder():
    logger.info("Running weekly check-in reminder job...")
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    users = svc.get_users_for_checkin_reminder(since=week_ago)
    for user in users:
        try:
            email = user.get("email")
            name = user.get("first_name") or "there"
            user_id = user.get("id")
            checkin_url = f"{settings.frontend_url}/checkin"
            send_email(
                to=email,
                subject=CHECKIN_SUBJECT,
                body=CHECKIN_BODY.format(name=name, checkin_url=checkin_url),
            )
            logger.info(f"Sent check-in reminder to {email}")
        except Exception as e:
            logger.error(f"Failed to send reminder to {user}: {e}")


def start():
    scheduler.add_job(weekly_checkin_reminder, CronTrigger(day_of_week="mon", hour=10, minute=0))
    scheduler.start()
    logger.info("Scheduler started for weekly check-in reminders.")
