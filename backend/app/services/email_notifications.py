"""
Email notification service for subscription, protocol, and engagement emails.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from app.config import settings
from app.services.email_service import _deliver_html_email
from app.utils.retry import email_circuit_breaker

logger = logging.getLogger(__name__)


async def send_subscription_expiry_warning(user_email: str, user_name: str, days_until_expiry: int) -> bool:
    """Send subscription expiry warning email 24 hours before expiration.

    Args:
        user_email: User's email address
        user_name: User's full name
        days_until_expiry: Days until subscription expires (should be 0-1 for 24h window)

    Returns:
        True if email sent successfully, False otherwise
    """
    if not user_email or not user_name:
        logger.warning("Cannot send subscription expiry warning: missing email or name")
        return False

    try:
        subject = "Your VITALOOP Premium subscription expires in 24 hours"
        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px;">
            <h2 style="color: #1D9E75;">Subscription Expiring Soon</h2>
            <p>Hi {user_name},</p>
            <p>Your VITALOOP Premium subscription will expire in <strong>24 hours</strong>.</p>
            <p>To keep your analysis features active:</p>
            <ul>
                <li>Visit your <a href="{settings.frontend_base_url}/dashboard?tab=subscription">subscription page</a></li>
                <li>Click "Renew Subscription" to extend your access</li>
            </ul>
            <p>Your data is safe and won't be deleted, but you'll lose premium features like:</p>
            <ul>
                <li>Advanced biomarker analysis</li>
                <li>Personalized health protocols</li>
                <li>Priority support</li>
            </ul>
            <p><a href="{settings.frontend_base_url}/dashboard?tab=subscription"
                   style="display: inline-block; padding: 12px 24px; background-color: #1D9E75;
                          color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">
                Renew Now
            </a></p>
            <p>Questions? Reply to this email or contact support@vitaloop.today</p>
        </div>
        """

        await _deliver_html_email(
            to_email=user_email,
            subject=subject,
            html=html_content,
        )
        logger.info(f"Subscription expiry warning sent to {user_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send subscription expiry warning to {user_email}: {e}")
        return False


async def send_protocol_update_notification(
    user_email: str,
    user_name: str,
    protocol_update_details: str,
) -> bool:
    """Send notification about newly generated protocol.

    Args:
        user_email: User's email address
        user_name: User's full name
        protocol_update_details: Details about the protocol update

    Returns:
        True if email sent successfully, False otherwise
    """
    if not user_email or not user_name:
        logger.warning("Cannot send protocol update: missing email or name")
        return False

    try:
        subject = "Your personalized health protocol is ready!"
        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px;">
            <h2 style="color: #1D9E75;">New Protocol Generated</h2>
            <p>Hi {user_name},</p>
            <p>Great news! Your personalized health protocol has been generated based on your latest lab results.</p>
            <p><strong>Protocol Summary:</strong></p>
            <p>{protocol_update_details}</p>
            <p><a href="{settings.frontend_base_url}/dashboard?tab=protocol"
                   style="display: inline-block; padding: 12px 24px; background-color: #1D9E75;
                          color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">
                View Your Protocol
            </a></p>
            <p>This protocol includes personalized supplement recommendations and lifestyle modifications tailored to your results.</p>
            <p>Questions? Contact our health team at support@vitaloop.today</p>
        </div>
        """

        await _deliver_html_email(
            to_email=user_email,
            subject=subject,
            html=html_content,
        )
        logger.info(f"Protocol update notification sent to {user_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send protocol notification to {user_email}: {e}")
        return False


async def send_free_to_premium_upsell(user_email: str, user_name: str) -> bool:
    """Send upgrade offer to free tier user.

    Args:
        user_email: User's email address
        user_name: User's full name

    Returns:
        True if email sent successfully, False otherwise
    """
    if not user_email or not user_name:
        logger.warning("Cannot send upsell email: missing email or name")
        return False

    try:
        subject = "Unlock advanced analysis with VITALOOP Premium"
        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px;">
            <h2 style="color: #1D9E75;">Ready to go deeper?</h2>
            <p>Hi {user_name},</p>
            <p>You've discovered the power of lab analysis with VITALOOP. Now, unlock premium features:</p>
            <ul>
                <li>✅ Unlimited uploads (currently limited to 1)</li>
                <li>✅ Advanced biomarker analysis and trends</li>
                <li>✅ Personalized health protocols</li>
                <li>✅ Supplement recommendations with iHerb links</li>
                <li>✅ Priority support</li>
            </ul>
            <p><strong style="color: #1D9E75; font-size: 18px;">Only $4.99/month</strong></p>
            <p><a href="{settings.frontend_base_url}/dashboard?tab=subscription&action=upgrade"
                   style="display: inline-block; padding: 12px 24px; background-color: #1D9E75;
                          color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">
                Upgrade to Premium
            </a></p>
            <p>30-day money-back guarantee. No questions asked.</p>
            <p>Curious? <a href="{settings.frontend_base_url}#pricing">See pricing and features</a></p>
        </div>
        """

        await _deliver_html_email(
            to_email=user_email,
            subject=subject,
            html=html_content,
        )
        logger.info(f"Free-to-premium upsell sent to {user_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send upsell email to {user_email}: {e}")
        return False


async def send_unverified_email_reminder(user_email: str, user_name: str) -> bool:
    """Send reminder to verify email address.

    Args:
        user_email: User's email address
        user_name: User's full name

    Returns:
        True if email sent successfully, False otherwise
    """
    if not user_email or not user_name:
        logger.warning("Cannot send email verification reminder: missing email or name")
        return False

    try:
        subject = "Verify your email to access VITALOOP"
        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px;">
            <h2 style="color: #1D9E75;">Email Verification Required</h2>
            <p>Hi {user_name},</p>
            <p>We noticed your email hasn't been verified yet. This is important for account security and receiving important notifications.</p>
            <p><a href="{settings.frontend_base_url}/verify-email"
                   style="display: inline-block; padding: 12px 24px; background-color: #1D9E75;
                          color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">
                Verify Email Now
            </a></p>
            <p>Once verified, you'll have full access to all VITALOOP features.</p>
            <p>Questions? Contact support@vitaloop.today</p>
        </div>
        """

        await _deliver_html_email(
            to_email=user_email,
            subject=subject,
            html=html_content,
        )
        logger.info(f"Email verification reminder sent to {user_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email verification reminder to {user_email}: {e}")
        return False


async def bulk_send_subscription_expiry_warnings(users: List[Dict[str, Any]]) -> Dict[str, int]:
    """Send subscription expiry warnings to multiple users.

    Args:
        users: List of user dicts with keys: email, full_name, days_until_expiry

    Returns:
        Dict with success and failure counts
    """
    results = {"success": 0, "failed": 0}

    for user in users:
        try:
            success = await send_subscription_expiry_warning(
                user_email=user.get("email"),
                user_name=user.get("full_name"),
                days_until_expiry=user.get("days_until_expiry", 1),
            )
            if success:
                results["success"] += 1
            else:
                results["failed"] += 1
        except Exception as e:
            logger.error(f"Error sending expiry warning to {user.get('email')}: {e}")
            results["failed"] += 1

    logger.info(f"Subscription expiry warnings: {results['success']} sent, {results['failed']} failed")
    return results
