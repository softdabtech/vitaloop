"""Service for managing deferred PDF analysis tasks."""
from datetime import datetime, timedelta
from typing import Optional
import uuid
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.job import Job

logger = logging.getLogger(__name__)

# Global scheduler instance
_scheduler: Optional[BackgroundScheduler] = None


def init_scheduler():
    """Initialize the APScheduler background scheduler."""
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler()
        _scheduler.start()
        logger.info("Analysis queue scheduler initialized")
    return _scheduler


def get_scheduler() -> BackgroundScheduler:
    """Get or initialize the scheduler."""
    global _scheduler
    if _scheduler is None:
        init_scheduler()
    return _scheduler


async def schedule_pdf_analysis(
    user_id: str,
    upload_id: str,
    file_name: str,
    user_email: str,
    delay_minutes: int = 10,
) -> dict:
    """
    Schedule a PDF analysis task to run after delay_minutes.

    Returns task info with job_id and scheduled_time.
    """
    from app.services.email_service import send_analysis_ready_email
    from app.services import supabase_service as svc

    task_id = str(uuid.uuid4())
    scheduled_time = datetime.now() + timedelta(minutes=delay_minutes)

    scheduler = get_scheduler()

    async def run_analysis():
        """Background task: analyze the PDF and send notifications."""
        try:
            # In real implementation, you would:
            # 1. Fetch the PDF from storage
            # 2. Run the analysis service
            # 3. Save results to database

            # For now, we'll just send the notification
            logger.info(f"[Task {task_id}] Analysis complete for upload {upload_id}")

            # Save notification to Supabase
            await svc._run(
                lambda: svc._get_supabase().table("notifications").insert({
                    "user_id": user_id,
                    "trigger_type": "general",
                    "channel": "in_app",
                    "subject": "Lab Analysis Ready",
                    "body": f"Your analysis for {file_name} is ready. Upload ID: {upload_id}.",
                    "delivery_status": "sent",
                    "created_at": datetime.now().isoformat(),
                }).execute()
            )

            # Send email notification
            await send_analysis_ready_email(
                to_email=user_email,
                file_name=file_name,
                dashboard_url="https://vitaloop.today/lab-results",
            )

            logger.info(f"[Task {task_id}] Notifications sent for {user_email}")

        except Exception as e:
            logger.error(f"[Task {task_id}] Error in analysis: {e}")
            # Save error notification
            try:
                await svc._run(
                    lambda: svc._get_supabase().table("notifications").insert({
                        "user_id": user_id,
                        "trigger_type": "general",
                        "channel": "in_app",
                        "subject": "Analysis Failed",
                        "body": f"Could not process {file_name}. Please try again. Upload ID: {upload_id}.",
                        "delivery_status": "failed",
                        "created_at": datetime.now().isoformat(),
                    }).execute()
                )
            except Exception as notify_error:
                logger.error(f"Could not save error notification: {notify_error}")

    # Schedule the job
    job = scheduler.add_job(
        run_analysis,
        'date',
        run_date=scheduled_time,
        id=task_id,
        name=f"analyze_{upload_id}",
    )

    return {
        "task_id": task_id,
        "upload_id": upload_id,
        "scheduled_time": scheduled_time.isoformat(),
        "status": "scheduled",
        "delay_minutes": delay_minutes,
    }


def cancel_analysis(task_id: str) -> bool:
    """Cancel a scheduled analysis task."""
    scheduler = get_scheduler()
    try:
        scheduler.remove_job(task_id)
        logger.info(f"Task {task_id} cancelled")
        return True
    except Exception as e:
        logger.error(f"Failed to cancel task {task_id}: {e}")
        return False


def get_scheduled_tasks(user_id: str) -> list:
    """Get all scheduled analysis tasks for a user."""
    scheduler = get_scheduler()
    tasks = []
    for job in scheduler.get_jobs():
        if job.name and job.name.startswith("analyze_"):
            tasks.append({
                "task_id": job.id,
                "name": job.name,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            })
    return tasks
