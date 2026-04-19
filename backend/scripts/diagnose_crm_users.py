#!/usr/bin/env python3
"""
Diagnose CRM user visibility issues.
Checks if registered users have corresponding client records.
"""

import asyncio
import logging
from uuid import UUID
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def diagnose_crm_users():
    """Check user-to-client mapping and identify gaps."""
    try:
        from app.services import supabase_service as svc
        from app.config import settings
        
        print("\n" + "="*60)
        print("CRM USER VISIBILITY DIAGNOSTIC")
        print("="*60)
        
        sb = svc._get_supabase()
        
        # 1. Count registered users
        print("\n[1] Registered Users (auth.users)")
        users_resp = await svc._run(
            lambda: sb.table("users").select("id, email, created_at", count="exact").execute()
        )
        user_count = users_resp.count or 0
        users = users_resp.data or []
        print(f"    Total: {user_count}")
        print(f"    Sample: {[{'id': u['id'][:8], 'email': u['email']} for u in users[:3]]}")
        
        # 2. Count clients
        print("\n[2] Client Records (clients table)")
        clients_resp = await svc._run(
            lambda: sb.table("clients").select("user_id, id, created_at", count="exact").execute()
        )
        client_count = clients_resp.count or 0
        clients = clients_resp.data or []
        print(f"    Total: {client_count}")
        print(f"    Sample: {[{'user_id': c['user_id'][:8] if c.get('user_id') else None} for c in clients[:3]]}")
        
        # 3. Find orphaned users (users without client records)
        print("\n[3] Gap Analysis")
        user_ids = {u['id'] for u in users}
        client_user_ids = {c['user_id'] for c in clients if c.get('user_id')}
        orphaned_user_ids = user_ids - client_user_ids
        
        print(f"    Users with clients: {len(client_user_ids)}")
        print(f"    Users WITHOUT clients: {len(orphaned_user_ids)}")
        
        if orphaned_user_ids:
            print(f"\n    ⚠️  CRITICAL: {len(orphaned_user_ids)} users are NOT in CRM!")
            orphaned = [u for u in users if u['id'] in orphaned_user_ids][:5]
            print(f"    First 5 orphaned users:")
            for u in orphaned:
                print(f"      - {u['email']} (created: {u.get('created_at', 'N/A')})")
        
        # 4. Check trigger status
        print("\n[4] Trigger Status")
        try:
            # Try to call a test function
            test_func = await svc._run(
                lambda: sb.rpc("check_handle_new_client_trigger").execute()
            )
            print(f"    handle_new_client trigger: EXISTS")
        except Exception as e:
            print(f"    handle_new_client trigger: CHECK FAILED ({str(e)[:50]})")
        
        # 5. Recommendations
        print("\n[5] RECOMMENDATIONS")
        if orphaned_user_ids:
            print("    ❌ Users registered but NOT in CRM:")
            print("       → Check if migration (stage-5-crm-tables.sql) was applied")
            print("       → Run: CREATE TRIGGER on_auth_user_created_create_client")
            print("       → OR manually create client records for orphaned users")
            print()
            print("       MANUAL FIX SQL:")
            print("       ```sql")
            print("       INSERT INTO public.clients (user_id, onboarding_status)")
            print("       SELECT id, 'started' FROM auth.users u")
            print("       WHERE NOT EXISTS (")
            print("         SELECT 1 FROM public.clients WHERE user_id = u.id")
            print("       );")
            print("       ```")
        else:
            print("    ✅ All registered users have client records")
        
        print("\n" + "="*60)
        
        return {
            "total_users": user_count,
            "total_clients": client_count,
            "orphaned_count": len(orphaned_user_ids),
            "orphaned_user_ids": list(orphaned_user_ids)[:10],
        }
        
    except Exception as e:
        logger.error(f"Diagnostic failed: {e}")
        print(f"\n❌ ERROR: {e}")
        return None

if __name__ == "__main__":
    result = asyncio.run(diagnose_crm_users())
    if result:
        print(f"\nResult: {result}")
