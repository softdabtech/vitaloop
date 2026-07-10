from __future__ import annotations

from typing import Any, Dict, Optional

from app.services import supabase_service as svc
from app.utils.roles import normalize_global_role, as_bool


def _is_paid_subscription(active_sub: Optional[Dict[str, Any]], account: Dict[str, Any]) -> tuple[bool, str, str, str, bool]:
    # Deprecated compatibility source; prefer canonical subscriptions rows.
    subscription_status = str(account.get('sub_status') or account.get('subscription_status') or '').strip().lower()
    account_plan = str(account.get('plan_tier') or '').strip().lower()

    sub_table_status = str((active_sub or {}).get('status') or 'free').lower()
    sub_table_plan = str((active_sub or {}).get('plan_name') or '').strip().lower()
    cancel_at_period_end = bool((active_sub or {}).get('cancel_at_period_end', False))

    paid_from_sub_table = bool(
        active_sub
        and sub_table_status == 'active'
        and sub_table_plan
        and sub_table_plan != 'free'
        and not cancel_at_period_end
    )
    paid_from_account = bool(
        not active_sub
        and subscription_status == 'active'
        and account_plan
        and account_plan != 'free'
    )
    is_paid = paid_from_sub_table or paid_from_account

    if paid_from_sub_table:
        billing_status = 'active'
        plan_key = sub_table_plan or account_plan or 'personal'
        source = 'subscriptions'
    elif paid_from_account:
        billing_status = 'active'
        plan_key = account_plan or 'personal'
        source = 'users'
    elif active_sub:
        if sub_table_plan == 'free' and sub_table_status == 'active':
            billing_status = 'free'
        else:
            billing_status = sub_table_status if sub_table_status in {'active', 'past_due', 'paused', 'cancelled', 'free'} else 'free'
        plan_key = sub_table_plan or account_plan or 'free'
        source = 'subscriptions'
    else:
        billing_status = subscription_status or 'free'
        plan_key = account_plan or 'free'
        source = 'users'

    return is_paid, billing_status, plan_key, source, cancel_at_period_end


async def resolve_user_entitlements(user_id: str, current_user: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    current_user = current_user or {}

    account = await svc.get_user_account(user_id)
    profile = await svc.get_user_profile(user_id)
    active_sub = await svc.get_user_active_subscription(user_id)

    jwt_role = str(current_user.get('global_role') or current_user.get('role') or '').lower()
    global_role = normalize_global_role(account.get('global_role'), jwt_role)

    is_paid, billing_status, plan_key, source, cancel_at_period_end = _is_paid_subscription(active_sub, account)
    is_premium = bool(global_role != 'end_user' or is_paid)
    is_trial = billing_status == 'trialing'
    is_past_due = billing_status == 'past_due'

    features = {
        'upload_limit': None if is_premium else 1,
        'lab_history': True,
        'trend_analysis': bool(is_premium),
        'advanced_protocol': bool(is_premium),
        'symptom_lab_plan': True,
        'checkins': True,
    }

    return {
        'user_id': user_id,
        'role': global_role,
        'plan_key': plan_key,
        'billing_status': billing_status,
        'is_premium': is_premium,
        'is_trial': is_trial,
        'is_past_due': is_past_due,
        'cancel_at_period_end': cancel_at_period_end,
        'has_active_subscription': is_paid,
        'source': source,
        'needs_sync': bool(source == 'users' and active_sub),
        'features': features,
        'profile': {
            'onboarding_complete': as_bool(profile.get('onboarding_complete')),
        },
    }
