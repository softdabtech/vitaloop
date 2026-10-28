#!/usr/bin/env python3
"""
Set a user as super_admin by updating their Supabase auth app_metadata.
"""
import os
import sys
from supabase import create_client
import json

# Get Supabase credentials from environment
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars required")
    sys.exit(1)

# Initialize Supabase client with service role (has admin access)
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def set_super_admin(email: str):
    """Set a user as super_admin."""
    try:
        # Get user by email
        admin_client = supabase.auth.admin
        user = admin_client.get_user_by_email(email)
        
        if not user:
            print(f"ERROR: User with email {email} not found")
            return False
        
        user_id = user.id
        print(f"Found user: {user_id} ({email})")
        print(f"Current app_metadata: {user.app_metadata}")
        
        # Update app_metadata to add is_super_admin
        updated_user = admin_client.update_user_by_id(
            user_id,
            {
                "app_metadata": {
                    **(user.app_metadata or {}),
                    "is_super_admin": True,
                    "global_role": "super_admin"
                }
            }
        )
        
        print(f"✓ Updated user to super_admin")
        print(f"New app_metadata: {updated_user.app_metadata}")
        return True
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "bombela1988@gmail.com"
    print(f"Setting {email} as super_admin...")
    success = set_super_admin(email)
    sys.exit(0 if success else 1)
