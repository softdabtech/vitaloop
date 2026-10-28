"""
Migration to fix broken user account settings in Supabase
- Set bombela1988@gmail.com to super_admin
- Fix a@a.com premium subscription status
"""
import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Load .env file before importing app
from dotenv import load_dotenv
env_file = backend_dir / ".env"
if env_file.exists():
    load_dotenv(env_file)

from app.services import supabase_service as svc

async def run_migration():
    """Run the fixes"""
    
    print("=" * 60)
    print("MIGRATION: Fix User Accounts")
    print("=" * 60)
    
    # Fix 1: bombela1988@gmail.com to super_admin
    print("\n1. Fixing bombela1988@gmail.com to super_admin...")
    try:
        sb = svc._get_supabase()
        resp = await svc._run(
            lambda: sb.table("users").select("id, email, global_role").eq("email", "bombela1988@gmail.com").limit(1).execute()
        )
        if resp.data:
            user_data = resp.data[0]
            user_id = user_data["id"]
            current_role = user_data.get("global_role", "")
            
            if current_role != "super_admin":
                await svc.update_admin_user_fields(
                    user_id=user_id,
                    global_role="super_admin",
                )
                print(f"✅ Updated {user_id} from '{current_role}' to super_admin")
            else:
                print(f"✅ Already super_admin")
        else:
            print("❌ User bombela1988@gmail.com not found")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Fix 2: a@a.com premium status
    print("\n2. Fixing a@a.com premium subscription...")
    try:
        sb = svc._get_supabase()
        resp = await svc._run(
            lambda: sb.table("users").select("id, email, sub_status").eq("email", "a@a.com").limit(1).execute()
        )
        if resp.data:
            user_data = resp.data[0]
            user_id = user_data["id"]
            current_status = user_data.get("sub_status", "free")
            
            print(f"   Current: sub_status={current_status}")
            
            if current_status != "active":
                await svc.update_admin_user_fields(
                    user_id=user_id,
                    sub_status="active",
                )
                print(f"✅ Updated sub_status from '{current_status}' to 'active'")
            else:
                print(f"✅ Already active")
        else:
            print("❌ User a@a.com not found")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "=" * 60)
    print("Migration complete")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_migration())
